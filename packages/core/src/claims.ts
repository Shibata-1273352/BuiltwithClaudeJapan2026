/**
 * Evidence extraction and claim checks (REQUIREMENTS.md 4.4.6–4.4.7, 4.6, FR-13/14).
 * Claude proposes; these functions decide. A proposal that fails a check is dropped or downgraded,
 * never "fixed up" into something the source does not say.
 */
import { z } from "zod";
import { normalizeForSearch } from "./text";

export const PREDICATES = ["describes", "mentions", "observed", "named_as", "dedicated_to", "depicts", "destroyed_in", "rebuilt_in"] as const;
export type Predicate = (typeof PREDICATES)[number];

/** Schema Claude fills (structured output). No refinements, so it converts to JSON Schema. */
export const ProposedClaim = z.object({
  passage_id: z.string(),
  sentence_ids: z.array(z.string()).describe("ids of the sentences that state this, from the given list"),
  subject: z.string().describe("entity id from the given list"),
  predicate: z.enum(PREDICATES),
  object: z.string().nullable().describe("entity id from the given list, or null"),
  value: z.string().nullable().describe("for named_as: the exact name as written in the sentence; else null"),
  relation: z
    .enum(["supports", "contradicts", "context_only"])
    .describe(
      "how the cited sentences relate to THIS claim: supports = they state it; contradicts = they deny it; context_only = only background. Not the relation to the photo.",
    ),
  negated: z.boolean().describe("true if the sentence denies or says the writer did not see/go"),
  rationale: z.string().describe("one short sentence"),
});
export type ProposedClaim = z.infer<typeof ProposedClaim>;

export const ExtractionOutput = z.object({ claims: z.array(ProposedClaim) });
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;

export type SentenceIndex = Map<string, { passageId: string; text: string; lang: "en" | "ja" }>;

export type CheckedClaim = ProposedClaim & {
  id: string;
  status: "accepted" | "downgraded" | "rejected";
  checks: { name: string; ok: boolean; note?: string }[];
  /** evidence text = server-side cut from the canonical sentences, never Claude's text (9.1) */
  excerpt: string;
};

const NEGATION = {
  en: /\b(not|never|no longer|did not|didn't|could not|wasn't|nor)\b/i,
  ja: /(なかった|ない|ず[、。]|ませんでした|ぬ|ではなく|しなかった)/,
};

export type CheckContext = {
  sentences: SentenceIndex;
  entityIds: Set<string>;
  /** names an entity may be called, for named_as checks */
  namesOf: (entityId: string) => string[];
  /** existence of an entity at the time of the passage's source (4.4.7 時間の整合), if known */
  existenceAt?: (entityId: string, passageId: string) => "present" | "absent" | "unknown";
};

export function checkClaim(p: ProposedClaim, ctx: CheckContext, idx: number): CheckedClaim {
  const checks: CheckedClaim["checks"] = [];
  const add = (name: string, ok: boolean, note?: string) => checks.push({ name, ok, ...(note ? { note } : {}) });

  // 1. quote exists: every sentence id is real and belongs to the passage (4.4.7 引用の一致)
  const sents = p.sentence_ids.map((id) => ({ id, s: ctx.sentences.get(id) }));
  const quoteOk = sents.length > 0 && sents.length <= 3 && sents.every((x) => x.s && x.s.passageId === p.passage_id);
  add("sentence_ids_exist", quoteOk);
  // 2. entities are known
  add("subject_known", ctx.entityIds.has(p.subject));
  add("object_known", p.object === null || ctx.entityIds.has(p.object));
  const excerpt = quoteOk ? sents.map((x) => x.s!.text).join(" ") : "";
  const lang = sents[0]?.s?.lang ?? "en";
  const norm = normalizeForSearch(excerpt);

  // 3. named_as: the value must literally appear in the cited sentences (RAG-01 basis)
  if (p.predicate === "named_as") {
    add("name_in_sentence", Boolean(p.value) && norm.includes(normalizeForSearch(p.value ?? "")));
  }
  // 4. the subject must be named in the sentences (or be the narrator's place via a name usage)
  const subjNames = ctx.namesOf(p.subject).map(normalizeForSearch);
  const named = subjNames.some((n) => n && norm.includes(n));
  add("subject_named_in_sentence", named, named ? undefined : "subject not named in cited sentences");

  // 5. negation: a negated sentence never supports observed/describes (4.4.7 example)
  const hasNeg = NEGATION[lang].test(excerpt);
  const negated = p.negated || (hasNeg && (p.predicate === "observed" || p.predicate === "describes"));
  add("negation_handled", !(negated && p.relation === "supports"), negated ? "negated sentence" : undefined);

  // 6. time consistency: nobody observes/describes a structure that did not exist at the time
  const existence = ctx.existenceAt?.(p.subject, p.passage_id);
  const timeConflict = existence === "absent" && (p.predicate === "observed" || p.predicate === "describes") && p.relation === "supports";
  add("time_consistent", !timeConflict, timeConflict ? "subject absent at the source's time" : undefined);

  let status: CheckedClaim["status"] = "accepted";
  let relation = p.relation;
  let predicate = p.predicate;
  if (!quoteOk || !ctx.entityIds.has(p.subject) || (p.object !== null && !ctx.entityIds.has(p.object))) status = "rejected";
  else if (p.predicate === "named_as" && !checks.find((c) => c.name === "name_in_sentence")?.ok) status = "rejected";
  else {
    if ((negated || timeConflict) && relation === "supports") {
      relation = "context_only";
      status = "downgraded";
    }
    if (!named && (predicate === "observed" || predicate === "describes")) {
      // not named in the sentence: at most a mention via context
      predicate = "mentions";
      status = "downgraded";
    }
  }
  return { ...p, predicate, relation, negated, id: `cl:${p.passage_id}:${idx}`, status, checks, excerpt };
}

/** Display states (4.6). */
import type { DisplayState } from "./domain";
export type { DisplayState };

export function displayState(input: {
  derivation: "direct" | "derived" | "interpretive";
  relations: ("supports" | "contradicts" | "context_only")[];
  allDependenciesPresent?: boolean;
  existence?: "present" | "absent" | "unknown";
  userConfirmed?: boolean;
  /** the claim is about an ancestor place of the photo's subject, not the subject itself */
  aboutAncestorOnly?: boolean;
}): DisplayState {
  if (input.userConfirmed) return "user_confirmed";
  if (input.relations.includes("supports") && input.relations.includes("contradicts")) return "conflict";
  if (input.existence === "absent") return "absent";
  if (input.existence === "unknown") return "pending";
  if (input.derivation === "interpretive") return "pencil";
  if (input.derivation === "derived") return input.allDependenciesPresent ? "combined" : "pending";
  if (!input.relations.includes("supports")) return "pending";
  if (input.aboutAncestorOnly) return "pencil"; // 4.6: coarser-grain match never inks the structure
  return "ink";
}
