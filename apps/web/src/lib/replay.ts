/**
 * FR-47 記録の再生 (only when live fails, e.g. no signal on site): a stored exploration is streamed
 * again with its original pacing, so the demo looks the same — and the UI says "recording" the
 * whole time. Long waits (Claude calls) are shortened to `maxGapMs`.
 */
export type Timed = { seq: number; ts: string };

/** Delay before each event, in ms from the start of the replay. */
export function replaySchedule<T extends Timed>(events: T[], { maxGapMs = 4000, speed = 1 }: { maxGapMs?: number; speed?: number } = {}): { at: number; event: T }[] {
  let t = 0;
  return events.map((e, i) => {
    if (i > 0) {
      const gap = Math.max(0, Date.parse(e.ts) - Date.parse(events[i - 1].ts));
      t += Math.min(maxGapMs, gap) / Math.max(0.25, speed);
    }
    return { at: Math.round(t), event: e };
  });
}
