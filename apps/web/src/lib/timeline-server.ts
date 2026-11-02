import { readFileSync } from "node:fs";
import path from "node:path";
import { judgeExistence, periodsFrom, toRange, type ExistenceEvent, type Period, type TimeValue } from "@tsumugi/core";

type Timeline = {
  reviewed_by: string | null;
  existence_events: (ExistenceEvent & { original?: string })[];
  conflicts: { id: string; kind: string; about: string; sides: { value: string; evidence: string[] }[]; explanation: { ja: string; en: string } }[];
  source_times: { source: string; times: TimeValue[] }[];
};

let cached: { t: Timeline; periods: Map<string, Period[]> } | undefined;

function root(): string {
  return process.env.TSUMUGI_REPO_ROOT ?? path.resolve(process.cwd(), process.cwd().endsWith(path.join("apps", "web")) ? "../.." : ".");
}

export function timeline() {
  if (cached) return cached;
  const t = JSON.parse(readFileSync(path.join(root(), "corpus", "timeline.json"), "utf8")) as Timeline;
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

export function existenceFor(entityId: string, sourceId: string) {
  const periods = timeline().periods.get(entityId);
  const t = sourceTime(sourceId);
  if (!periods) return { value: "unknown" as const, reason: "no_data" as const, time: t };
  return { ...judgeExistence(periods, t ? toRange(t) : null), time: t };
}
