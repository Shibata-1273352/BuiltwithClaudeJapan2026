/**
 * Retrieval per facet (REQUIREMENTS.md 4.4.4–4.4.5, FR-08..11).
 * - Search the target first; widen to ancestors only when the target scope finds too little, and
 *   record that widening on every candidate (matched_entity / target_entity / relation / scope).
 * - Fuse channels with RRF, then select with coverage (languages, source types, per-source caps).
 * - A passage about Sensō-ji is never presented as a statement about Kaminarimon itself (RAG-02):
 *   `relation` tells the UI and later stages what the passage actually talks about.
 */
import type { Entities } from "@tsumugi/core";
import type { DB } from "../corpus/db";
import { rrf, searchEntities, searchRelation, type Candidate, type Lang } from "../corpus/search";
import type { FacetPlan } from "./plan";

export type Retrieved = {
  passageId: string;
  sourceId: string;
  sourceType: string;
  sourceTitle: string;
  lang: Lang;
  chapterLabel: string;
  text: string;
  facet: FacetPlan["facet"];
  target_entity: string;
  matched_entity: string | null;
  relation: "same" | "ancestor_place" | "related" | "unknown";
  scope: string;
  channels: string[];
  matched: string[];
  rrf: number;
};

export const SELECT_LIMITS = { perLangPerFacet: 6, perSource: 3, minBeforeWidening: 3 } as const;

type SourceMeta = { type: string; title: string };

function sourceMeta(db: DB): Map<string, SourceMeta> {
  const rows = db.prepare("SELECT id, type, title FROM sources").all() as { id: string; type: string; title: string }[];
  return new Map(rows.map((r) => [r.id, { type: r.type, title: r.title }]));
}

/** The most specific dictionary entity among the matched terms (structure > site > area > deity). */
function matchedEntity(E: Entities, matched: string[]): string | null {
  const rank: Record<string, number> = { structure: 0, artwork: 1, site: 2, deity: 3, area: 4, person: 5, concept: 6 };
  const ents = matched.map((m) => E.findByName(m)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  ents.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));
  return ents[0]?.id ?? null;
}

export function retrieveFacet(db: DB, E: Entities, plan: FacetPlan, lang: Lang): { candidates: Retrieved[]; widened: string[]; tried: string[] } {
  const meta = sourceMeta(db);
  const allowed = (c: Candidate) => plan.sourceTypes.includes((meta.get(c.sourceId)?.type ?? "book") as never);
  const lists: Candidate[][] = [];
  const widened: string[] = [];
  const tried: string[] = [];
  let found = 0;
  for (const scope of plan.scopes) {
    const t = scope.terms[lang];
    if (!t.length) continue;
    if (scope.relation === "ancestor_place" && found >= SELECT_LIMITS.minBeforeWidening) continue; // widen only if needed
    tried.push(scope.entity);
    if (scope.relation === "ancestor_place") widened.push(scope.entity);
    const a = searchEntities(db, t.slice(0, 12), lang).filter(allowed);
    const b = plan.vocab[lang].length ? searchRelation(db, t.slice(0, 12), plan.vocab[lang], lang).filter(allowed) : [];
    lists.push(a, b);
    if (scope.relation === "same") found += a.length + b.length;
  }
  const fused = rrf(lists);
  const perSource = new Map<string, number>();
  const out: Retrieved[] = [];
  for (const c of fused) {
    const n = perSource.get(c.sourceId) ?? 0;
    if (n >= SELECT_LIMITS.perSource) continue;
    perSource.set(c.sourceId, n + 1);
    const m = matchedEntity(E, c.matched);
    const rel: Retrieved["relation"] =
      m === plan.target
        ? "same"
        : m && E.ancestors(plan.target).some((a) => a.id === m)
          ? "ancestor_place"
          : m
            ? "related"
            : "unknown";
    out.push({
      passageId: c.passageId,
      sourceId: c.sourceId,
      sourceType: meta.get(c.sourceId)?.type ?? "book",
      sourceTitle: meta.get(c.sourceId)?.title ?? c.sourceId,
      lang,
      chapterLabel: c.chapterLabel,
      text: c.text,
      facet: plan.facet,
      target_entity: plan.target,
      matched_entity: m,
      relation: rel,
      scope: tried.join(">"),
      channels: c.channels,
      matched: c.matched,
      rrf: c.rrf,
    });
    if (out.length >= SELECT_LIMITS.perLangPerFacet) break;
  }
  return { candidates: out, widened, tried };
}
