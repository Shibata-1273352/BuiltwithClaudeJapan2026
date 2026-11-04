"use client";

/** The one legend of the loom's three kinds of thread (CLAUDE.md design 5: said once). */
import { dict, useDict } from "../i18n";
import { Pencil } from "./marks";

const L = dict({
  ja: {
    q: [
      { c: "var(--thread-toki)", k: "時", m: "いつ" },
      { c: "var(--thread-ba)", k: "場", m: "どこ・何" },
      { c: "var(--thread-koto)", k: "言", m: "何と書かれたか" },
      { c: "var(--thread-ma)", k: "間", m: "昔といまのあいだ（描いた作品）" },
    ],
    ink: "一本＝原文",
    cut: "切れ＝その年はなかった",
    guide: "ガイド",
    guideMeans: "Claude の解説",
    pencil: "鉛筆",
    pencilMeans: "解釈・類似・連想",
    tail: "ガイドと鉛筆は根拠ではありません。",
  },
  en: {
    q: [
      { c: "var(--thread-toki)", k: "Time", m: "when" },
      { c: "var(--thread-ba)", k: "Place", m: "where, what" },
      { c: "var(--thread-koto)", k: "Words", m: "what was written" },
      { c: "var(--thread-ma)", k: "Between", m: "then and now (a work that depicts it)" },
    ],
    ink: "a strand = the source's own words",
    cut: "cut = it did not exist that year",
    guide: "Guide",
    guideMeans: "Claude's explanation",
    pencil: "Pencil",
    pencilMeans: "interpretation, likeness, association",
    tail: "Guide and pencil are not evidence.",
  },
});

/** Colour is the question (時・場・言・間); the line is how sure. Said once per view. */
export function LoomLegend() {
  const l = useDict(L);
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted" data-testid="pencil-legend">
      {l.q.map((q) => (
        <span key={q.k} className="inline-flex items-center gap-1.5">
          <svg width="14" height="4" aria-hidden>
            <path d="M0 2 H14" stroke={q.c} strokeWidth="2" />
          </svg>
          <span className="text-paper">{q.k}</span> {q.m}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <path d="M0 2 H8 M12 2 H20" stroke="var(--paper)" strokeOpacity="0.8" strokeWidth="1.5" />
        </svg>
        {l.ink} · {l.cut}
      </span>
      <span className="present-hide inline-flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <path d="M0 2 H20" stroke="var(--paper)" strokeOpacity="0.55" strokeWidth="1" />
        </svg>
        <span className="text-paper">{l.guide}</span> {l.guideMeans}
      </span>
      <span className="present-hide inline-flex items-center gap-1.5">
        <Pencil>{l.pencil}</Pencil> {l.pencilMeans}
      </span>
      <span>{l.tail}</span>
    </p>
  );
}

/** The guide mark next to a guide note (the legend explains it). */
export function GuideMark() {
  const l = useDict(L);
  return <span className="shrink-0 rounded-sm border border-paper/30 px-1 text-caption leading-5 whitespace-nowrap text-paper/80">{l.guide} · Claude</span>;
}
