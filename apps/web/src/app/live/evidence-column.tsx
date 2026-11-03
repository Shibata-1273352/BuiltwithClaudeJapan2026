"use client";

/** The evidence column (6.2): one card per source, appearing as it is found, then judged. */
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { EXIST_LABEL, FACET_LABEL, LAYER_COLOR, STATE_LABEL } from "./labels";

const T = dict({
  ja: { evidence: "根拠", title: "根拠となる資料", n: (n: number) => `${n} 節`, matrix: "観点×言語の検索", ja: "日本語", en: "英語", none: "見つからず", searching: "日英の資料を探しています。", before: "写真を読み終えたら、日英の資料を探します。", pub: "刊行・公開年（この場所の記述の年ではない）", time: "この場所について書かれた年", pubMark: " 刊", jaMark: "日", enMark: "英", kept: "採用", down: "格下げ", more: (n: number) => `すべての資料を見る（${n}）` },
  en: { evidence: "Evidence", title: "Sources", n: (n: number) => `${n} passages`, matrix: "Search by topic and language", ja: "Japanese", en: "English", none: "none found", searching: "Searching Japanese and English sources.", before: "Once the photo is read, Japanese and English sources are searched.", pub: "year published (not the year this place was described)", time: "the year this place was written about", pubMark: " pub.", jaMark: "ja", enMark: "en", kept: "kept", down: "downgraded", more: (n: number) => `See all sources (${n})` },
});


export function EvidenceColumn({
  s,
  cards,
  register,
  hot,
  setHot,
}: {
  s: LiveState;
  cards: SourceCard[];
  register: (id: string) => (el: HTMLElement | null) => void;
  hot: string | null;
  setHot: (id: string | null) => void;
}) {
  const searched = s.stages.retrieve !== undefined || s.stages.plan !== undefined;
  const t = useDict(T);
  const [allOnPhone, setAllOnPhone] = useState(false);
  const ui = useLang();
  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label={t.evidence} data-testid="evidence-column">
      <div className="flex items-baseline justify-between">
        <h2 className="label">{t.title}</h2>
        <span className="text-caption text-muted tabular-nums">{t.n(new Set(s.candidates.map((c) => c.passageId)).size)}</span>
      </div>
      {/* what was searched, in one line: topic × language, "none" struck through */}
      <p className="present-hide flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted" data-testid="search-matrix" aria-label={t.matrix}>
        {(["en", "ja"] as const).flatMap((lang) =>
          Object.keys(FACET_LABEL[ui]).map((f) => {
            const g = [...s.candidateGroups].reverse().find((x) => x.facet === f && x.lang === lang);
            if (!g) return searched ? <span key={lang + f} className="shimmer inline-block h-4 w-16 rounded-sm" /> : null;
            return (
              <span key={lang + f} className={g.notFound ? "line-through decoration-muted/60" : ""}>
                <span className="text-paper/80">{lang === "ja" ? t.jaMark : t.enMark}</span> {FACET_LABEL[ui][f]}
                {g.notFound ? "" : ` ${g.found}`}
              </span>
            );
          }),
        )}
      </p>
      {cards.length === 0 && <p className="font-serif text-body text-muted">{searched ? t.searching : t.before}</p>}
      <ul className={`fade-end flex min-h-[50%] flex-1 flex-col overflow-y-auto pr-1 pb-10 ${allOnPhone ? "" : "max-lg:[&>li:nth-child(n+3)]:hidden"}`}>
        <AnimatePresence initial={false}>
          {cards.map((c) => {
            const color = c.layer ? LAYER_COLOR[c.layer] : "var(--muted)";
            const broken = c.state === "absent";
            return (
              <m.li
                key={c.sourceId}
                ref={register(c.sourceId)}
                layout="position"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: hot && hot !== c.sourceId ? 0.4 : 1, x: 0 }}
                transition={{ duration: 0.35 }}
                onMouseEnter={() => setHot(c.sourceId)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(c.sourceId)}
                onBlur={() => setHot(null)}
                tabIndex={0}
                className={`relative border-b border-rule py-3 pr-1 pl-4 outline-none focus-visible:bg-paper/5 ${hot === c.sourceId ? "bg-paper/5" : ""}`}
                style={{ borderLeft: `2px ${c.state === "pending" ? "dashed" : "solid"} ${color}` }}
                data-testid="evidence-card"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-serif text-body" lang={c.lang}>
                    {c.title}
                  </span>
                  {c.year && (
                    <span className={`font-serif text-body tabular-nums ${c.yearKind === "published" ? "text-muted" : "text-paper"}`} title={c.yearKind === "published" ? t.pub : t.time}>
                      {c.year}
                      {c.yearKind === "published" ? t.pubMark : ""}
                    </span>
                  )}
                  <span className="text-caption text-muted">{c.lang === "ja" ? t.jaMark : t.enMark}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-small text-paper/70" lang={c.lang}>
                  {c.excerpt}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-caption text-muted">
                  {c.existence && (
                    <span className={c.existence.value === "absent" ? "font-medium text-paper" : ""}>
                      {EXIST_LABEL[ui][c.existence.value]}
                    </span>
                  )}
                  {c.state && (
                    <span className={`inline-flex items-center gap-1.5 ${broken ? "text-paper" : ""}`}>
                      <svg width="16" height="4" aria-hidden>
                        <path d={broken ? "M0 2 H6 M10 2 H16" : "M0 2 H16"} stroke={color} strokeWidth="2" strokeDasharray={c.state === "pending" ? "3 2" : undefined} />
                      </svg>
                      {STATE_LABEL[ui][c.state] ?? c.state}
                    </span>
                  )}
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {/* on a phone: two sources, the rest on request (no long scroll) */}
      {!allOnPhone && cards.length > 2 && (
        <button type="button" onClick={() => setAllOnPhone(true)} className="min-h-11 self-start text-small text-muted underline underline-offset-4 lg:hidden" data-testid="evidence-more">
          {t.more(cards.length)}
        </button>
      )}
    </section>
  );
}
