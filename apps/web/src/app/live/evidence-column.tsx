"use client";

/** The evidence column (6.2): one card per source, appearing as it is found, then judged. */
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { EXIST_LABEL, FACET_LABEL, LAYER_COLOR, STATE_LABEL } from "./labels";

const T = dict({
  ja: { evidence: "根拠", title: "根拠となる資料", n: (n: number) => `${n} 節`, matrix: "観点×言語の検索", ja: "日本語", en: "英語", none: "見つからず", searching: "日英の資料を探しています。", before: "写真を読み終えたら、日英の資料を探します。", pub: "刊行・公開年（この場所の記述の年ではない）", time: "この場所について書かれた年", pubMark: " 刊", jaMark: "日", enMark: "英", kept: "採用", down: "格下げ", more: (n: number) => `すべての資料を見る（${n}）`, original: "原文", refLabel: "Claude の参考訳（根拠は下の原文）" },
  en: { evidence: "Evidence", title: "Sources", n: (n: number) => `${n} passages`, matrix: "Search by topic and language", ja: "Japanese", en: "English", none: "none found", searching: "Searching Japanese and English sources.", before: "Once the photo is read, Japanese and English sources are searched.", pub: "year published (not the year this place was described)", time: "the year this place was written about", pubMark: " pub.", jaMark: "ja", enMark: "en", kept: "kept", down: "downgraded", more: (n: number) => `See all sources (${n})`, original: "original", refLabel: "Claude's reference translation (the evidence is the original below)" },
});


export function EvidenceColumn({
  s,
  cards,
  register,
  hot,
  setHot,
  expId = null,
  holdBroken = false,
}: {
  expId?: string | null;
  /** ?hold=broken (recording): the "not there that year" verdict waits for the years to be turned */
  holdBroken?: boolean;
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
  // crossing the language barrier: a source in the other language is shown in the reader's language
  // (Claude's reference translation, cached per run), with the original kept below it as the evidence
  const [tr, setTr] = useState<Record<string, string>>({});
  const needsTr = cards.some((c) => c.lang !== ui && c.excerptKey);
  useEffect(() => {
    if (!expId || !needsTr) return;
    let off = false;
    fetch(`/api/explorations/${expId}/translations?lang=${ui}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!off && j?.items) setTr(j.items as Record<string, string>);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [expId, ui, needsTr]);
  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label={t.evidence} data-testid="evidence-column">
      <div className="flex items-baseline justify-between">
        <h2 className="label">{t.title}</h2>
        {s.candidates.length > 0 && <span className="text-caption text-muted tabular-nums">{t.n(new Set(s.candidates.map((c) => c.passageId)).size)}</span>}
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
                {c.excerptKey && c.lang !== ui && tr[c.excerptKey] ? (
                  <div className={`${c.existence?.value === "absent" ? "" : "present-hide"} mt-1`}>
                    <p className="text-caption text-muted">{t.refLabel}</p>
                    <p className="line-clamp-2 text-small text-paper/85" lang={ui}>
                      {tr[c.excerptKey]}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-caption text-muted" lang={c.lang}>
                      {c.excerpt}
                    </p>
                  </div>
                ) : (
                  <p className={`${c.existence?.value === "absent" ? "" : "present-hide"} mt-1 line-clamp-2 text-small text-paper/70`} lang={c.lang}>
                    {c.excerpt.replace(/^Title:\s*/, "")}
                  </p>
                )}
                <div className={`mt-1.5 flex flex-wrap gap-x-3 text-caption text-muted ${holdBroken && c.existence?.value === "absent" ? "invisible" : ""}`}>
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
