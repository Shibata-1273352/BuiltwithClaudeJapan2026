/**
 * Stage 4–5: evidence extraction and claim proposals (REQUIREMENTS.md 4.3, 4.4.5–4.4.7, FR-13/14/57).
 * Claude sees each passage with sentence ids and its 1-hop relations (which entity it matched, the
 * photo's subject, the source's time and edition) — never the graph alone. Code checks every claim.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { checkClaim, ExtractionOutput, UNTRUSTED_POLICY, wrapUntrusted, type CheckedClaim, type Entities, type SentenceIndex } from "@tsumugi/core";
import { CLAUDE_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";
import type { DB } from "./corpus/db";
import type { Retrieved } from "./dag/retrieve";
import { existenceFor, sourceTime } from "./timeline-server";

export const EXTRACT_LIMITS = { passages: 12, approxTokens: 8000 } as const;

const SYSTEM = `You extract evidence for TSUMUGI, which links a traveler's photo to historical sources without overstating them.
You get passages split into sentences with ids, each with context about which entity the search matched, the photo's subject, and when the source was written.
Propose claims that the cited sentences themselves state. Rules:
- Use only entity ids from the given list and sentence ids from the given passage.
- "describes"/"observed" only if the writer actually saw and wrote about that entity; "mentions" if it is only named; never upgrade.
- A temple (site), its deity (Kannon) and its gates (structures) are different entities. A passage about the temple is not about the gate.
- "named_as": the value must be copied exactly from the sentence (e.g. "Kwan-non").
- If the sentence denies or says the writer did not see/go, set negated=true.
- "relation" is about the claim itself: if the cited sentences state the claim, it is "supports". Use "context_only" only when they merely give background. It is NOT the relation to the photo's subject.
- Prefer few, precise claims (at most 4 per passage). Skip passages that say nothing about the listed entities.
${UNTRUSTED_POLICY}`;

export type ExtractResult = { claims: CheckedClaim[]; record: CallRecord; passages: string[] };

export function selectForExtraction(cands: Retrieved[]): Retrieved[] {
  const seen = new Set<string>();
  const out: Retrieved[] = [];
  let tokens = 0;
  // interleave languages and facets: sort by rrf within each, then round-robin
  const groups = new Map<string, Retrieved[]>();
  for (const c of cands) groups.set(`${c.lang}:${c.facet}`, [...(groups.get(`${c.lang}:${c.facet}`) ?? []), c]);
  const lists = [...groups.values()].map((g) => g.sort((a, b) => b.rrf - a.rrf));
  for (let i = 0; out.length < EXTRACT_LIMITS.passages && lists.some((l) => l[i]); i++) {
    for (const l of lists) {
      const c = l[i];
      if (!c || seen.has(c.passageId) || out.length >= EXTRACT_LIMITS.passages) continue;
      const t = Math.ceil(c.text.length / (c.lang === "ja" ? 1.2 : 4));
      if (tokens + t > EXTRACT_LIMITS.approxTokens) continue;
      seen.add(c.passageId);
      tokens += t;
      out.push(c);
    }
  }
  return out;
}

/**
 * The request (system + user content) and the code checks, separated so that the live DAG and the
 * evaluation (Batch API, 10.x) run exactly the same prompt and the same checks.
 * `relations: false` is the 10.3 ablation "passage only" (no 1-hop relation context).
 */
export function buildExtract(db: DB, E: Entities, targetId: string, selected: Retrieved[], opts: { relations?: boolean } = {}) {
  const withRelations = opts.relations ?? true;
  const sentences: SentenceIndex = new Map();
  const getS = db.prepare("SELECT id, text FROM sentences WHERE passage_id = ? ORDER BY n");
  const entityIds = new Set<string>([...E.ancestors(targetId).map((e) => e.id), ...E.dict.entities.map((e) => e.id)]);
  const entityList = [...entityIds]
    .map((id) => E.get(id)!)
    .map((e) => `- ${e.id} (${e.type}): ${e.name.ja} / ${e.name.en}; names: ${e.names.map((n) => `${n.text}${n.specificity === "ambiguous" ? "?" : ""}`).join(", ")}`)
    .join("\n");

  const blocks = selected.map((c) => {
    const rows = getS.all(c.passageId) as { id: string; text: string }[];
    for (const r of rows) sentences.set(r.id, { passageId: c.passageId, text: r.text, lang: c.lang });
    const st = sourceTime(c.sourceId, targetId);
    // FR-57: one-hop relations, grouped by type
    const relations = [
      `matched: ${c.matched_entity ?? "none"} (${c.relation} to the photo's subject ${targetId})`,
      st ? `source time: ${st.kind} ${st.start}${st.end ? `–${st.end}` : ""} (${st.basis ?? "stated"})` : "source time: unknown",
      `source: ${c.sourceTitle} / ${c.chapterLabel} (${c.sourceType})`,
    ].join("; ");
    return withRelations
      ? `passage ${c.passageId}\nrelations: ${relations}\n${wrapUntrusted(c.passageId, rows.map((r) => `[${r.id}] ${r.text}`).join("\n"))}`
      : `passage ${c.passageId}\n${wrapUntrusted(c.passageId, rows.map((r) => `[${r.id}] ${r.text}`).join("\n"))}`;
  });

  const allowedPassages = new Set(selected.map((c) => c.passageId));
  const passageSource = new Map(selected.map((c) => [c.passageId, c.sourceId]));
  return {
    system: SYSTEM,
    user: `Photo subject: ${targetId}\n\nEntities:\n${entityList}\n\n${blocks.join("\n\n")}`,
    passages: [...allowedPassages],
    /** Parse Claude's output and check every proposal in code (FR-14). */
    finish(text: string | undefined, stopReason: string | null): CheckedClaim[] {
      let proposals: ExtractionOutput["claims"] = [];
      if (text && stopReason !== "refusal") {
        const parsed = ExtractionOutput.safeParse(JSON.parse(text));
        if (parsed.success) proposals = parsed.data.claims;
      }
      return proposals
        .filter((p) => allowedPassages.has(p.passage_id))
        .map((p, i) =>
          checkClaim(p, {
            sentences,
            entityIds,
            namesOf: (id) => [...(E.get(id)?.names.map((n) => n.text) ?? []), E.get(id)?.name.ja ?? "", E.get(id)?.name.en ?? ""].filter(Boolean),
            existenceAt: (entity, passageId) => existenceFor(entity, passageSource.get(passageId) ?? "").value,
          }, i),
        );
    },
  };
}

export const EXTRACT_PARAMS = { max_tokens: 16000, effort: "low" as const }; // latency budget (4.13); checks are in code
export { ExtractionOutput, SYSTEM as EXTRACT_SYSTEM };

export async function extractClaims(db: DB, E: Entities, targetId: string, selected: Retrieved[]): Promise<ExtractResult> {
  const req = buildExtract(db, E, targetId, selected);
  const startedAt = new Date();
  const { data, response } = await claude()
    .beta.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: EXTRACT_PARAMS.max_tokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: EXTRACT_PARAMS.effort, format: betaZodOutputFormat(ExtractionOutput) },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
      },
      { timeout: 45_000 },
    )
    .withResponse();

  const record: CallRecord = {
    stage: "extract",
    model: CLAUDE_MODEL,
    servedModel: data.model,
    startedAt: startedAt.toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    stopReason: data.stop_reason,
    usage: {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      cacheRead: data.usage.cache_read_input_tokens ?? 0,
      cacheWrite: data.usage.cache_creation_input_tokens ?? 0,
    },
    costUsd: costOf(data.usage),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  return { claims: req.finish(text, data.stop_reason), record, passages: req.passages };
}
