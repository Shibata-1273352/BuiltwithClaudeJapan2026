import { judgeExistence, periodsFrom, temporaryAt, toRange, type ExistenceEvent, type Period, type TimeValue } from "@tsumugi/core";
// Static import: the human-reviewed timeline is part of the build (no runtime filesystem lookup).
import timelineJson from "../../../../corpus/timeline.json";

type Timeline = {
  reviewed_by: string | null;
  reviewed_at?: string;
  existence_events: (ExistenceEvent & { original?: string })[];
  conflicts: { id: string; kind: string; about: string; sides: { value: string; evidence: string[] }[]; explanation: { ja: string; en: string } }[];
  source_times: { source: string; times: TimeValue[] }[];
};

let cached: { t: Timeline; periods: Map<string, Period[]> } | undefined;

export function timeline() {
  if (cached) return cached;
  const t = timelineJson as unknown as Timeline;
  const byEntity = new Map<string, ExistenceEvent[]>();
  for (const e of t.existence_events) byEntity.set(e.entity, [...(byEntity.get(e.entity) ?? []), e]);
  const periods = new Map([...byEntity].map(([k, v]) => [k, periodsFrom(v)]));
  cached = { t, periods };
  return cached;
}

/**
 * The time used to judge what a source could have seen: observed > depicted > written.
 * Publication dates are NOT used: they only bound the observation from above (Scidmore 1891 says
 * nothing about whether she saw the gate before 1866), so such sources stay out of the judgment.
 */
export function sourceTime(sourceId: string): TimeValue | null {
  const s = timeline().t.source_times.find((x) => x.source === sourceId);
  if (!s) return null;
  for (const k of ["observed_at", "depicted_at", "written_at"] as const) {
    const v = s.times.find((t) => t.kind === k && t.precision !== "unknown");
    if (v) return v;
  }
  return null;
}

export type SourceRelation = { kind: "depicts" | "observed_site" | "written_period" | "eyewitness_event"; entity: string; evidence: string[]; note?: string };

export function sourceRelation(sourceId: string): SourceRelation | null {
  return (timeline().t.source_times.find((x) => x.source === sourceId) as { relation_to_subject?: SourceRelation } | undefined)?.relation_to_subject ?? null;
}

/**
 * Existence of the PERMANENT structure at the source's time (a chronology-based inference, not a
 * statement of the source), plus the temporary-gate status judged separately, plus how the source
 * relates to the structure (depicts / observed the site / only written then / eyewitness of the event).
 */
export function existenceFor(entityId: string, sourceId: string) {
  const { periods, t: tl } = timeline();
  const p = periods.get(entityId);
  const t = sourceTime(sourceId);
  const events = tl.existence_events.filter((e) => e.entity === entityId);
  const range = t ? toRange(t) : null;
  const base = p ? judgeExistence(p, range, events) : { value: "unknown" as const, reason: "no_data" as const };
  return { ...base, time: t, temporary: temporaryAt(events, range), relation: sourceRelation(sourceId), basis: "chronology" as const };
}
