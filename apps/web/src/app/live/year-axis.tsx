"use client";

/**
 * The year axis (6.2): sources light up at the year they were written; when the timeline arrives
 * it becomes the river band — solid where the thing stood, open where it did not.
 */
import { m } from "motion/react";
import type { Ref } from "react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { yearFrac, yearOf } from "./labels";

type Period = { state: string; start: string; end: string };
const TICKS = [1800, 1850, 1900, 1950, 2000];
const PAD = 16; // px above/below the band, matched in thread-layer

export const AXIS_PAD = PAD;

export function YearAxis({ s, cards, axisRef }: { s: LiveState; cards: SourceCard[]; axisRef: Ref<HTMLDivElement> }) {
  const tl = s.timeline as { periods?: Period[]; name?: { ja: string } } | undefined;
  const periods = tl?.periods ?? [];
  const pos = (y: number) => `calc(${PAD}px + (100% - ${2 * PAD}px) * ${yearFrac(y)})`;
  return (
    <div ref={axisRef} className="relative h-full w-full" data-testid="year-axis" aria-label="年の軸">
      {/* spine */}
      <div className="absolute top-4 bottom-4 left-1/2 w-px -translate-x-1/2 bg-muted/30" />
      {TICKS.map((y) => (
        <div key={y} className="absolute right-0 left-0 flex items-center" style={{ top: pos(y) }}>
          <span className="w-full -translate-y-1/2 pr-[calc(50%+10px)] text-right text-[10px] text-muted/70 tabular-nums">{y}</span>
        </div>
      ))}
      {/* the river: present = solid gold, absent = open */}
      {periods.map((p, i) => {
        const a = yearOf(p.start) ?? 0;
        const b = yearOf(p.end) ?? 2030;
        const present = p.state === "present";
        return (
          <m.div
            key={i}
            className={`absolute left-1/2 -translate-x-1/2 rounded-full ${present ? "w-2 bg-toki/80 shadow-[0_0_10px_var(--thread-toki)]" : "w-2 border border-dashed border-ba/70"}`}
            style={{ top: pos(a), height: `calc((100% - ${2 * PAD}px) * ${yearFrac(b) - yearFrac(a)})`, transformOrigin: "top" }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: i * 0.15 }}
            title={`${a}–${b} ${present ? "存在" : "不在"}`}
          >
            {!present && b - a > 30 && (
              <span className="absolute top-1/2 left-3 -translate-y-1/2 whitespace-nowrap text-[11px] text-ba">
                {a} 焼失
                <br />
                {b} 再建
              </span>
            )}
          </m.div>
        );
      })}
      {/* each source at its year */}
      {cards.map((c, i) =>
        c.year ? (
          <m.span
            key={c.sourceId}
            className="absolute left-1/2 size-2.5 -translate-1/2 rounded-full bg-lantern shadow-[0_0_8px_var(--lantern)]"
            style={{ top: pos(c.year) }}
            initial={{ x: -180, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
            title={`${c.title}（${c.year}）`}
          />
        ) : null,
      )}
    </div>
  );
}
