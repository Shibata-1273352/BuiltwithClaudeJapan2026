/**
 * Choreography (6.3): when each arrived event is allowed to show. Events can arrive in bursts (ten
 * `candidates` in one millisecond) or almost at once (a replay shortens waits), so each beat gets a
 * minimum hold before the next one, and threads wait until the existence judgment has been shown —
 * the broken thread must come after the reason for the break. Reduced motion: no holds.
 */
export type Arrival = { seq: number; type: string; at: number };

/** How long a beat of this type holds the stage before the next one may start (ms). */
export const HOLD: Record<string, number> = {
  // trimmed 2026-11-03 once the backend got ~2.5x faster: holds pace the beats, they must not add seconds
  see: 900, // boxes draw in (most already arrived while streaming)
  place: 800, // the big title
  candidates: 90, // light points, staggered
  gap: 800, // Claude's judgment starts typing
  claims: 250,
  visual: 1000, // the print wipes onto the photo
  existence: 500,
  timeline: 200,
  threads: 900, // threads grow, one breaks
  narrative: 250,
  associations: 400,
};
const DEFAULT_HOLD = 120;
/** The scan sweep shows at least this long after the first event, even when the see call is fast. */
export const MIN_SEE_SWEEP = 1800;

export function scheduleBeats(arrivals: Arrival[], { reduced = false }: { reduced?: boolean } = {}): Map<number, number> {
  const out = new Map<number, number>();
  const sorted = [...arrivals].sort((a, b) => a.seq - b.seq);
  if (reduced) {
    for (const a of sorted) out.set(a.seq, a.at);
    return out;
  }
  const t0 = sorted[0]?.at ?? 0;
  let free = t0; // when the stage is free for the next beat
  let existenceShown = Number.NEGATIVE_INFINITY;
  for (const a of sorted) {
    let show = Math.max(a.at, free);
    if (a.type === "see") show = Math.max(show, t0 + MIN_SEE_SWEEP);
    if (a.type === "threads") show = Math.max(show, existenceShown + (HOLD.existence ?? 0));
    out.set(a.seq, show);
    if (a.type === "existence") existenceShown = show;
    // bookkeeping and live progress do not occupy the stage
    if (a.type !== "stage" && a.type !== "ai_call" && a.type !== "received" && a.type !== "see_progress" && a.type !== "narrative_progress") free = show + (HOLD[a.type] ?? DEFAULT_HOLD);
  }
  return out;
}
