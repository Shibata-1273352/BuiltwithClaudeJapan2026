"use client";

/**
 * The first answer: the two questions a friend asks at the gate — "What does it say?" and "How long
 * has it been here?" — answered within seconds, before the story. The first is Claude's reading of
 * the photo (streamed); the second is code, from the reviewed timeline (sinceWhen). Each says who
 * answered. At a place with no timeline, the second says so.
 */
import { AnimatePresence, m } from "motion/react";
import type { LiveState } from "@/lib/live/state";
import { sinceWhen, type TimelineData } from "@/lib/time-river";
import { dict, useDict, useLang } from "../i18n";

const L = dict({
  ja: {
    q1: "これ、なんて書いてあるの？",
    q2: "いつからあるの？",
    byClaude: "Claude が写真から読んだ",
    byCode: "年表との照合（コード）",
    reading: "読んでいます",
    checking: "年表を照合しています",
    noTimeline: "この場所の年表はまだ持っていません。",
    noText: "この写真に読める文字は写っていません。",
  },
  en: {
    q1: "What does it say?",
    q2: "How long has it been here?",
    byClaude: "read from the photo by Claude",
    byCode: "checked against the timeline (code)",
    reading: "reading",
    checking: "checking the timeline",
    noTimeline: "There is no timeline for this place yet.",
    noText: "There is no writing to read in this photo.",
  },
});

export function FirstAnswer({ s }: { s: LiveState }) {
  const l = useDict(L);
  const lang = useLang();
  const els = s.see?.elements ?? s.seeProgress?.elements ?? [];
  // the writing that dominates the photo (the lantern's 風雷神門, not the donor's plate)
  const main = els
    .filter((e) => e.text_original)
    .map((e) => ({ e, area: e.box ? e.box.w * e.box.h : 0 }))
    .sort((a, b) => b.area - a.area)[0]?.e;
  const tl = s.timeline as TimelineData | undefined;
  const now = tl?.periods.length ? Math.max(...tl.periods.map((p) => Number(p.end.slice(0, 4)))) : 0;
  const since = tl ? sinceWhen(tl, now) : null;
  const placeKnown = s.place !== undefined;
  if (!s.stages.see) return null;
  return (
    <section className="flex flex-col gap-4" data-testid="first-answer" aria-live="polite">
      <div>
        <p className="label">{l.q1}</p>
        <AnimatePresence mode="wait">
          {main ? (
            <m.div key="a1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-serif text-title" lang="ja">
                  {main.text_original}
                </span>
                {main.reading && <span className="font-serif text-small text-muted italic">{main.reading}</span>}
              </p>
              {main.meaning && <p className="font-serif text-body text-paper/90">{main.meaning[lang]}</p>}
              <p className="mt-0.5 text-caption text-lantern">{l.byClaude}</p>
            </m.div>
          ) : s.see ? (
            <p key="n1" className="mt-1 text-small text-muted">
              {l.noText}
            </p>
          ) : (
            <p key="w1" className="shimmer mt-1 rounded-sm text-small text-muted">
              {l.reading}
            </p>
          )}
        </AnimatePresence>
      </div>
      <div>
        <p className="label">{l.q2}</p>
        <AnimatePresence mode="wait">
          {since ? (
            <m.div key="a2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1" data-testid="since-when">
              <p className="font-serif text-title leading-tight tabular-nums">{since.since}</p>
              <p className="mt-0.5 font-serif text-small text-paper/85">{since.label[lang]}</p>
              <p className="mt-0.5 text-caption text-muted">{l.byCode}</p>
            </m.div>
          ) : placeKnown && (s.place === null || tl) ? (
            <p key="n2" className="mt-1 text-small text-muted">
              {l.noTimeline}
            </p>
          ) : (
            <p key="w2" className="shimmer mt-1 rounded-sm text-small text-muted">
              {l.checking}
            </p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
