"use client";

/** The one legend of the loom's three kinds of thread (CLAUDE.md design 5: said once). */
import { dict, useDict } from "../i18n";
import { Pencil } from "./marks";

const L = dict({
  ja: { ink: "インク", inkMeans: "資料の原文に裏付けられた糸", guide: "ガイド", guideMeans: "Claude の解説", pencil: "鉛筆", pencilMeans: "解釈・類似・連想", tail: "ガイドと鉛筆は根拠ではありません。" },
  en: { ink: "Ink", inkMeans: "backed by a source's own words", guide: "Guide", guideMeans: "Claude's explanation", pencil: "Pencil", pencilMeans: "interpretation, likeness, association", tail: "Guide and pencil are not evidence." },
});

export function LoomLegend() {
  const l = useDict(L);
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted" data-testid="pencil-legend">
      <span className="inline-flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <path d="M0 2 H20" stroke="var(--thread-toki)" strokeWidth="2" />
        </svg>
        <span className="text-paper">{l.ink}</span> {l.inkMeans}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <path d="M0 2 H20" stroke="var(--paper)" strokeOpacity="0.55" strokeWidth="1" />
        </svg>
        <span className="text-paper">{l.guide}</span> {l.guideMeans}
      </span>
      <span className="inline-flex items-center gap-1.5">
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
