/**
 * Exploration DAG (REQUIREMENTS.md 4.3). Code fixes the order of stages; Claude only makes the
 * bounded judgment inside a stage, and code validates it. Stages: received → see → place → plan →
 * retrieve → extract → existence → threads → done. Gap evaluation and narrative come next.
 *
 * Budgets (4.3, 4.13): 90 s wall-clock deadline, at most 14 Claude calls per exploration.
 * Retries happen only within the remaining time; at the deadline we finish with what is verified.
 */
import { readFile } from "node:fs/promises";
import type { SeeOutput } from "@tsumugi/core";
import { openDb } from "../corpus/db";
import type { CaptureRow } from "../captures";
import { entities } from "../entities-server";
import { seePhoto } from "../see";
import { store } from "../store";
import { emit } from "./events";
import { buildPlan } from "./plan";
import { retrieveFacet, type Retrieved } from "./retrieve";
import { claimThreads, existenceThreads } from "./threads";
import { extractClaims, selectForExtraction } from "../extract";
import { evaluateGaps, searchGaps, summarizeForGap, validateGaps } from "../gap";
import { buildClaimCards, narrate } from "../narrate";
import { saveToGraph } from "../graph-write";
import { findAssociations } from "../associations";
import { requestScene, requestVisual } from "../inference";
import { existenceRows } from "../existence-rows";
import { narrativeFor, saveNarrative } from "../narrative-service";
import { findNames, namePatterns, type CheckedClaim, type FoundName } from "@tsumugi/core";
import { existenceFor, sourceTime, timeline } from "../timeline-server";
import type { CallRecord } from "../claude";
import type { DB } from "../corpus/db";

export const BUDGET = { deadlineMs: 90_000, maxClaudeCalls: 14 } as const;

class Deadline extends Error {}

export class RunContext {
  readonly started = Date.now();
  claudeCalls = 0;
  costUsd = 0;
  constructor(readonly explorationId: string) {}
  remaining(): number {
    return BUDGET.deadlineMs - (Date.now() - this.started);
  }
  check(): void {
    if (this.remaining() <= 0) throw new Deadline("deadline");
  }
  claude(): void {
    if (this.claudeCalls >= BUDGET.maxClaudeCalls) throw new Error("claude call budget exhausted");
    this.claudeCalls++;
  }
}

function logCall(ctx: RunContext, db: DB, explorationId: string, record: CallRecord): void {
  ctx.costUsd += record.costUsd;
  db.prepare("INSERT INTO ai_calls (exploration_id, stage, record_json, cost_usd, ts) VALUES (?,?,?,?,?)").run(
    explorationId,
    record.stage,
    JSON.stringify(record),
    record.costUsd,
    new Date().toISOString(),
  );
  emit(explorationId, "ai_call", { ...record, rateLimit: undefined }); // presentation mode (FR-46)
}

async function stage<T>(ctx: RunContext, name: string, fn: () => Promise<T>): Promise<T> {
  ctx.check();
  const t0 = Date.now();
  emit(ctx.explorationId, "stage", { stage: name, status: "start", remaining_ms: ctx.remaining() });
  const out = await fn();
  emit(ctx.explorationId, "stage", { stage: name, status: "done", ms: Date.now() - t0 });
  return out;
}

export type RunOptions = { gapRound: boolean };

/** opts.gapRound=false is method D, true is D+ (4.9); D+ is the adopted default. */
export async function runExploration(explorationId: string, capture: CaptureRow, opts: RunOptions = { gapRound: true }): Promise<void> {
  const ctx = new RunContext(explorationId);
  const db = store();
  const finish = (status: "done" | "failed" | "deadline", result: unknown) => {
    db.prepare("UPDATE explorations SET status = ?, finished_at = ?, cost_usd = ?, result_json = ? WHERE id = ?").run(
      status,
      new Date().toISOString(),
      ctx.costUsd,
      JSON.stringify(result),
      explorationId,
    );
  };
  try {
    emit(explorationId, "received", { capture_id: capture.id, size: [capture.width, capture.height], location: capture.lat != null });

    // 1. See (Claude): cultural elements and place candidates
    const see = await stage(ctx, "see", async () => {
      ctx.claude();
      const img = await readFile(capture.image_path);
      const r = await seePhoto({ base64: img.toString("base64"), mediaType: "image/jpeg" });
      logCall(ctx, db, explorationId, r.record);
      if (!r.validation.ok) throw new Error(`see output rejected: ${r.validation.errors.join("; ")}`);
      emit(explorationId, "see", r.validation.value);
      return r.validation.value as SeeOutput;
    });

    // 2. Place: map Claude's candidates to the dictionary (FR-07). Unknown place -> honest stop (FR-19).
    const E = entities();
    let photoUnmatched: { name_ja: string; name_en: string } | null = null;
    const place = await stage(ctx, "place", async () => {
      const candidates = see.places
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({ rank: p.rank, confidence: p.confidence, reason: p.reason, hierarchy: p.hierarchy, entity: E.matchPlace(p.hierarchy)?.id ?? null }));
      const chosen = candidates.find((c) => c.entity) ?? null;
      // FR-19: when the photo's most specific subject (e.g. 新大橋) is not registered, the match is
      // only a broader place (隅田川). Say so, and never let it be taken for a registered structure.
      // the deepest PLACE level (a print in the photo is an artwork level, not the place)
      const deepest = chosen?.hierarchy.filter((h) => h.type !== "artwork").at(-1);
      const unmatched =
        chosen && deepest && ![deepest.name_ja, deepest.name_en].some((n) => E.matchPlace([{ name_ja: n, name_en: n }])?.id === chosen.entity)
          ? { name_ja: deepest.name_ja, name_en: deepest.name_en }
          : null;
      photoUnmatched = unmatched;
      emit(explorationId, "place", {
        candidates,
        chosen: chosen ? { entity: chosen.entity, rank: chosen.rank, path: E.ancestors(chosen.entity!).map((e) => ({ id: e.id, name: e.name })) } : null,
        unmatched,
      });
      if (unmatched && chosen?.entity)
        emit(explorationId, "notice", {
          kind: "broader_place",
          message: `写真の対象（${unmatched.name_ja || unmatched.name_en}）は登録済みの資料にありません。登録済みの上位の場所「${E.get(chosen.entity)?.name.ja}」について探します。`,
        });
      return chosen?.entity ?? null;
    });
    if (!place) {
      // FR-19: say what was tried — Claude's candidates and the registered sites — and cite nothing
      const tried = see.places
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3)
        .map((p) => p.hierarchy.map((h) => h.name_ja || h.name_en).join(" › "));
      const registered = E.dict.entities.filter((e) => e.type === "structure" || e.type === "site").map((e) => e.name.ja);
      emit(explorationId, "notice", {
        kind: "no_known_place",
        message: `この写真の場所は、登録済みの資料の範囲では特定できませんでした。写真から推定した候補：${tried.join("／") || "なし"}。登録済みの名所：${registered.join("、")}。資料や引用は表示しません。`,
        tried,
        registered,
      });
      emit(explorationId, "done", { status: "no_known_place", claude_calls: ctx.claudeCalls, cost_usd: ctx.costUsd });
      finish("done", { place: null });
      return;
    }

    // 間 (parallel, 4.3/4.10): masks, depth, layers and alignment on the inference server. Started as
    // soon as the place is known (it picks the artifact to align to) and awaited only at the end.
    const artifactFor = (entityId: string): string | null => {
      const rel = E.dict.relations.find((r) => r.type === "DEPICTS" && r.to === entityId);
      const met = rel ? E.get(rel.from)?.external_ids?.met : undefined;
      return met ? `met-${met}` : null;
    };
    // FR-35 視点の見立て (pencil): Claude's guess for the photo; the artwork's is a hand-written note.
    // Shown with its premises; never a claim, a thread or a graph node.
    {
      const rel = E.dict.relations.find((r) => r.type === "DEPICTS" && r.to === place);
      const art = rel ? E.get(rel.from) : undefined;
      if (see.viewpoint || art?.viewpoint_note) {
        emit(explorationId, "viewpoint", {
          state: "pencil",
          visitor: see.viewpoint,
          artwork: art?.viewpoint_note ? { entity: art.id, name: art.name, ...art.viewpoint_note } : null,
        });
      }
    }
    const spaceStarted = Date.now();
    emit(explorationId, "stage", { stage: "space", status: "start", remaining_ms: ctx.remaining() });
    const spacePromise = requestScene(capture.image_path, capture.id, artifactFor(place), Math.max(5_000, Math.min(30_000, ctx.remaining() - 5_000))).then((r) => {
      emit(explorationId, "stage", { stage: "space", status: "done", ms: Date.now() - spaceStarted });
      emit(
        explorationId,
        "space",
        r.ok
          ? { ok: true, scene_id: r.scene.scene_id, url: `/space/${r.scene.scene_id}`, elements: Object.keys(r.scene.elements), aligned: Boolean(r.scene.alignment?.ok), ms: r.scene.elapsed_ms }
          : { ok: false, reason: r.reason, message: "空間解析：簡易表示" }, // FR-34
      );
      return r.ok ? r.scene : null;
    }).then(async (scene) => {
      // FR-58 視覚で探す: the cut-out lantern looks for lanterns in pre-indexed prints. A pointer to
      // look at, not evidence: it never becomes a claim or a thread.
      if (!scene || !scene.elements.lantern || ctx.remaining() < 4_000) return Boolean(scene);
      const v = await requestVisual(scene.scene_id, "lantern", 5, Math.min(10_000, ctx.remaining() - 2_000));
      if (v) {
        // a hit that is the same print as the artwork aligned to the photo opens "into the painting"
        const aligned = scene.alignment?.ok ? scene.alignment.artifact : undefined;
        const hits = v.hits.map((h) => {
          const art = E.dict.entities.find((e) => e.external_ids?.edo100 === h.id);
          const same = Boolean(art && aligned && `met-${art.external_ids?.met}` === aligned);
          return { ...h, artwork: art?.id ?? null, into: same ? `/space/${scene.scene_id}?enter=1` : null };
        });
        emit(explorationId, "visual", { element: "lantern", hits, ms: v.elapsed_ms, note: "似た図像（根拠ではない）" });
      }
      return true;
    });

    // the year axis needs a year per source: its own time for this site, else (marked) its publication year
    const published = (() => {
      const db = openDb({ readonly: true });
      try {
        return new Map((db.prepare("SELECT id, first_published FROM sources").all() as { id: string; first_published: number | null }[]).map((r) => [r.id, r.first_published]));
      } finally {
        db.close();
      }
    })();
    const yearOfSource = (id: string): { year: number | null; yearKind: "source_time" | "published" | null } => {
      const t = Number(sourceTime(id, place)?.start?.slice(0, 4));
      if (t) return { year: t, yearKind: "source_time" };
      const pub = published.get(id);
      return pub ? { year: pub, yearKind: "published" } : { year: null, yearKind: null };
    };

    // 3. Plan (FR-08)
    const plan = await stage(ctx, "plan", async () => {
      const p = buildPlan(E, place);
      emit(explorationId, "plan", p.map((f) => ({ facet: f.facet, target: f.target, scopes: f.scopes.map((s) => ({ entity: s.entity, relation: s.relation })), sourceTypes: f.sourceTypes })));
      return p;
    });

    // 4. Retrieve (FR-09..11), per facet × language, with "not found" reported per language
    const retrieved = await stage(ctx, "retrieve", async () => {
      const corpus = openDb({ readonly: true });
      try {
        const all: Retrieved[] = [];
        for (const f of plan) {
          for (const lang of ["en", "ja"] as const) {
            ctx.check();
            const r = retrieveFacet(corpus, E, f, lang);
            all.push(...r.candidates);
            emit(explorationId, "candidates", {
              facet: f.facet,
              lang,
              widened: r.widened,
              tried: r.tried,
              found: r.candidates.length,
              notFound: r.candidates.length === 0,
              // year: the source's own time for this site, so the live stage can place it on the year axis
              candidates: r.candidates.map((c) => ({ ...c, text: c.text.slice(0, 400), ...yearOfSource(c.sourceId) })),
            });
          }
        }
        return all;
      } finally {
        corpus.close();
      }
    });

    // 5. Extract evidence and propose claims (Claude), checked by code (FR-13, FR-14, FR-57)
    const all: Retrieved[] = [...retrieved];
    const byPassage = new Map(all.map((r) => [r.passageId, r]));
    const extractRound = async (round: number, selected: Retrieved[]): Promise<CheckedClaim[]> => {
      if (!selected.length) return [];
      ctx.claude();
      const corpus = openDb({ readonly: true });
      try {
        const r = await extractClaims(corpus, E, place, selected);
        logCall(ctx, db, explorationId, r.record);
        // claim ids are unique across rounds; the same ids are used by threads, narrative and graph (RAG-08)
        const claims = r.claims.map((c) => ({ ...c, id: `${c.id}:r${round}` }));
        emit(explorationId, "claims", {
          round,
          passages: r.passages.length,
          accepted: claims.filter((c) => c.status === "accepted").length,
          downgraded: claims.filter((c) => c.status === "downgraded").length,
          rejected: claims.filter((c) => c.status === "rejected").length,
          claims: claims.map((c) => ({
            id: c.id,
            passage_id: c.passage_id,
            source_id: byPassage.get(c.passage_id)?.sourceId,
            source: byPassage.get(c.passage_id)?.sourceTitle,
            lang: byPassage.get(c.passage_id)?.lang,
            subject: c.subject,
            predicate: c.predicate,
            object: c.object,
            value: c.value,
            relation: c.relation,
            status: c.status,
            failed_checks: c.checks.filter((k) => !k.ok).map((k) => k.name),
            excerpt: c.excerpt,
            sentence_ids: c.sentence_ids,
          })),
        });
        return claims;
      } finally {
        corpus.close();
      }
    };
    // 6. Gap evaluation (Claude decides what is missing from the retrieval; code validates) — FR-20.
    //    It runs concurrently with round-1 extraction, which is split by language, so the three
    //    Claude calls overlap instead of queueing (latency budget 4.13).
    const runGap = async (): Promise<Retrieved[]> => {
      if (ctx.remaining() < 35_000) {
        emit(explorationId, "gap", { skipped: "time", assessment: "残り時間が少ないため、追加の探索は行いませんでした。" });
        return [];
      }
      ctx.claude();
      const summary = summarizeForGap(plan, retrieved, [], retrieved.map((r) => ({ source: r.sourceId, value: existenceFor(place, r.sourceId).value })));
      const g = await evaluateGaps(E, place, summary);
      logCall(ctx, db, explorationId, g.record);
      if (!g.out) {
        emit(explorationId, "gap", { skipped: "invalid_output" });
        return [];
      }
      const gaps = validateGaps(g.out, E);
      const corpus = openDb({ readonly: true });
      let found: Retrieved[] = [];
      try {
        found = g.out.enough ? [] : searchGaps(corpus, E, place, gaps, plan, new Set(retrieved.map((r) => r.passageId)));
      } finally {
        corpus.close();
      }
      emit(explorationId, "gap", {
        assessment: g.out.assessment,
        enough: g.out.enough,
        gaps: gaps.map((x) => ({ facet: x.facet, lang: x.lang, entity: x.entity, reason: x.reason, terms: x.terms, rejectedTerms: x.rejectedTerms })),
        found: found.length,
        candidates: found.map((c) => ({ ...c, text: c.text.slice(0, 300) })),
      });
      return found;
    };
    const selected1 = selectForExtraction(retrieved);
    const [c1en, c1ja, found2] = await Promise.all([
      stage(ctx, "extract:en", () => extractRound(1, selected1.filter((c) => c.lang === "en"))),
      stage(ctx, "extract:ja", () => extractRound(1, selected1.filter((c) => c.lang === "ja"))),
      opts.gapRound ? stage(ctx, "gap", runGap) : Promise.resolve([] as Retrieved[]),
    ]);
    const claims1 = [...c1en, ...c1ja];
    for (const f of found2) {
      all.push(f);
      byPassage.set(f.passageId, f);
    }
    const claims2 = found2.length ? await stage(ctx, "extract2", () => extractRound(2, selectForExtraction(found2))) : [];
    const extraction = { claims: [...claims1, ...claims2] };

    // 7. Time and existence (code only, FR-15/16, RAG-05/06): what each source could have seen
    const existence = await stage(ctx, "existence", async () => {
      const rows = existenceRows(place, all);
      emit(explorationId, "existence", { entity: place, rows });
      const tl = timeline();
      const conflicts = tl.t.conflicts.filter((c) => tl.t.existence_events.some((e) => e.id === c.about && e.entity === place));
      if (conflicts.length) emit(explorationId, "conflicts", conflicts);
      // Data for the time river / time slider (FR-23, FR-56): the client re-judges any year with
      // the same pure functions, so the slider is instant and consistent with the server.
      const ent = E.get(place);
      emit(explorationId, "timeline", {
        entity: place,
        name: ent?.name,
        periods: tl.periods.get(place) ?? [],
        events: tl.t.existence_events
          .filter((e) => e.entity === place)
          .map((e) => ({ id: e.id, event: e.event, time: e.time, original: e.original, disputed: Boolean(e.disputed), evidence: e.evidence })),
        conflicts: conflicts.map((c) => ({ id: c.id, about: c.about, explanation: c.explanation })),
        sources: rows.map((r) => ({ source: r.source, title: r.sourceTitle, time: r.time, relation: r.relation?.kind ?? null, value: r.value, reason: r.reason })),
        reviewed_by: tl.t.reviewed_by,
      });
      return rows;
    });

    // 7b. 言の地層: name usages found in the canonical sentences (code only, FR-24, RAG-01)
    await stage(ctx, "names", async () => {
      const corpus = openDb({ readonly: true });
      try {
        const patterns = namePatterns(E);
        const getS = corpus.prepare("SELECT id, text FROM sentences WHERE passage_id = ? ORDER BY n");
        const rows: (FoundName & { source: string; sourceTitle: string; time: string | null; sentence: string })[] = [];
        for (const r of all) {
          const st = sourceTime(r.sourceId, place);
          for (const s of getS.all(r.passageId) as { id: string; text: string }[]) {
            for (const n of findNames(s.id, s.text, r.lang, patterns)) {
              rows.push({ ...n, source: r.sourceId, sourceTitle: r.sourceTitle, time: st?.start ?? null, sentence: s.text });
            }
          }
        }
        // one row per (entity, written form, source); keep the first sentence as the example
        const seen = new Set<string>();
        const usages = rows.filter((u) => {
          const k = `${u.entity}|${u.text}|${u.source}`;
          return seen.has(k) ? false : (seen.add(k), true);
        });
        const byEntity = Object.fromEntries(
          [...new Set(usages.map((u) => u.entity))].map((id) => [
            id,
            { name: E.get(id)?.name, type: E.get(id)?.type, usages: usages.filter((u) => u.entity === id) },
          ]),
        );
        emit(explorationId, "names", byEntity);
      } finally {
        corpus.close();
      }
    });

    const threads = [...existenceThreads(existence, E, place, timeline().t.existence_events.filter((e) => e.entity === place)),...claimThreads(extraction.claims, E, place, byPassage)];
    emit(explorationId, "threads", threads);

    // 8. Weave: narrative from adopted claims only, checked sentence by sentence (FR-17, 4.8)
    const narrative = await stage(ctx, "narrate", async () => {
      if (ctx.remaining() < 12_000) {
        emit(explorationId, "narrative", { skipped: "time" });
        return null;
      }
      const cards = buildClaimCards(
        E,
        extraction.claims,
        threads,
        existence,
        (pid) => byPassage.get(pid)?.sourceTitle ?? pid,
        (pid) => sourceTime(byPassage.get(pid)?.sourceId ?? "", place),
      );
      if (!cards.size) return null;
      ctx.claude();
      const lang = capture.ui_lang === "en" ? "en" : "ja";
      const r = await narrate(E, cards, lang, E.ancestors(place).map((e) => e.id), photoUnmatched);
      logCall(ctx, db, explorationId, r.record);
      const payload = {
        lang,
        sentences: r.sentences.filter((s) => s.ok).map(({ text, claim_ids, assertion_type }) => ({ text, claim_ids, assertion_type })),
        dropped: r.sentences.filter((s) => !s.ok).map(({ text, problems }) => ({ text, problems })),
      } as const;
      saveNarrative(explorationId, { ...payload, sentences: [...payload.sentences], dropped: [...payload.dropped] }); // cache (FR-40)
      emit(explorationId, "narrative", payload);
      return r.sentences;
    });

    const spaceOk = await spacePromise; // bounded by its own timeout

    // 9. Save to the Evidence Graph in one transaction (4.4.8). Failure does not stop the exploration.
    const graph = await stage(ctx, "graph", async () => {
      const corpus = openDb({ readonly: true });
      let sources: { id: string; type: string; title: string; version: string }[] = [];
      try {
        const ids = [...new Set(all.map((r) => r.sourceId))];
        sources = ids
          .map((id) => corpus.prepare("SELECT id, type, title, version_hash AS version FROM sources WHERE id = ?").get(id))
          .filter(Boolean) as typeof sources;
      } finally {
        corpus.close();
      }
      const lang = capture.ui_lang === "en" ? "en" : "ja";
      const r = await saveToGraph(E, {
        captureId: capture.id,
        target: place,
        claims: extraction.claims.map((c) => ({
          ...c,
          sourceId: byPassage.get(c.passage_id)?.sourceId ?? "",
          sourceVersion: sources.find((s) => s.id === byPassage.get(c.passage_id)?.sourceId)?.version,
        })),
        existence,
        threads,
        narrative: (narrative ?? []).filter((s) => s.ok).map((s) => ({ ...s, lang })),
        sources,
      });
      emit(explorationId, "graph", r.ok ? { saved: true, ms: r.ms } : { saved: false, message: "グラフ保存失敗（再試行できます）" });
      if (!r.ok) console.error(`[graph ${explorationId}]`, r.error);
      return r.ok;
    });

    // 10. 連想の糸 (FR-59, pencil): what the graph associates with this place beyond this run's
    // passages. Bounded (2 s); nothing is shown if Neo4j is down. Never a claim or a thread.
    if (graph && ctx.remaining() > 3_000) {
      const corpus = openDb({ readonly: true });
      try {
        const a = await findAssociations(place, new Set(all.map((r) => r.passageId)), corpus, Math.min(2_000, ctx.remaining() - 1_000));
        emit(explorationId, "associations", a.ok ? { ok: true, items: a.items, ms: a.ms } : { ok: false, items: [] });
      } finally {
        corpus.close();
      }
    }

    const summary = {
      graph_saved: graph,
      space: spaceOk ? `/space/${capture.id}` : "degraded",
      narrative_sentences: narrative?.filter((s) => s.ok).length ?? 0,
      narrative_dropped: narrative?.filter((s) => !s.ok).length ?? 0,
      status: "threads",
      place,
      candidates: all.length,
      gap_round: opts.gapRound,
      claims: extraction.claims.length,
      threads: threads.length,
      states: threads.reduce<Record<string, number>>((m, t) => ((m[t.state] = (m[t.state] ?? 0) + 1), m), {}),
      bySource: Object.fromEntries(
        [...new Set(all.map((r) => r.sourceId))].map((s) => [s, all.filter((r) => r.sourceId === s).length]),
      ),
      claude_calls: ctx.claudeCalls,
      cost_usd: Math.round(ctx.costUsd * 1e4) / 1e4,
      elapsed_ms: Date.now() - ctx.started,
      next: "language switch, presentation mode, time slider",
    };
    emit(explorationId, "done", summary);
    // Pre-generate the other language in the background so switching is instant (FR-40: 8 s target).
    if (narrative?.some((s) => s.ok)) {
      const other = capture.ui_lang === "en" ? "ja" : "en";
      void narrativeFor(explorationId, other).catch((e) => console.error(`[narrative ${explorationId} ${other}]`, e));
    }
    finish("done", summary);
  } catch (e) {
    const deadline = e instanceof Deadline;
    emit(explorationId, "failed", { reason: deadline ? "deadline" : "error", message: deadline ? "時間内に終わりませんでした" : "処理に失敗しました" });
    console.error(`[exploration ${explorationId}]`, e);
    finish(deadline ? "deadline" : "failed", { error: deadline ? "deadline" : String((e as Error).message).slice(0, 200) });
  }
}
