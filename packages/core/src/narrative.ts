/**
 * Narrative from claims only, and the post-generation check (REQUIREMENTS.md 4.8, FR-17, RAG-07).
 * Claude writes sentences that cite claim ids; this code removes any sentence that cites nothing,
 * cites unknown claims, or carries a year or a proper name its claims do not contain.
 * Semantic drift cannot be fully detected by code — demo narratives are also human-checked (4.8-5).
 */
import { z } from "zod";
import { normalizeForSearch } from "./text";

export const NarrativeOutput = z.object({
  sentences: z.array(
    z.object({
      text: z.string(),
      claim_ids: z.array(z.string()).describe("ids of the claims this sentence relies on"),
      assertion_type: z.enum(["direct", "derived", "interpretive"]),
    }),
  ),
});
export type NarrativeOutput = z.infer<typeof NarrativeOutput>;

export type NarrativeClaim = {
  id: string;
  /** entity ids the claim is about (subject, object), plus their ancestors */
  entities: string[];
  /** everything the claim legitimately contains: labels, values, excerpts, dates */
  facts: string;
  derived: boolean;
};

export type CheckedSentence = NarrativeOutput["sentences"][number] & {
  ok: boolean;
  problems: string[];
};

/**
 * 4.5.2: absence may only be stated as "the permanent gate had not yet been rebuilt" — temporary
 * gates stood in the interim, so "there was no gate" overstates the evidence.
 */
export const OVERSTATED_ABSENCE = [
  /門(の|が|は)(ない|無い|なかった|無かった)/,
  /門のなかった/,
  /\b(no|without a|without any) (gate|kaminarimon)\b/i,
  /\bthere was no (gate|kaminarimon)\b/i,
  /\bgateless\b/i,
];

/** Years / numbers of 3+ digits in a sentence must appear in the cited claims' facts. */
function numbers(s: string): string[] {
  return [...s.normalize("NFKC").matchAll(/\d{3,}/g)].map((m) => m[0]);
}

export function checkNarrative(
  sentences: NarrativeOutput["sentences"],
  claims: Map<string, NarrativeClaim>,
  /** dictionary names -> entity id (normalized name keys) */
  nameIndex: Map<string, string>,
  /**
   * Entities every sentence may name: the photo's subject and its ancestors, fixed by the place
   * stage. Contrasts like "not the gate but the temple" are the story, so naming the subject is allowed.
   */
  alwaysAllowed: string[] = [],
): CheckedSentence[] {
  const names = [...nameIndex.keys()].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  return sentences.map((s) => {
    const problems: string[] = [];
    const cited = s.claim_ids.map((id) => claims.get(id));
    if (s.assertion_type !== "interpretive" && s.claim_ids.length === 0) problems.push("no_claims");
    if (cited.some((c) => !c)) problems.push("unknown_claim_id");
    const ok = cited.filter((c): c is NarrativeClaim => Boolean(c));
    const facts = ok.map((c) => c.facts).join(" ").normalize("NFKC");
    for (const n of numbers(s.text)) if (!facts.includes(n)) problems.push(`number_not_in_claims:${n}`);
    const allowed = new Set([...ok.flatMap((c) => c.entities), ...alwaysAllowed]);
    const norm = normalizeForSearch(s.text);
    let rest = norm;
    for (const n of names) {
      if (!rest.includes(n)) continue;
      rest = rest.split(n).join(" "); // longest names first ("浅草寺" before "浅草")
      const e = nameIndex.get(n)!;
      if (s.assertion_type !== "interpretive" && !allowed.has(e)) problems.push(`entity_not_in_claims:${e}`);
    }
    if (s.assertion_type === "derived" && !ok.some((c) => c.derived)) problems.push("derived_without_derived_claim");
    if (OVERSTATED_ABSENCE.some((re) => re.test(s.text))) problems.push("overstated_absence");
    return { ...s, ok: problems.length === 0, problems };
  });
}
