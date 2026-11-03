"use client";

/**
 * Threads (6.3): one SVG over the whole stage. Each source's thread leaves the photo, passes
 * through the year it was written on the axis, and ends at its card. Line style = state: ink
 * (solid), knot (combined), pending (dashed), absent — it grows, then snaps at the axis (600 ms):
 * in that year the thing was not there. A discovery, not a failure.
 */
import { m } from "motion/react";
import { useEffect, useState, type RefObject } from "react";
import type { SourceCard } from "@/lib/live/state";
import { LAYER_COLOR, yearFrac } from "./labels";
import { AXIS_PAD } from "./year-axis";

type Pt = { x: number; y: number };
type Geom = { w: number; h: number; a: Pt; axisX: number; axisTop: number; axisH: number; cards: Record<string, Pt> };

function measure(stage: HTMLElement, anchor: HTMLElement | null, axis: HTMLElement | null, cards: Map<string, HTMLElement>): Geom | null {
  if (!anchor || !axis) return null;
  const r = stage.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const x = axis.getBoundingClientRect();
  const out: Geom = { w: r.width, h: r.height, a: { x: a.left - r.left, y: a.top - r.top }, axisX: x.left - r.left + x.width / 2, axisTop: x.top - r.top + AXIS_PAD, axisH: x.height - 2 * AXIS_PAD, cards: {} };
  for (const [id, el] of cards) {
    const c = el.getBoundingClientRect();
    if (c.height === 0) continue;
    const y = c.top - r.top + c.height / 2;
    if (y < 0 || y > r.height) continue; // scrolled out of the column
    out.cards[id] = { x: c.left - r.left, y };
  }
  return out;
}

const round = (g: Geom | null) => JSON.stringify(g, (_k, v) => (typeof v === "number" ? Math.round(v) : v));

export function ThreadLayer({
  stageRef,
  anchorRef,
  axisRef,
  cardEls,
  cards,
  since,
  hot,
}: {
  stageRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
  axisRef: RefObject<HTMLElement | null>;
  cardEls: RefObject<Map<string, HTMLElement>>;
  cards: SourceCard[];
  /** ms since the threads beat (negative: not yet) */
  since: number;
  hot: string | null;
}) {
  const [g, setG] = useState<Geom | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let prev = "";
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 100 || !stageRef.current) return;
      last = t;
      const next = measure(stageRef.current, anchorRef.current, axisRef.current, cardEls.current);
      const key = round(next);
      if (key !== prev) {
        prev = key;
        setG(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stageRef, anchorRef, axisRef, cardEls]);

  if (!g || since < 0) return null;
  const threaded = cards.filter((c) => c.state && g.cards[c.sourceId]);
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 hidden lg:block" width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden data-testid="thread-layer">
      {threaded.map((c, i) => {
        const end = g.cards[c.sourceId];
        const color = LAYER_COLOR[c.layer ?? "koto"];
        const mid: Pt = c.year ? { x: g.axisX, y: g.axisTop + g.axisH * yearFrac(c.year) } : { x: g.axisX, y: (g.a.y + end.y) / 2 };
        const seg1 = `M ${g.a.x} ${g.a.y} C ${g.a.x + (mid.x - g.a.x) * 0.6} ${g.a.y}, ${mid.x - 40} ${mid.y}, ${mid.x} ${mid.y}`;
        const seg2 = `M ${mid.x} ${mid.y} C ${mid.x + 60} ${mid.y}, ${end.x - 60} ${end.y}, ${end.x} ${end.y}`;
        const delay = i * 0.14;
        const grown = since > (delay + 0.9) * 1000;
        const broken = c.state === "absent";
        const snapped = broken && since > (delay + 0.9) * 1000 + 350;
        const dash = c.state === "pending" ? "6 6" : c.state === "pencil" ? "2 5" : undefined;
        const dim = hot && hot !== c.sourceId ? 0.18 : 1;
        return (
          <g key={c.sourceId} className="glow" style={{ color, opacity: dim, transition: "opacity 200ms" }} data-state={c.state}>
            <m.path d={seg1} fill="none" stroke={color} strokeWidth={hot === c.sourceId ? 2.6 : 1.7} strokeDasharray={dash} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay }} />
            <m.path
              d={seg2}
              fill="none"
              stroke={color}
              strokeWidth={hot === c.sourceId ? 2.6 : 1.7}
              strokeDasharray={dash}
              initial={{ pathLength: 0 }}
              animate={snapped ? { pathLength: 0.42, opacity: 0.35, y: 18, rotate: 4 } : { pathLength: 1, opacity: 1, y: 0, rotate: 0 }}
              style={{ transformOrigin: `${end.x}px ${end.y}px` }}
              transition={snapped ? { duration: 0.6, ease: [0.3, 1.4, 0.6, 1] } : { duration: 0.45, delay: delay + 0.45 }}
            />
            {/* knot = combined evidence */}
            {c.state === "combined" && grown && <circle cx={mid.x} cy={mid.y} r={4.5} fill={color} />}
            {snapped && (
              <m.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }} style={{ transformOrigin: `${mid.x}px ${mid.y}px` }}>
                <circle cx={mid.x} cy={mid.y} r={7} fill="var(--ai-night)" stroke="var(--thread-ba)" strokeWidth={1.5} />
                <path d={`M ${mid.x - 3.5} ${mid.y - 3.5} L ${mid.x + 3.5} ${mid.y + 3.5} M ${mid.x + 3.5} ${mid.y - 3.5} L ${mid.x - 3.5} ${mid.y + 3.5}`} stroke="var(--thread-ba)" strokeWidth={1.6} />
              </m.g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
