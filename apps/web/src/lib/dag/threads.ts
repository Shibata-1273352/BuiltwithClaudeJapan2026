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
  relation?: { kind: "depicts" | "observed_site" | "written_period" | "eyewitness_event"; entity: string; evidence: string[]; note?: string; event?: string } | null;
  basis?: "chronology";
  temporary?: { value: "built_that_time" | "unknown"; events: string[] };
  disputedEvent?: string;
};

type Ev = { id: string; event: string; time: { start: string } };
type Name = { ja: string; en: string };

/** How the source relates to the structure (review 2026-11-03), worded for the site at hand. */
function relationText(r: ExistenceRow, E: Entities, targetId: string, name: Name, events: Ev[]): Name {
  const rel = r.relation;
  if (!rel) return { ja: "", en: "" };
  switch (rel.kind) {
    case "depicts":
      return { ja: `作品が${name.ja}を描いている`, en: `the work depicts ${name.en}` };
    case "observed_site": {
      const other = rel.entity !== targetId ? E.get(rel.entity)?.name : undefined;
      return other
        ? { ja: `書き手が観察したのは${other.ja}（${name.ja}ではない）`, en: `the writer observed ${other.en}, not ${name.en}` }
        : { ja: `書き手が${name.ja}を観察した`, en: `the writer observed ${name.en}` };
    }
    case "written_period":
      return { ja: "執筆の時期との照合", en: "matched against when it was written" };
    case "eyewitness_event":
      return events.find((e) => e.id === rel.event)?.event === "destroyed"
        ? { ja: "焼失そのものの回想", en: "a recollection of the fire itself" }
        : { ja: "出来事そのものの回想", en: "a recollection of the event itself" };
  }
}

const year = (e: Ev | undefined) => e?.time.start.slice(0, 4) ?? "?";

/** Why the structure was absent, from the events that bound the absent period (4.5.2). */
function absenceText(r: ExistenceRow, name: Name, events: Ev[], permanent: boolean): Name {
  const from = events.find((e) => r.period?.from.includes(e.id));
  const to = events.find((e) => r.period?.to.includes(e.id));
  const p = permanent ? { ja: "恒久的な", en: "the permanent " } : { ja: "", en: "" };
  if (from?.event === "destroyed" && to)
    return { ja: `${p.ja}${name.ja}は焼失後まだ再建されていなかった`, en: `${p.en}${name.en} had not yet been rebuilt after the fire` };
  if (from?.event === "destroyed") return { ja: `${p.ja}${name.ja}は焼失していた`, en: `${p.en}${name.en} had been destroyed` };
  if (!from && to?.event === "moved_in")
    return { ja: `${name.ja}はまだここに移されていなかった（${year(to)}年に移築）`, en: `${name.en} had not yet been moved here (moved in ${year(to)})` };
  if (!from && to) return { ja: `${name.ja}はまだ建てられていなかった（${year(to)}年に建造）`, en: `${name.en} had not yet been built (built in ${year(to)})` };
  return { ja: `${p.ja}${name.ja}はなかった`, en: `${p.en}${name.en} was not there` };
}

const DISPUTED: Record<string, Name> = {
  destroyed: { ja: "焼失日", en: "the date of the fire" },
  rebuilt: { ja: "再建・架け替えの日付", en: "the date of the rebuilding" },
  built: { ja: "建造の日付", en: "the date of construction" },
  moved_in: { ja: "移築の日付", en: "the date of the move" },
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
export function existenceThreads(rows: ExistenceRow[], E: Entities, targetId: string, events: Ev[] = []): Thread[] {
  const name = E.get(targetId)?.name ?? { ja: targetId, en: targetId };
  // "permanent" only where temporary structures stood in the interim (Kaminarimon)
  const permanent = events.some((e) => e.event === "temporary");
  return rows.map((r) => {
    const state = displayState({
      derivation: "derived",
      relations: ["supports"],
      allDependenciesPresent: Boolean(r.period) && r.timeEvidence.length > 0,
      existence: r.value,
    });
    const when = r.time?.start ? `${r.time.start.slice(0, 4)}` : "?";
    // Review 2026-11-03: say how the source relates to the structure, and that "absent/present"
    // comes from matching its time against the site's chronology (not from the source itself).
    const rel = relationText(r, E, targetId, name, events);
    const abs = absenceText(r, name, events, permanent);
    const disputed = DISPUTED[events.find((e) => e.id === r.disputedEvent)?.event ?? "destroyed"] ?? DISPUTED.destroyed;
    const label =
      r.value === "absent"
        ? {
            ja: `${r.sourceTitle}（${when}）のとき、${abs.ja}（${name.ja}の年表との照合${rel.ja ? `。${rel.ja}` : ""}）`,
            en: `When ${r.sourceTitle} was written (${when}), ${abs.en} (from the chronology of ${name.en}${rel.en ? `; ${rel.en}` : ""})`,
          }
        : r.value === "present"
          ? {
              ja: `${r.sourceTitle}（${when}）のとき、${name.ja}はあった（${rel.ja ? `${rel.ja}。` : ""}年表とも整合）`,
              en: `When ${r.sourceTitle} was made (${when}), ${name.en} stood (${rel.en ? `${rel.en}; ` : ""}consistent with the chronology)`,
            }
          : r.reason === "sources_disagree"
            ? {
                ja: `${r.sourceTitle}のとき：判定保留（${disputed.ja}が史料間で一致しない。${rel.ja}）`,
                en: `${r.sourceTitle}: judgment withheld (sources disagree on ${disputed.en}; ${rel.en})`,
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
