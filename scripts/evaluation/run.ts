/**
 * Evaluation (REQUIREMENTS.md 10, FR-50, RAG-09, RAG-12):  npm run eval [-- --no-llm] [--run NAME] [--budget USD]
 *
 * Methods (4.9) on the same frozen cases (evaluation/cases.json):
 *   A  full-text search only (searchEntities over the plan's names)
 *   B  the production retrieval (names + relation co-occurrence + RRF + coverage). No vector channel.
 *   C  B + an evaluation-only Claude selection (pick and label passages; no code checks)
 *   D  B + the production extraction (Claim/Evidence, checked by code)        — "B + extraction"
 *   D+ D + the production gap round (gap -> search -> extract new passages) + narration
 * Ablations (10.3): context headers (B with/without), relation context (D vs D-noRel), time
 * (existence from source times vs publication dates), gap round (D vs D+). Visual search: P1, n/a.
 *
 * Claude calls go through the Message Batches API (50% price) with the SAME system/user text and
 * the SAME code checks as the live DAG (buildExtract / buildGap / buildNarrate). Batches cannot
 * use server-side fallbacks; a refusal counts as a failure. Resumable: batch ids and raw results
 * are kept under $DATA_DIR/out/eval/<run>/ and finished stages are not resubmitted.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  judgeExistence,
  NarrativeOutput,
  toRange,
  UNTRUSTED_POLICY,
  wrapUntrusted,
  type CheckedClaim,
  type ExistenceEvent,
  type TimeValue,
} from "@tsumugi/core";
import { z } from "zod";
import { CLAUDE_LIGHT_MODEL, CLAUDE_MODEL, claude, costOf } from "../../apps/web/src/lib/claude";
import { openDb } from "../../apps/web/src/lib/corpus/db";
import { searchEntities } from "../../apps/web/src/lib/corpus/search";
import { buildPlan, type FacetPlan } from "../../apps/web/src/lib/dag/plan";
import { retrieveFacet, type Retrieved } from "../../apps/web/src/lib/dag/retrieve";
import { claimThreads, existenceThreads } from "../../apps/web/src/lib/dag/threads";
import { entities } from "../../apps/web/src/lib/entities-server";
import { existenceRows } from "../../apps/web/src/lib/existence-rows";
import { buildExtract, chunkForExtraction, ExtractionOutput, selectForExtraction } from "../../apps/web/src/lib/extract";
import { buildGap, GapOutput, parseGap, searchGaps, summarizeForGap, validateGaps } from "../../apps/web/src/lib/gap";
import { buildClaimCards, buildNarrate } from "../../apps/web/src/lib/narrate";
import { store } from "../../apps/web/src/lib/store";
import { existenceFor, sourceTime, timeline } from "../../apps/web/src/lib/timeline-server";

// ---------- arguments, paths ----------
const args = process.argv.slice(2);
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const NO_LLM = args.includes("--no-llm");
const RUN = arg("--run") ?? new Date().toISOString().slice(0, 10);
const BUDGET = Number(arg("--budget") ?? 10);
const ROOT = path.join(import.meta.dirname, "..", "..");
const OUT = path.join(process.env.DATA_DIR!, "out", "eval", RUN);
const RESULTS = path.join(ROOT, "evaluation", "results");
mkdirSync(OUT, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

type Lang = "en" | "ja";
type Cases = {
  version: number;
  frozen_at: string;
  annotated_by: string;
  targets: { id: string; entity: string; relevant: Record<Lang, string[]> }[];
  forbidden: { target: string; source: string | null; subject: string; predicates: string[]; values?: string[]; why: string }[];
  existence: { target: string; entity: string; source: string; expected: "present" | "absent" | "unknown"; hold?: string; approved: boolean }[];
};
const cases = JSON.parse(readFileSync(path.join(ROOT, "evaluation", "cases.json"), "utf8")) as Cases;
const casesHash = createHash("sha256").update(readFileSync(path.join(ROOT, "evaluation", "cases.json"))).digest("hex").slice(0, 12);
const E = entities();
const db = openDb({ readonly: true });
const textOf = (pid: string) => (db.prepare("SELECT norm FROM passages WHERE id = ?").get(pid) as { norm: string } | undefined)?.norm ?? "";
const namesOf = (id: string) => [...(E.get(id)?.names ?? []).map((n) => n.text), E.get(id)?.name.ja ?? "", E.get(id)?.name.en ?? ""].filter((s) => s.length >= 2);
const namedIn = (entity: string, pid: string) => {
  const t = textOf(pid);
  return namesOf(entity).some((n) => t.includes(n.normalize("NFKC").toLowerCase()) || t.includes(n));
};

// ---------- retrieval ----------
function retrieveB(plan: FacetPlan[], useHeader = true): Retrieved[] {
  const all: Retrieved[] = [];
  for (const f of plan) for (const lang of ["en", "ja"] as const) all.push(...retrieveFacet(db, E, f, lang, { useHeader }).candidates);
  return all;
}
/** one ranked list per language: dedupe, best RRF first (the order extraction sees) */
function ranked(cands: Retrieved[], lang: Lang): string[] {
  const best = new Map<string, number>();
  for (const c of cands) if (c.lang === lang) best.set(c.passageId, Math.max(best.get(c.passageId) ?? 0, c.rrf));
  return [...best].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
function rankedA(plan: FacetPlan[], lang: Lang): string[] {
  const terms = [...new Set(plan.flatMap((f) => f.scopes.flatMap((s) => s.terms[lang])))].slice(0, 12);
  return terms.length ? searchEntities(db, terms, lang, { limit: 50 }).map((c) => c.passageId) : [];
}
const recallAt = (list: string[], gold: string[], k: number) => (gold.length ? gold.filter((g) => list.slice(0, k).includes(g)).length / gold.length : NaN);
const mrr = (list: string[], gold: string[]) => {
  const i = list.findIndex((x) => gold.includes(x));
  return i < 0 ? 0 : 1 / (i + 1);
};

// ---------- batches ----------
type Req = { custom_id: string; params: Record<string, unknown> };
type Res = { text: string | undefined; stop: string | null; cost: number; error?: string };
const statePath = path.join(OUT, "state.json");
const state: { batches: Record<string, { id: string; hash: string }>; spent: number } = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { batches: {}, spent: 0 };
const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

function params(system: string, user: string, maxTokens: number, effort: "low" | "medium", schema: z.ZodType, model: string = CLAUDE_MODEL): Record<string, unknown> {
  return {
    model,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort, format: zodOutputFormat(schema) },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}
/** rough upper bound in USD at the batch price: input chars/3 + max output, $4/$20 per MTok, x0.5 */
const estimate = (reqs: Req[]) =>
  reqs.reduce((s, r) => s + ((JSON.stringify(r.params).length / 3) * 4 + Number(r.params.max_tokens) * 0.35 * 20) / 1e6, 0) * 0.5;

async function runBatch(stage: string, reqs: Req[]): Promise<Map<string, Res>> {
  const out = new Map<string, Res>();
  if (!reqs.length) return out;
  const hash = createHash("sha256").update(JSON.stringify(reqs)).digest("hex").slice(0, 16);
  const resPath = path.join(OUT, `${stage}.results.json`);
  if (existsSync(resPath)) {
    const saved = JSON.parse(readFileSync(resPath, "utf8")) as { hash: string; results: [string, Res][] };
    if (saved.hash === hash) return new Map(saved.results);
    throw new Error(`${stage}: saved results are for different requests (hash ${saved.hash} != ${hash}); use a new --run`);
  }
  let id = state.batches[stage]?.hash === hash ? state.batches[stage].id : undefined;
  if (!id) {
    // serialization check: the structured-output schema must survive JSON (no functions)
    const sample = JSON.parse(JSON.stringify(reqs[0].params)) as { output_config: { format: { type: string; schema?: unknown } } };
    if (sample.output_config.format.type !== "json_schema" || !sample.output_config.format.schema) throw new Error(`${stage}: output format did not serialize`);
    const est = estimate(reqs);
    if (state.spent + est > BUDGET) throw new Error(`${stage}: estimated $${est.toFixed(2)} would exceed the budget ($${state.spent.toFixed(2)} spent of $${BUDGET})`);
    const b = await claude().messages.batches.create({ requests: JSON.parse(JSON.stringify(reqs)) });
    id = b.id;
    state.batches[stage] = { id, hash };
    saveState();
    console.log(`[${stage}] submitted ${reqs.length} requests as ${id} (estimate ≤ $${est.toFixed(2)})`);
  } else console.log(`[${stage}] resuming ${id}`);
  for (;;) {
    const b = await claude().messages.batches.retrieve(id);
    if (b.processing_status === "ended") break;
    console.log(`[${stage}] ${b.processing_status} ${JSON.stringify(b.request_counts)}`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  for await (const r of await claude().messages.batches.results(id)) {
    if (r.result.type === "succeeded") {
      const m = r.result.message;
      const cost = costOf(m.usage, m.model) * 0.5;
      state.spent += cost;
      out.set(r.custom_id, { text: m.content.find((c) => c.type === "text")?.text, stop: m.stop_reason, cost });
    } else out.set(r.custom_id, { text: undefined, stop: null, cost: 0, error: r.result.type });
  }
  saveState();
  writeFileSync(resPath, JSON.stringify({ hash, results: [...out] }, null, 1));
  return out;
}

// ---------- C: evaluation-only Claude selection ----------
const SelectOutput = z.object({
  selected: z
    .array(
      z.object({
        passage_id: z.string(),
        about: z.string().describe("entity id from the list"),
        kind: z.enum(["observed", "mentions"]).describe("observed = the writer saw and describes it; mentions = only named"),
      }),
    )
    .describe("most relevant first, at most 12"),
});
const SELECT_SYSTEM = `You select evidence for a traveler's photo. From the passages, pick those that say something about the photo's subject or its site, most relevant first (at most 12). For each, give the entity it is about (from the list) and whether the writer observed it or only mentions it.
${UNTRUSTED_POLICY}`;
function selectUser(target: string, cands: Retrieved[]): string {
  const ents = E.dict.entities.map((e) => `- ${e.id} (${e.type}): ${e.name.ja} / ${e.name.en}`).join("\n");
  const seen = new Set<string>();
  const blocks = cands
    .filter((c) => !seen.has(c.passageId) && seen.add(c.passageId))
    .map((c) => `passage ${c.passageId} (${c.sourceTitle})\n${wrapUntrusted(c.passageId, c.text)}`);
  return `Photo subject: ${target}\nEntities:\n${ents}\n\n${blocks.join("\n\n")}`;
}

// ---------- per-target pipeline ----------
type Item = { passage: string; source: string; subject: string; predicate: string; value: string | null; status?: string };
const forbiddenHit = (target: string, it: Item) =>
  cases.forbidden.some(
    (f) =>
      f.target === target &&
      (f.source === null || f.source === it.source) &&
      f.subject === it.subject &&
      f.predicates.includes(it.predicate) &&
      (!f.values || f.values.includes(it.value ?? "")),
  );
const srcOf = (pid: string) => pid.split(":")[0];

function itemMetrics(target: { id: string; entity: string; relevant: Record<Lang, string[]> }, items: Item[]) {
  const gold = new Set([...target.relevant.en, ...target.relevant.ja]);
  const aboutTarget = items.filter((i) => i.subject === target.entity);
  const identOk = aboutTarget.filter((i) => namedIn(target.entity, i.passage)).length;
  const strong = items.filter((i) => i.predicate === "observed" || i.predicate === "describes" || i.predicate === "named_as");
  const violations = items.filter((i) => forbiddenHit(target.id, i));
  return {
    items: items.length,
    identification: { n: aboutTarget.length, precision: aboutTarget.length ? identOk / aboutTarget.length : NaN },
    relation: { n: strong.length, violations: violations.length, precision: strong.length ? 1 - violations.filter((v) => strong.includes(v)).length / strong.length : NaN, examples: violations.slice(0, 3) },
    support_proxy: { n: items.length, rate: items.length ? items.filter((i) => gold.has(i.passage)).length / items.length : NaN },
  };
}

// ---------- existence (code only) ----------
function publicationTime(source: string): TimeValue | null {
  const s = timeline().t.source_times.find((x) => x.source === source);
  return s?.times.find((t) => t.kind === "first_published_at" || t.kind === "edition_published_at") ?? null;
}
function existenceEval() {
  const rows = cases.existence.map((c) => {
    const j = existenceFor(c.entity, c.source);
    const got = j.value;
    // ablation: judge by publication date instead of the observed/written/depicted time
    const pub = publicationTime(c.source);
    const ev = timeline().t.existence_events.filter((e) => e.entity === c.entity) as ExistenceEvent[];
    const abl = pub ? judgeExistence(timeline().periods.get(c.entity) ?? [], toRange(pub), ev).value : "unknown";
    return { ...c, got, reason: j.reason, ablation_publication: abl };
  });
  const acc = (rs: typeof rows, k: "got" | "ablation_publication") => (rs.length ? rs.filter((r) => r[k] === r.expected).length / rs.length : NaN);
  const holds = rows.filter((r) => r.expected === "unknown");
  const wrongBinding = (k: "got" | "ablation_publication") => rows.filter((r) => r[k] !== "unknown" && r[k] !== r.expected).length;
  return {
    rows,
    accuracy_approved: acc(rows.filter((r) => r.approved), "got"),
    accuracy_pending: acc(rows.filter((r) => !r.approved), "got"),
    accuracy_all: acc(rows, "got"),
    hold_rate: holds.length ? holds.filter((r) => r.got === "unknown").length / holds.length : NaN,
    n: rows.length,
    n_hold: holds.length,
    ablation_time: { accuracy_with: acc(rows, "got"), accuracy_publication: acc(rows, "ablation_publication"), era_misbindings_with: wrongBinding("got"), era_misbindings_publication: wrongBinding("ablation_publication") },
  };
}

// ---------- citation checks (deterministic): fabricated proposals must be rejected ----------
function citationTest() {
  const t = cases.targets[0];
  const plan = buildPlan(E, t.entity);
  const sel = selectForExtraction(retrieveB(plan)).slice(0, 6);
  const req = buildExtract(db, E, t.entity, sel);
  const p0 = sel[0].passageId;
  const s0 = (db.prepare("SELECT id, text FROM sentences WHERE passage_id = ? ORDER BY n").all(p0) as { id: string; text: string }[])[0];
  const base = { passage_id: p0, sentence_ids: [s0.id], object: null, value: null, relation: "supports", negated: false, rationale: "t" };
  const subj = E.dict.entities.find((e) => namesOf(e.id).some((n) => s0.text.includes(n)))?.id ?? "ent:sensoji";
  const fakes = [
    { ...base, sentence_ids: [`${p0}:999`], subject: subj, predicate: "mentions", why: "sentence id does not exist" },
    { ...base, sentence_ids: ["bird-unbeaten:45:1:0"], subject: subj, predicate: "mentions", why: "sentence from a passage not given" },
    { ...base, subject: "ent:osaka-castle", predicate: "mentions", why: "entity not in the dictionary" },
    { ...base, subject: subj, predicate: "named_as", value: "大阪城", why: "named_as value not in the sentence" },
  ];
  const valid = { ...base, subject: subj, predicate: "mentions" };
  const checked = req.finish(JSON.stringify({ claims: [...fakes.map(({ why: _w, ...f }) => f), valid] }), "end_turn");
  const rejected = checked.slice(0, fakes.length).filter((c) => c.status !== "accepted").length;
  const passageIds = new Set(sel.map((s) => s.passageId));
  const outsideRejected = checked.filter((c) => !passageIds.has(c.passage_id)).length === 0; // dropped before checking
  return {
    fabricated: fakes.length,
    rejected_or_dropped: rejected + (checked.length < fakes.length + 1 ? fakes.length + 1 - checked.length : 0),
    valid_accepted: checked.at(-1)?.status === "accepted",
    cases: fakes.map((f) => f.why),
    outside_passages_dropped: outsideRejected,
  };
}
/** every accepted excerpt must equal the canonical sentences it cites (9.1) */
function exactCitation(claims: CheckedClaim[]) {
  const acc = claims.filter((c) => c.status !== "rejected");
  const ok = acc.filter((c) => {
    const sents = c.sentence_ids.map((id) => (db.prepare("SELECT text FROM sentences WHERE id = ?").get(id) as { text: string } | undefined)?.text ?? "");
    return sents.every((s) => s && c.excerpt.includes(s));
  }).length;
  return { n: acc.length, exact: acc.length ? ok / acc.length : NaN };
}

// ---------- live runs: invariance (RAG-08) and execution ----------
function liveStats() {
  const s = store();
  const ex = s.prepare("SELECT id, status, created_at, finished_at, cost_usd, result_json FROM explorations WHERE created_at >= '2026-11-02'").all() as {
    id: string;
    status: string;
    created_at: string;
    finished_at: string | null;
    cost_usd: number;
    result_json: string | null;
  }[];
  const done = ex.filter((e) => e.status === "done" && e.result_json && JSON.parse(e.result_json).place);
  const ms = done.map((e) => JSON.parse(e.result_json!).elapsed_ms as number).filter(Boolean).sort((a, b) => a - b);
  const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
  // RAG-08: every narrative (ja, en) cites only claim ids of its exploration; threads emitted once
  const both = s.prepare("SELECT exploration_id AS id FROM narratives GROUP BY exploration_id HAVING count(*) = 2").all() as { id: string }[];
  let consistent = 0;
  for (const { id } of both) {
    const ev = (t: string) => (s.prepare("SELECT data_json FROM events WHERE exploration_id = ? AND type = ?").all(id, t) as { data_json: string }[]).map((r) => JSON.parse(r.data_json));
    const threads = ev("threads");
    const ids = new Set([...ev("claims").flatMap((e) => e.claims.map((c: { id: string }) => c.id)), ...(threads[0] ?? []).map((t: { claimId: string }) => t.claimId)]);
    const narr = s.prepare("SELECT json FROM narratives WHERE exploration_id = ?").all(id) as { json: string }[];
    const ok = threads.length === 1 && narr.every((n) => JSON.parse(n.json).sentences.every((x: { claim_ids: string[] }) => x.claim_ids.every((c) => ids.has(c))));
    if (ok) consistent++;
  }
  return {
    explorations: ex.length,
    failure_rate: ex.length ? ex.filter((e) => e.status === "failed" || e.status === "deadline").length / ex.length : NaN,
    latency_ms: { n: ms.length, median: q(0.5), p90: q(0.9) },
    cost_usd_mean: done.length ? done.reduce((a, e) => a + e.cost_usd, 0) / done.length : NaN,
    rag08: { explorations: both.length, consistent },
  };
}

// ---------- main ----------
const perTarget: Record<string, unknown> = {};
const reqs1: Req[] = [];
const ctx: Record<string, { plan: FacetPlan[]; B: Retrieved[]; sel: Retrieved[]; ex: Record<string, ReturnType<typeof buildExtract>> }> = {};

for (const t of cases.targets) {
  const plan = buildPlan(E, t.entity);
  const B = retrieveB(plan);
  const Bnh = retrieveB(plan, false);
  const r: Record<string, Record<string, number>> = {};
  for (const lang of ["en", "ja"] as const) {
    const gold = t.relevant[lang];
    const a = rankedA(plan, lang);
    const b = ranked(B, lang);
    const bn = ranked(Bnh, lang);
    r[lang] = {
      gold: gold.length,
      A_recall10: recallAt(a, gold, 10),
      A_mrr: mrr(a, gold),
      B_recall10: recallAt(b, gold, 10),
      B_mrr: mrr(b, gold),
      B_recall_all: recallAt(b, gold, 1e9),
      B_candidates: b.length,
      Bnohdr_recall10: recallAt(bn, gold, 10),
      Bnohdr_mrr: mrr(bn, gold),
    };
  }
  // B / A have no Claude: identify by the matched entity of each candidate (code heuristic)
  const bItems: Item[] = B.map((c) => ({ passage: c.passageId, source: c.sourceId, subject: c.matched_entity ?? "", predicate: "mentions", value: null }));
  perTarget[t.id] = { retrieval: r, B_items: itemMetrics(t, bItems) };
  const sel = selectForExtraction(B);
  const ex: Record<string, ReturnType<typeof buildExtract>> = {};
  for (const lang of ["en", "ja"] as const)
    chunkForExtraction(sel.filter((c) => c.lang === lang)).forEach((part, i) => {
      ex[`D_${lang}_${i}`] = buildExtract(db, E, t.entity, part);
      ex[`N_${lang}_${i}`] = buildExtract(db, E, t.entity, part, { relations: false });
    });
  ctx[t.id] = { plan, B, sel, ex };
  if (NO_LLM) continue;
  reqs1.push({ custom_id: `${t.id}__C`, params: params(SELECT_SYSTEM, selectUser(t.entity, B), 6000, "low", SelectOutput) });
  for (const [k, e] of Object.entries(ex)) if (e.passages.length) reqs1.push({ custom_id: `${t.id}__${k}`, params: params(e.system, e.user, 16000, "low", ExtractionOutput) });
  const summary = summarizeForGap(plan, B, [], B.map((x) => ({ source: x.sourceId, value: existenceFor(t.entity, x.sourceId).value })));
  const g = buildGap(E, t.entity, summary);
  // the gap judgment runs on the light model at standard speed, as in the live DAG
  reqs1.push({ custom_id: `${t.id}__gap`, params: params(g.system, g.user, g.max_tokens, g.effort, GapOutput, CLAUDE_LIGHT_MODEL) });
}

const existence = existenceEval();
const citation = citationTest();
const live = liveStats();
let llm: Record<string, unknown> = { skipped: NO_LLM };

if (!NO_LLM) {
  const r1 = await runBatch("round1", reqs1);
  // gap -> search -> second extraction (D+), as in the live DAG
  const reqs2: Req[] = [];
  const found2: Record<string, Retrieved[]> = {};
  const ex2: Record<string, ReturnType<typeof buildExtract>> = {};
  const gaps: Record<string, unknown> = {};
  for (const t of cases.targets) {
    const c = ctx[t.id];
    const g = r1.get(`${t.id}__gap`);
    const out = g ? parseGap(g.text, g.stop) : null;
    const valid = out ? validateGaps(out, E) : [];
    const found = out && !out.enough ? searchGaps(db, E, t.entity, valid, c.plan, new Set(c.B.map((x) => x.passageId))) : [];
    found2[t.id] = found;
    gaps[t.id] = { enough: out?.enough ?? null, assessment: out?.assessment ?? null, gaps: valid.map((v) => ({ facet: v.facet, lang: v.lang, terms: v.terms })), found: found.length };
    const s2 = selectForExtraction(found);
    chunkForExtraction(s2).forEach((part, i) => {
      const k = `${t.id}__D2_${i}`;
      ex2[k] = buildExtract(db, E, t.entity, part);
      reqs2.push({ custom_id: k, params: params(ex2[k].system, ex2[k].user, 16000, "low", ExtractionOutput) });
    });
  }
  const r2 = await runBatch("round2", reqs2);

  // claims per method, with live-style round suffixes
  const claimsOf = (t: string, keys: string[], src: Map<string, Res>, exs: Record<string, ReturnType<typeof buildExtract>>, round: number) =>
    keys.flatMap((k) => {
      const res = src.get(`${t}__${k}`);
      return res ? exs[k].finish(res.text, res.stop).map((c) => ({ ...c, id: `${c.id}:r${round}` })) : [];
    });
  const reqs3: Req[] = [];
  const narr: Record<string, ReturnType<typeof buildNarrate>> = {};
  const methods: Record<string, Record<string, unknown>> = {};
  for (const t of cases.targets) {
    const c = ctx[t.id];
    const keys = (prefix: string) => Object.keys(c.ex).filter((k) => k.startsWith(prefix));
    const D = claimsOf(t.id, keys("D_"), r1, c.ex, 1);
    const N = claimsOf(t.id, keys("N_"), r1, c.ex, 1);
    const d2keys = Object.keys(ex2).filter((k) => k.startsWith(`${t.id}__D2_`)).map((k) => k.slice(t.id.length + 2));
    const D2 = claimsOf(t.id, d2keys, r2, Object.fromEntries(d2keys.map((k) => [k, ex2[`${t.id}__${k}`]])), 2);
    const toItems = (cs: CheckedClaim[]): Item[] =>
      cs.filter((x) => x.status === "accepted").map((x) => ({ passage: x.passage_id, source: srcOf(x.passage_id), subject: x.subject, predicate: x.predicate, value: x.value, status: x.status }));
    const proposedItems = (cs: CheckedClaim[]): Item[] => cs.map((x) => ({ passage: x.passage_id, source: srcOf(x.passage_id), subject: x.subject, predicate: x.predicate, value: x.value }));
    // C: Claude's selection without code checks
    const cRes = r1.get(`${t.id}__C`);
    let cSel: z.infer<typeof SelectOutput>["selected"] = [];
    try {
      const p = cRes?.text && cRes.stop !== "refusal" ? SelectOutput.safeParse(JSON.parse(cRes.text)) : null;
      cSel = p?.success ? p.data.selected : [];
    } catch {
      cSel = [];
    }
    const cItems: Item[] = cSel.map((s) => ({ passage: s.passage_id, source: srcOf(s.passage_id), subject: s.about, predicate: s.kind, value: null }));
    const rec = (ids: string[], lang: Lang) => recallAt(ids.filter((id) => c.B.some((b) => b.passageId === id && b.lang === lang)), t.relevant[lang], 10);
    const all2 = [...c.B, ...found2[t.id]];
    methods[t.id] = {
      C: { ...itemMetrics(t, cItems), recall10: { en: rec(cSel.map((s) => s.passage_id), "en"), ja: rec(cSel.map((s) => s.passage_id), "ja") }, selected: cSel.length },
      D: { ...itemMetrics(t, toItems(D)), proposed_unchecked: itemMetrics(t, proposedItems(D)), status: count(D), citation: exactCitation(D) },
      D_noRel: { ...itemMetrics(t, toItems(N)), proposed_unchecked: itemMetrics(t, proposedItems(N)), status: count(N) },
      Dplus: {
        ...itemMetrics(t, toItems([...D, ...D2])),
        status: count([...D, ...D2]),
        recall_all: { en: recallAt(ranked(all2, "en"), t.relevant.en, 1e9), ja: recallAt(ranked(all2, "ja"), t.relevant.ja, 1e9) },
        gap: gaps[t.id],
        citation: exactCitation([...D, ...D2]),
      },
    };
    // narration for D+ (as the live DAG: threads + existence rows + claim cards)
    const claims = [...D, ...D2];
    const byPassage = new Map(all2.map((x) => [x.passageId, x]));
    const exRows = existenceRows(t.entity, all2);
    const threads = [...existenceThreads(exRows, E, t.entity, timeline().t.existence_events.filter((e) => e.entity === t.entity)), ...claimThreads(claims, E, t.entity, byPassage)];
    const cards = buildClaimCards(E, claims, threads, exRows, (pid) => byPassage.get(pid)?.sourceTitle ?? pid, (pid) => sourceTime(byPassage.get(pid)?.sourceId ?? "", t.entity));
    if (cards.size) {
      narr[t.id] = buildNarrate(E, cards, "ja", E.ancestors(t.entity).map((e) => e.id));
      reqs3.push({ custom_id: `${t.id}__narrate`, params: params(narr[t.id].system, narr[t.id].user, narr[t.id].max_tokens, narr[t.id].effort, NarrativeOutput) });
    }
  }
  const r3 = await runBatch("round3", reqs3);
  const generation: Record<string, unknown> = {};
  for (const t of cases.targets) {
    const res = r3.get(`${t.id}__narrate`);
    const sents = res && narr[t.id] ? narr[t.id].finish(res.text, res.stop) : [];
    generation[t.id] = {
      sentences: sents.length,
      unsupported_detected: sents.filter((s) => !s.ok).length,
      unsupported_shown: 0, // failing sentences are never shown (4.8)
      problems: sents.filter((s) => !s.ok).map((s) => ({ text: s.text.slice(0, 80), problems: s.problems })),
    };
  }
  const allRes = [...r1.values(), ...r2.values(), ...r3.values()];
  llm = {
    methods,
    generation,
    batch: {
      requests: allRes.length,
      failed: allRes.filter((r) => r.error || r.stop === "refusal" || !r.text).length,
      cost_usd: allRes.reduce((a, r) => a + r.cost, 0),
      ids: state.batches,
    },
  };
}

function count(cs: CheckedClaim[]) {
  return { accepted: cs.filter((c) => c.status === "accepted").length, downgraded: cs.filter((c) => c.status === "downgraded").length, rejected: cs.filter((c) => c.status === "rejected").length };
}

const result = { run: RUN, model: CLAUDE_MODEL, cases: { version: cases.version, hash: casesHash, frozen_at: cases.frozen_at, annotated_by: cases.annotated_by }, perTarget, existence, citation, live, llm };
writeFileSync(path.join(RESULTS, `${RUN}.json`), JSON.stringify(result, null, 2) + "\n");
writeFileSync(path.join(RESULTS, `${RUN}.md`), (await import("./report")).report(result));
// the app shows the latest run that called Claude (a --no-llm dry run never replaces it)
if (!NO_LLM) writeFileSync(path.join(RESULTS, "latest.json"), JSON.stringify(result, null, 2) + "\n");
console.log(`wrote evaluation/results/${RUN}.json and .md`);
