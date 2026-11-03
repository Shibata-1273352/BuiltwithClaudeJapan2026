/**
 * Stage 6: gap evaluation and one extra search round (REQUIREMENTS.md 4.3, FR-20).
 * Claude judges what evidence is missing and proposes search terms; code validates the proposal
 * (known entities, short plain terms, at most 3 gaps) and runs the search with bound parameters.
 * The judgment text is shown in presentation mode so the decision is visible.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { UNTRUSTED_POLICY, type CheckedClaim, type Entities } from "@tsumugi/core";
import { z } from "zod";
import { CLAUDE_LIGHT_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";
import type { DB } from "./corpus/db";
import { rrf, searchEntities, searchRelation, type Lang } from "./corpus/search";
import type { Facet, FacetPlan } from "./dag/plan";
import type { Retrieved } from "./dag/retrieve";

const FACETS = ["place_description", "naming", "existence_timeline", "historical_artifacts", "contrast"] as const;

export const GapOutput = z.object({
  assessment: z.string().describe("1-2 sentences in Japanese: what the evidence covers and what is missing"),
  enough: z.boolean().describe("true if no extra search is worth doing"),
  gaps: z.array(
    z.object({
      facet: z.enum(FACETS),
      lang: z.enum(["en", "ja"]),
      entity: z.string().describe("entity id from the given list"),
      reason: z.string().describe("one short sentence in Japanese, shown to the audience"),
      terms: z.array(z.string()).describe("1-4 short search words in that language"),
    }),
  ),
});
export type GapOutput = z.infer<typeof GapOutput>;

export const GAP_LIMITS = { gaps: 3, terms: 4, termLen: 30, perGap: 6 } as const;
const TERM_RE = /^[\p{L}\p{N}\p{M} '’\-ー・]+$/u;

export type ValidGap = GapOutput["gaps"][number] & { rejectedTerms: string[] };

/** Code-side validation of Claude's gap proposal (ASI02). */
export function validateGaps(out: GapOutput, E: Entities): ValidGap[] {
  return out.gaps
    .filter((g) => E.get(g.entity))
    .slice(0, GAP_LIMITS.gaps)
    .map((g) => {
      const ok = g.terms.filter((t) => t.length > 0 && t.length <= GAP_LIMITS.termLen && TERM_RE.test(t)).slice(0, GAP_LIMITS.terms);
      return { ...g, terms: ok, rejectedTerms: g.terms.filter((t) => !ok.includes(t)) };
    })
    .filter((g) => g.terms.length > 0);
}

export function summarizeForGap(plan: FacetPlan[], retrieved: Retrieved[], claims: CheckedClaim[], existence: { source: string; value: string }[]): string {
  const lines: string[] = [];
  for (const f of plan) {
    for (const lang of ["en", "ja"] as const) {
      const c = retrieved.filter((r) => r.facet === f.facet && r.lang === lang);
      const rel = c.reduce<Record<string, number>>((m, r) => ((m[r.relation] = (m[r.relation] ?? 0) + 1), m), {});
      lines.push(`- ${f.facet} / ${lang}: ${c.length} candidates ${JSON.stringify(rel)}; sources: ${[...new Set(c.map((r) => r.sourceTitle))].join(", ") || "none"}`);
    }
  }
  const accepted = claims.filter((c) => c.status !== "rejected");
  const bySubj = accepted.reduce<Record<string, string[]>>((m, c) => ((m[c.subject] = [...(m[c.subject] ?? []), `${c.predicate}${c.value ? `:${c.value}` : ""}`]), m), {});
  lines.push(`claims by subject: ${JSON.stringify(bySubj)}`);
  lines.push(`existence judged for: ${existence.map((e) => `${e.source}=${e.value}`).join(", ") || "none"}`);
  return lines.join("\n");
}

const SYSTEM = `You are the gap-evaluation stage of TSUMUGI. The goal for a photo's subject is to show, with evidence in BOTH English and Japanese:
(1) what writers described there, (2) the names used for the place, temple and deity, (3) when the structure existed, (4) artworks depicting it.
Given a summary of what the first search found, decide what is missing and propose at most 3 targeted extra searches (facet, language, entity, 1-4 short words likely to appear in old books).
Prefer gaps that would change what the audience learns (e.g. no Japanese description, a name usage not yet evidenced). If coverage is good, set enough=true and return no gaps.
Write "assessment" and "reason" in Japanese for the audience.
${UNTRUSTED_POLICY}`;

/** The gap request, shared by the live DAG and the evaluation (Batch API). */
export function buildGap(E: Entities, targetId: string, summary: string) {
  const ents = E.dict.entities.map((e) => `- ${e.id} (${e.type}): ${e.name.ja} / ${e.name.en}`).join("\n");
  return { system: SYSTEM, user: `Photo subject: ${targetId}\nEntities:\n${ents}\n\nFirst search:\n${summary}`, max_tokens: 4000, effort: "low" as const };
}

export function parseGap(text: string | undefined, stopReason: string | null): GapOutput | null {
  const parsed = text && stopReason !== "refusal" ? GapOutput.safeParse(JSON.parse(text)) : null;
  return parsed?.success ? parsed.data : null;
}

export async function evaluateGaps(E: Entities, targetId: string, summary: string): Promise<{ out: GapOutput | null; record: CallRecord }> {
  const req = buildGap(E, targetId, summary);
  const startedAt = new Date();
  const { data, response } = await claude()
    .beta.messages.create(
      {
        model: CLAUDE_LIGHT_MODEL,
        max_tokens: req.max_tokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: req.effort, format: betaZodOutputFormat(GapOutput) },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
      },
      { timeout: 30_000 },
    )
    .withResponse();
  const record: CallRecord = {
    stage: "gap",
    model: CLAUDE_LIGHT_MODEL,
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
    costUsd: costOf(data.usage, CLAUDE_LIGHT_MODEL),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  return { out: parseGap(text, data.stop_reason), record };
}

/** Run the validated extra searches; returns only passages not seen in round 1. */
export function searchGaps(db: DB, E: Entities, targetId: string, gaps: ValidGap[], plan: FacetPlan[], seen: Set<string>): Retrieved[] {
  const meta = new Map(
    (db.prepare("SELECT id, type, title FROM sources").all() as { id: string; type: string; title: string }[]).map((r) => [r.id, r]),
  );
  const out: Retrieved[] = [];
  for (const g of gaps) {
    const f = plan.find((p) => p.facet === g.facet);
    const allowed = new Set(f?.sourceTypes ?? ["book"]);
    const names = E.names(g.entity, g.lang as Lang).map((n) => n.text).slice(0, 8);
    const lists = [searchEntities(db, g.terms, g.lang as Lang), names.length ? searchRelation(db, names, g.terms, g.lang as Lang) : []];
    let n = 0;
    for (const c of rrf(lists)) {
      const m = meta.get(c.sourceId);
      if (seen.has(c.passageId) || !m || !allowed.has(m.type)) continue;
      seen.add(c.passageId);
      out.push({
        passageId: c.passageId,
        sourceId: c.sourceId,
        sourceType: m.type,
        sourceTitle: m.title,
        lang: c.lang,
        chapterLabel: c.chapterLabel,
        text: c.text,
        facet: g.facet as Facet,
        target_entity: targetId,
        matched_entity: g.entity,
        relation: g.entity === targetId ? "same" : E.ancestors(targetId).some((a) => a.id === g.entity) ? "ancestor_place" : "related",
        scope: `gap:${g.entity}`,
        channels: c.channels,
        matched: c.matched,
        rrf: c.rrf,
      });
      if (++n >= GAP_LIMITS.perGap) break;
    }
  }
  return out;
}
