"use client";

/**
 * The loom's threads with a body (6.3 + Loom). Silk threads run from each object to its guide note
 * (Claude's explanation); ink cords run from the photo through the source's year to its evidence
 * card. They sag, swing when plucked, follow a dragged object, and the cord of an absent source is
 * cut at its year and falls, hanging from its card. One rAF loop; paths are written straight to the
 * DOM (no React state per frame); ropes sleep when still. Reduced motion: still curves.
 */
import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { Rope, type Pt } from "@/lib/live/rope";
import { yearFrac } from "./labels";
import { AXIS_PAD } from "./year-axis";

export type RopeSpec = {
  id: string;
  from: string; // anchor key, e.g. "obj:lantern"
  to: string; // "card:<source>" | "guide:<seeIndex>"
  kind: "silk" | "ink";
  color: string;
  /** ink: the cord passes through this year on the axis */
  year?: number | null;
  /** ink: absent source — the cord is cut at the year */
  cut?: boolean;
  dashed?: boolean;
  /** ms after the threads beat when this rope appears (stagger) */
  at: number;
};

type Live = { spec: RopeSpec; ropes: Rope[]; els: SVGPathElement[]; grown: boolean; cutDone: boolean };

/** Where a thread attaches to an element: objects at their center, cards at the edge facing the photo. */
function attach(key: string, el: HTMLElement, origin: DOMRect): Pt {
  const r = el.getBoundingClientRect();
  if (key.startsWith("card:")) return { x: r.left - origin.left, y: r.top - origin.top + Math.min(r.height / 2, 28) };
  if (key.startsWith("guide:")) return { x: r.right - origin.left, y: r.top - origin.top + Math.min(r.height / 2, 28) };
  return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2 };
}

export function RopeLayer({
  stageRef,
  anchors,
  axisRef,
  specs,
  since,
  hot,
  reduced,
  pluckRef,
}: {
  stageRef: RefObject<HTMLElement | null>;
  anchors: RefObject<Map<string, HTMLElement>>;
  axisRef: RefObject<HTMLElement | null>;
  specs: RopeSpec[];
  /** ms since the threads beat (negative: none yet) */
  since: number;
  hot: string | null;
  reduced: boolean;
  /** set by this layer: pluck every rope hanging from an object; returns their total length */
  pluckRef: MutableRefObject<(objKey: string) => number>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef(new Map<string, Live>());
  const sinceRef = useRef(since);
  const specKey = useMemo(() => specs.map((s) => `${s.id}|${s.from}|${s.to}|${s.cut ? 1 : 0}`).join(","), [specs]);
  const specsRef = useRef(specs);
  useEffect(() => {
    sinceRef.current = since;
    specsRef.current = specs;
  }, [since, specs]);

  useEffect(() => {
    pluckRef.current = (objKey: string) => {
      let total = 0;
      for (const l of live.current.values()) {
        if (l.spec.from !== `obj:${objKey}`) continue;
        l.ropes[0]?.pluck(16);
        total += l.ropes.reduce((a, r) => a + r.length(), 0);
      }
      return total;
    };
  }, [pluckRef]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const stage = stageRef.current;
      const svg = svgRef.current;
      if (!stage || !svg || !axisRef.current?.offsetParent) return; // hidden on phones
      const dt = now - last;
      last = now;
      const origin = stage.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${origin.width} ${origin.height}`);
      svg.setAttribute("width", String(origin.width));
      svg.setAttribute("height", String(origin.height));
      const axis = axisRef.current.getBoundingClientRect();
      const axisX = axis.left - origin.left + axis.width / 2;
      const yearY = (y: number) => axis.top - origin.top + AXIS_PAD + (axis.height - 2 * AXIS_PAD) * yearFrac(y);
      for (const spec of specsRef.current) {
        const a = anchors.current.get(spec.from);
        const b = anchors.current.get(spec.to);
        const l = live.current.get(spec.id);
        if (!a || !b || sinceRef.current < spec.at) {
          if (l) l.els.forEach((e) => e.classList.remove("on"));
          continue;
        }
        const pa = attach(spec.from, a, origin);
        const pb = attach(spec.to, b, origin);
        // a card scrolled out of its column: no thread to it
        const visible = pb.y > 0 && pb.y < origin.height;
        const mid = spec.kind === "ink" ? (spec.year ? { x: axisX, y: yearY(spec.year) } : { x: axisX, y: (pa.y + pb.y) / 2 }) : null;
        const ends: [Pt, Pt][] = mid ? [[pa, mid], [mid, pb]] : [[pa, pb]];
        let cur = l;
        if (!cur) {
          const els = [...svg.querySelectorAll<SVGPathElement>(`path[data-rope="${CSS.escape(spec.id)}"]`)];
          if (!els.length) continue; // rendered next frame
          cur = { spec, ropes: ends.map(([p, q]) => new Rope(p, q, { n: mid ? 10 : 14 })), els, grown: false, cutDone: false };
          live.current.set(spec.id, cur);
        }
        cur.spec = spec;
        cur.ropes.forEach((r, i) => r.setEnds(i === 1 && cur!.cutDone ? null : ends[i][0], ends[i][1]));
        if (spec.cut && !cur.cutDone && sinceRef.current > spec.at + 1100 && cur.ropes[1]) {
          cur.ropes[1].cut(); // the year lets go: the cord falls and hangs from its card
          cur.cutDone = true;
        }
        if (!spec.cut && cur.cutDone) {
          // reconnected (the time scrub moved to a present year): rebuild the cord
          cur.ropes[1] = new Rope(ends[1][0], ends[1][1], { n: 10 });
          cur.cutDone = false;
        }
        const ds = cur.ropes.map((r) => {
          if (reduced) {
            const p = r.pts[0];
            const q = r.pts[r.pts.length - 1];
            const sag = Math.min(40, Math.hypot(q.x - p.x, q.y - p.y) * 0.08);
            return `M ${p.x} ${p.y} Q ${(p.x + q.x) / 2} ${(p.y + q.y) / 2 + sag} ${q.x} ${q.y}`;
          }
          r.step(dt);
          return r.path();
        });
        // each rope has its paths (core + sheen for ink); React never sets d or class on them
        cur.els.forEach((el) => {
          const i = Number(el.dataset.part ?? 0);
          el.setAttribute("d", ds[i] ?? ds[0]);
          el.classList.toggle("on", visible);
        });
        cur.grown = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stageRef, anchors, axisRef, reduced, specKey]);

  // forget ropes whose spec disappeared
  useEffect(() => {
    const ids = new Set(specs.map((s) => s.id));
    for (const id of [...live.current.keys()]) if (!ids.has(id)) live.current.delete(id);
  }, [specKey, specs]);

  return (
    <svg ref={svgRef} className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-hidden data-testid="rope-layer">
      {specs.map((s) => {
        const dim = hot && !s.id.includes(hot) ? 0.15 : 1;
        const parts = s.kind === "ink" ? [0, 1] : [0];
        return (
          <g key={s.id} style={{ opacity: dim, transition: "opacity 200ms" }} data-kind={s.kind} data-cut={s.cut ? "1" : undefined} className={s.kind === "ink" ? "glow" : undefined}>
            {parts.map((part) =>
              s.kind === "ink" ? (
                <g key={part}>
                  <path data-rope={s.id} data-part={part} pathLength={1} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={s.dashed ? "0.02 0.015" : undefined} />
                  {/* the twist of a cord: a thin light strand along it */}
                  <path data-rope={s.id} data-part={part} pathLength={1} fill="none" stroke="var(--paper)" strokeOpacity={0.35} strokeWidth={0.7} strokeDasharray="0.006 0.006" />
                </g>
              ) : (
                <path key={part} data-rope={s.id} data-part={part} pathLength={1} fill="none" stroke={s.color} strokeWidth={1} strokeOpacity={0.55} />
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}
