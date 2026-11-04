"use client";

/**
 * The run as a thread, in real time, from the run's own timestamps: the upper thread is Claude, as thick
 * as the calls in flight at that moment; the lower one is the cut-out and depth stage beside it.
 */
import { inFlight, leftBy, weaveOf } from "@/lib/live/weave";
import type { LiveState } from "@/lib/live/state";
import { dict, useDict } from "../i18n";

const T = dict({
  ja: { now: (n: number) => `同時 ${n}`, total: (n: number) => `計 ${n} 回`, space: "切り抜き・奥行き", spaceOff: "切り抜き・奥行き（簡易表示）", aria: "AI の動き" },
  en: { now: (n: number) => `${n} at once`, total: (n: number) => `${n} calls`, space: "Cut-out and depth", spaceOff: "Cut-out and depth (simple view)", aria: "What the AIs are doing" },
});

const W = 1000;
const STEP = 3;
const SPAN = 30; // seconds across; a longer run compresses to fit
const MID = 13;
const PER_CALL = 2;

export function AiWeave({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const t = useDict(T);
  const w = weaveOf(s);
  const now = elapsed / 1000;
  const span = Math.max(SPAN, now);
  const edge = (Math.min(now, span) / span) * W;
  const bars = [];
  for (let x = 0; x < edge; x += STEP) {
    const n = inFlight(w, (x / W) * span);
    if (n) bars.push(<rect key={x} x={x} y={MID - (n * PER_CALL) / 2} width={STEP + 0.5} height={n * PER_CALL} />);
  }
  const spaceEnd = w.space ? Math.min(edge, ((w.space.end ?? now) / span) * W) : 0;
  return (
    <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex" data-testid="ai-weave" aria-label={t.aria} role="img">
      <div className="shrink-0 text-caption whitespace-nowrap tabular-nums">
        <p className="text-lantern">
          Claude {t.now(inFlight(w, now))} · {t.total(leftBy(w, now))}
        </p>
        <p className="text-muted">{w.space?.ok === false ? t.spaceOff : t.space}</p>
      </div>
      <svg viewBox={`0 0 ${W} 36`} preserveAspectRatio="none" className="h-9 min-w-0 flex-1" aria-hidden>
        <line x1={0} x2={W} y1={MID} y2={MID} stroke="var(--color-rule)" vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={edge} y1={MID} y2={MID} stroke="var(--lantern)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
                <g fill="var(--lantern)">{bars}</g>
        <line x1={0} x2={W} y1={32} y2={32} stroke="var(--color-rule)" vectorEffect="non-scaling-stroke" />
        {spaceEnd > 0 && <rect x={0} y={31} width={spaceEnd} height={2} fill="var(--muted)" />}
      </svg>
    </div>
  );
}
