/**
 * The run as a thread (pure): when each Claude call was in flight, from the run's own timestamps, and the
 * spatial stage beside it. Seconds from the first call. Calls that have left but not returned stay open.
 */
import type { LiveState } from "./state";

export type Weave = { spans: { start: number; end: number | null }[]; space: { end: number | null; ok: boolean } | null };

export function weaveOf(s: Pick<LiveState, "calls" | "started" | "stages" | "space">): Weave {
  const done = s.calls.filter((c) => c.startedAt);
  const closed = new Map(done.map((c) => [c.startedAt, c]));
  const open = s.started.filter((c) => !closed.has(c.startedAt));
  const all = [...done.map((c) => Date.parse(c.startedAt)), ...open.map((c) => Date.parse(c.startedAt))];
  const t0 = all.length ? Math.min(...all) : 0;
  const rel = (iso: string) => (Date.parse(iso) - t0) / 1000;
  const stage = s.stages.space;
  return {
    spans: [...done.map((c) => ({ start: rel(c.startedAt), end: rel(c.startedAt) + c.elapsedMs / 1000 })), ...open.map((c) => ({ start: rel(c.startedAt), end: null }))].sort((a, b) => a.start - b.start),
    space: stage ? { end: stage.ms === undefined ? null : stage.ms / 1000, ok: s.space?.ok !== false } : null,
  };
}

/** How many calls were in flight at `t` seconds. */
export const inFlight = (w: Weave, t: number): number => w.spans.filter((c) => c.start <= t && (c.end === null || t < c.end)).length;

/** How many calls had left by `t` seconds. */
export const leftBy = (w: Weave, t: number): number => w.spans.filter((c) => c.start <= t).length;
