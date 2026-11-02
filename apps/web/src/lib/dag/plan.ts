/**
 * Search plan (REQUIREMENTS.md 4.4.4, FR-08): questions (facets) per target entity, with search
 * terms per language. Pure and deterministic; Claude's facet proposal (4.3 stage 2) will be merged
 * into this plan later, but the code keeps the final say on terms (dictionary names only).
 */
import type { Entities, EntitySeed } from "@tsumugi/core";

export type Facet = "place_description" | "naming" | "existence_timeline" | "historical_artifacts" | "contrast";
export type Lang = "en" | "ja";

export type FacetPlan = {
  facet: Facet;
  target: string; // entity id of the photo's subject
  scopes: { entity: string; relation: "same" | "ancestor_place" | "related"; terms: Record<Lang, string[]> }[];
  vocab: Record<Lang, string[]>;
  sourceTypes: ("book" | "museum_record" | "official_record")[];
};

const FACET_SOURCES: Record<Facet, FacetPlan["sourceTypes"]> = {
  place_description: ["book"],
  naming: ["book", "museum_record"],
  existence_timeline: ["official_record", "book"],
  historical_artifacts: ["museum_record"],
  contrast: ["book"],
};

function terms(E: Entities, e: EntitySeed): Record<Lang, string[]> {
  return { en: E.names(e.id, "en").map((n) => n.text), ja: E.names(e.id, "ja").map((n) => n.text) };
}

/** Related entities for the target: deities the site is dedicated to, and sibling structures. */
function related(E: Entities, target: EntitySeed): EntitySeed[] {
  const chain = E.ancestors(target.id).map((e) => e.id);
  const out: EntitySeed[] = [];
  for (const r of E.dict.relations) {
    if (r.type === "DEDICATED_TO" && chain.includes(r.from)) {
      const e = E.get(r.to);
      if (e) out.push(e);
    }
  }
  return out;
}

export function buildPlan(E: Entities, targetId: string): FacetPlan[] {
  const target = E.get(targetId);
  if (!target) return [];
  const chain = E.ancestors(targetId); // [target, parent, ...]
  const scopes = [
    ...chain.map((e, i) => ({ entity: e.id, relation: (i === 0 ? "same" : "ancestor_place") as "same" | "ancestor_place", terms: terms(E, e) })),
    ...related(E, target).map((e) => ({ entity: e.id, relation: "related" as const, terms: terms(E, e) })),
  ];
  const vocab = E.dict.relation_vocab;
  const plan: FacetPlan[] = [
    { facet: "place_description", target: targetId, scopes, vocab: vocab.place, sourceTypes: FACET_SOURCES.place_description },
    { facet: "naming", target: targetId, scopes, vocab: vocab.deity, sourceTypes: FACET_SOURCES.naming },
    {
      facet: "existence_timeline",
      target: targetId,
      scopes: scopes.filter((s) => s.relation !== "related"),
      vocab: vocab.existence,
      sourceTypes: FACET_SOURCES.existence_timeline,
    },
    { facet: "historical_artifacts", target: targetId, scopes, vocab: { en: [], ja: [] }, sourceTypes: FACET_SOURCES.historical_artifacts },
  ];
  return plan;
}
