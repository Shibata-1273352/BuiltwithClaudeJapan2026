"use client";

/** The evidence column (6.2): one card per source, appearing as it is found, then judged. */
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { AssociationThreads } from "./association-threads";
import { dict, useDict, useLang } from "../i18n";
import { EXIST_LABEL, FACET_LABEL, LAYER_COLOR, STATE_LABEL } from "./labels";

const T = dict({
  ja: { evidence: "根拠", title: "根拠となる資料", n: (n: number) => `${n} 節`, matrix: "観点×言語の検索", ja: "日本語", en: "英語", none: "見つからず", searching: "日英の資料を探しています。", before: "写真を読み終えたら、日英の資料を探します。", pub: "刊行・公開年（この場所の記述の年ではない）", time: "この場所について書かれた年", pubMark: " 刊", jaMark: "日", enMark: "英", kept: "採用", down: "格下げ" },
  en: { evidence: "Evidence", title: "Sources", n: (n: number) => `${n} passages`, matrix: "Search by topic and language", ja: "Japanese", en: "English", none: "none found", searching: "Searching Japanese and English sources.", before: "Once the photo is read, Japanese and English sources are searched.", pub: "year published (not the year this place was described)", time: "the year this place was written about", pubMark: " pub.", jaMark: "ja", enMark: "en", kept: "kept", down: "downgraded" },
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
  const ui = useLang();
  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label={t.evidence} data-testid="evidence-column">
      <div className="flex items-baseline justify-between">
        <h2 className="label">{t.title}</h2>
        <span className="text-caption text-muted tabular-nums">{t.n(new Set(s.candidates.map((c) => c.passageId)).size)}</span>
      </div>
      <table className="w-full table-fixed border-y border-rule text-caption" data-testid="search-matrix" aria-label={t.matrix}>
        <thead>
          <tr className="text-muted">
            <th className={`${ui === "ja" ? "w-14" : "w-24"} py-1.5 pl-4 text-left font-normal`} />
            {Object.values(FACET_LABEL[ui]).map((f) => (
              <th key={f} className="py-1.5 text-left font-normal">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["en", "ja"] as const).map((lang) => (
            <tr key={lang} className="border-t border-rule">
              <td className="py-1.5 pl-4 text-muted">{lang === "ja" ? t.ja : t.en}</td>
              {Object.keys(FACET_LABEL[ui]).map((f) => {
                const g = [...s.candidateGroups].reverse().find((x) => x.facet === f && x.lang === lang);
                return (
                  <td key={f} className="py-1.5">
                    <span className={`block h-5 tabular-nums transition-colors duration-500 ${g ? (g.notFound ? "text-muted line-through decoration-muted/60" : "text-paper") : searched ? "shimmer w-10 rounded-sm" : ""}`}>
                      {g ? (g.notFound ? t.none : t.n(g.found)) : ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length === 0 && <p className="font-serif text-body text-muted">{searched ? t.searching : t.before}</p>}
      <ul className="fade-end flex min-h-[50%] flex-1 flex-col overflow-y-auto pr-1 pb-10">
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
                  {c.accepted > 0 && <span>{t.kept} {c.accepted}</span>}
                  {c.downgraded + c.rejected > 0 && <span>{t.down} {c.downgraded + c.rejected}</span>}
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
      <AssociationThreads s={s} />
    </section>
  );
}
