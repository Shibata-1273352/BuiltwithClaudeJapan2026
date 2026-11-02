/**
 * Threads (REQUIREMENTS.md 3, 4.6): one per accepted claim and one per derived existence claim.
 * Code decides the display state; Claude never does.
 */
import { displayState, type CheckedClaim, type DisplayState, type Entities } from "@tsumugi/core";
import type { Retrieved } from "./retrieve";

export type Layer = "toki" | "ba" | "koto" | "ma";

export type Thread = {
  id: string;
  claimId: string;
  layer: Layer;
  state: DisplayState;
  label: { ja: string; en: string };
  evidence: string[]; // passage or sentence ids
  derivation: "direct" | "derived" | "interpretive";
};

export type ExistenceRow = {
  source: string;
  sourceTitle: string;
  time: { kind: string; start: string | null; end?: string | null; basis?: string } | null;
  value: "present" | "absent" | "unknown";
  reason: string;
  period?: { state: string; start: string; end: string; from: string[]; to: string[] };
  timeEvidence: string[];
  /** how the source relates to the structure; "absent" is always a chronology-based inference */
  relation?: { kind: "depicts" | "observed_site" | "written_period" | "eyewitness_event"; entity: string; evidence: string[]; note?: string } | null;
  basis?: "chronology";
  temporary?: { value: "built_that_time" | "unknown"; events: string[] };
  disputedEvent?: string;
};

const REL_JA: Record<string, string> = {
  depicts: "作品が門を描いている",
  observed_site: "書き手が観察したのは境内（門ではない）",
  written_period: "執筆の時期との照合",
  eyewitness_event: "焼失そのものの回想",
};
const REL_EN: Record<string, string> = {
  depicts: "the work depicts the gate",
  observed_site: "the writer observed the temple grounds, not the gate",
  written_period: "matched against when it was written",
  eyewitness_event: "a recollection of the fire itself",
};

/**
 * Each claim keeps its own subject: a claim about Sensō-ji is shown as being about Sensō-ji (its
 * label names it), never re-targeted to the photo's gate. 4.6's "coarser match never inks the
 * structure" is therefore enforced by not re-targeting, not by downgrading the claim itself.
 */
export function claimThreads(claims: CheckedClaim[], E: Entities, _targetId: string, byPassage: Map<string, Retrieved>): Thread[] {
  return claims
    .filter((c) => c.status !== "rejected")
    .map((c) => {
      const layer: Layer = c.predicate === "named_as" ? "koto" : c.predicate === "destroyed_in" || c.predicate === "rebuilt_in" ? "toki" : "koto";
      const subj = E.get(c.subject);
      const state = displayState({ derivation: "direct", relations: [c.relation] });
      const src = byPassage.get(c.passage_id);
      return {
        id: `th:${c.id}`,
        claimId: c.id,
        layer,
        state: c.status === "downgraded" && state === "ink" ? "pending" : state,
        label: {
          ja: `${src?.sourceTitle ?? c.passage_id}：${subj?.name.ja ?? c.subject}（${c.predicate}${c.value ? `「${c.value}」` : ""}）`,
          en: `${src?.sourceTitle ?? c.passage_id}: ${subj?.name.en ?? c.subject} (${c.predicate}${c.value ? ` "${c.value}"` : ""})`,
        },
        evidence: c.sentence_ids,
        derivation: "direct" as const,
      };
    });
}

/** Derived existence claims (4.5.2): "at the source's time, the permanent gate was (not) there". */
export function existenceThreads(rows: ExistenceRow[], E: Entities, targetId: string): Thread[] {
  const name = E.get(targetId)?.name ?? { ja: targetId, en: targetId };
  return rows.map((r) => {
    const state = displayState({
      derivation: "derived",
      relations: ["supports"],
      allDependenciesPresent: Boolean(r.period) && r.timeEvidence.length > 0,
      existence: r.value,
    });
    const when = r.time?.start ? `${r.time.start.slice(0, 4)}` : "?";
    // Review 2026-11-03: say how the source relates to the gate, and that "absent/present" comes
    // from matching its time against the rebuilding history (not from the source itself).
    const relJa = r.relation ? REL_JA[r.relation.kind] : "";
    const relEn = r.relation ? REL_EN[r.relation.kind] : "";
    const label =
      r.value === "absent"
        ? {
            ja: `${r.sourceTitle}（${when}）のとき、恒久的な${name.ja}は焼失後まだ再建されていなかった（浅草寺の再建史との照合。${relJa}）`,
            en: `When ${r.sourceTitle} was written (${when}), the permanent ${name.en} had not yet been rebuilt after the fire (from the rebuilding history; ${relEn})`,
          }
        : r.value === "present"
          ? {
              ja: `${r.sourceTitle}（${when}）のとき、${name.ja}はあった（${relJa}。再建史とも整合）`,
              en: `When ${r.sourceTitle} was made (${when}), ${name.en} stood (${relEn}; consistent with the rebuilding history)`,
            }
          : r.reason === "sources_disagree"
            ? {
                ja: `${r.sourceTitle}のとき：判定保留（焼失日が史料間で一致しない。${relJa}）`,
                en: `${r.sourceTitle}: judgment withheld (sources disagree on the date of the fire; ${relEn})`,
              }
            : { ja: `${r.sourceTitle}のとき、${name.ja}があったかは確かめられない`, en: `Whether ${name.en} stood at the time of ${r.sourceTitle} cannot be confirmed` };
    return {
      id: `th:exist:${r.source}`,
      claimId: `cl:exist:${targetId}:${r.source}`,
      layer: "toki" as const,
      state,
      label,
      evidence: [...(r.period ? [...r.period.from, ...r.period.to] : []), ...r.timeEvidence],
      derivation: "derived" as const,
    };
  });
}
