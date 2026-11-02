/**
 * Existence rows for the retrieved sources (FR-15/16, RAG-05/06): what each source could have seen
 * of `place`, judged by code from the reviewed chronology. Shared by the DAG and the evaluation.
 */
import type { ExistenceRow } from "./dag/threads";
import { existenceFor, timeline } from "./timeline-server";

export function existenceRows(place: string, retrieved: { sourceId: string; sourceTitle: string }[]): ExistenceRow[] {
  const sources = [...new Set(retrieved.map((r) => r.sourceId))];
  return (
    sources
      .map((s): ExistenceRow => {
        const j = existenceFor(place, s);
        const title = retrieved.find((r) => r.sourceId === s)?.sourceTitle ?? s;
        return {
          source: s,
          sourceTitle: title,
          time: j.time ? { kind: j.time.kind, start: j.time.start, end: j.time.end ?? null, basis: j.time.basis } : null,
          value: j.value,
          reason: j.reason,
          period: "period" in j && j.period ? j.period : undefined,
          timeEvidence: j.time?.evidence ?? [],
          relation: j.relation,
          basis: j.basis,
          temporary: j.temporary,
          disputedEvent: "disputedEvent" in j ? j.disputedEvent : undefined,
        };
      })
      // sources without a known time are not judged; a work's depiction date says nothing about a
      // site it does not depict (Hiroshige's Asakusa print is no evidence about Ueno)
      .filter((r) => r.time && !(r.time.kind === "depicted_at" && !r.relation))
      // a place without a reviewed chronology (e.g. the river) is not judged at all
      .filter(() => timeline().periods.has(place))
  );
}
