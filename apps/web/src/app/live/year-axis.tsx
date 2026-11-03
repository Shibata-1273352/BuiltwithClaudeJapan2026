"use client";

/**
 * The year axis (6.2): sources light up at the year they were written; when the timeline arrives
 * it becomes the river band — solid where the thing stood, open where it did not.
 */
import { useLang } from "../i18n";
import { m } from "motion/react";
import type { Ref } from "react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { Dot } from "../ui/marks";
import { YEAR_MAX, YEAR_MIN, yearFrac, yearOf } from "./labels";

type Period = { state: string; start: string; end: string };
const TICKS = [1800, 1850, 1900, 1950, 2000];
const PAD = 16; // px above/below the band, matched in thread-layer

export const AXIS_PAD = PAD;

/** The year under a pointer on the axis. */
function yearAt(el: HTMLElement, clientY: number): number {
  const r = el.getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (clientY - r.top - PAD) / (r.height - 2 * PAD)));
  return Math.round(YEAR_MIN + f * (YEAR_MAX - YEAR_MIN));
}

export function YearAxis({
  s,
  cards,
  axisRef,
  scrub,
  onScrub,
  scrubLabel,
}: {
  s: LiveState;
  cards: SourceCard[];
  axisRef: Ref<HTMLDivElement>;
  /** the year the visitor dragged to (null: today, no handle shown yet) */
  scrub?: number | null;
  onScrub?: (y: number) => void;
  scrubLabel?: string;
}) {
  const lang = useLang();
  const tl = s.timeline as { periods?: Period[]; name?: { ja: string } } | undefined;
  const periods = tl?.periods ?? [];
  const pos = (y: number) => `calc(${PAD}px + (100% - ${2 * PAD}px) * ${yearFrac(y)})`;
  return (
    <div
      ref={axisRef}
      className={`relative h-full w-full touch-none transition-opacity duration-700 ${cards.length ? "opacity-100" : "opacity-0"} ${onScrub ? "cursor-ns-resize" : ""}`}
      data-testid="year-axis"
      aria-label={lang === "ja" ? "年の軸" : "Year axis"}
      onPointerDown={(e) => {
        if (!onScrub) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onScrub(yearAt(e.currentTarget, e.clientY));
      }}
      onPointerMove={(e) => {
        if (onScrub && e.buttons) onScrub(yearAt(e.currentTarget, e.clientY));
      }}
    >
      {/* spine */}
      <div className="absolute top-4 bottom-4 left-1/2 w-px -translate-x-1/2 bg-muted/30" />
      {onScrub && (
        <div
          role="slider"
          tabIndex={0}
          aria-label="年をめくる / Turn the years"
          aria-valuemin={YEAR_MIN}
          aria-valuemax={YEAR_MAX}
          aria-valuenow={scrub ?? 2026}
          aria-valuetext={scrubLabel}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 1;
            if (e.key === "ArrowUp") onScrub(Math.max(YEAR_MIN, (scrub ?? 2026) - step));
            else if (e.key === "ArrowDown") onScrub(Math.min(YEAR_MAX - 4, (scrub ?? 2026) + step));
            else return;
            e.preventDefault();
          }}
          className="absolute left-0 z-20 flex w-full -translate-y-1/2 items-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-lantern"
          style={{ top: pos(scrub ?? 2026) }}
          data-testid="time-handle"
        >
          <span className="h-[3px] w-full rounded-sm bg-lantern" />
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 font-serif text-lead whitespace-nowrap text-lantern tabular-nums">{scrub ?? 2026}</span>
        </div>
      )}
      {TICKS.map((y) => (
        <div key={y} className="absolute right-0 left-0 flex items-center" style={{ top: pos(y) }}>
          <span className="w-full -translate-y-1/2 pr-[calc(50%+10px)] text-right text-caption text-muted/50 tabular-nums">{y}</span>
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
            className={`absolute left-1/2 w-1.5 -translate-x-1/2 rounded-sm ${present ? "bg-toki/80" : "border border-dashed border-paper/40"}`}
            style={{ top: pos(a), height: `calc((100% - ${2 * PAD}px) * ${yearFrac(b) - yearFrac(a)})`, transformOrigin: "top" }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: i * 0.15 }}
            title={`${a}–${b} ${present ? (lang === "ja" ? "存在" : "there") : lang === "ja" ? "不在" : "not there"}`}
          >
            {!present && b - a > 30 && (
              <span className="absolute bottom-0 left-3 whitespace-nowrap text-caption leading-tight text-paper/80">
                {a}–{b}
                <br />
                {lang === "ja" ? "不在" : "not there"}
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
            className="absolute left-1/2 -translate-1/2"
            style={{ top: pos(c.year) }}
            initial={{ x: -180, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
            title={`${c.title}（${c.year}）`}
          >
            <Dot className={`block size-2 ${c.yearKind === "published" ? "border border-paper bg-night" : "bg-paper"}`} />
          </m.span>
        ) : null,
      )}
    </div>
  );
}
