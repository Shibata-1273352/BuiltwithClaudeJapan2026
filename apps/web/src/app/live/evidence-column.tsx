"use client";

/** The evidence column (6.2): one card per source, appearing as it is found, then judged. */
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { AssociationThreads } from "./association-threads";
import { EXIST_JA, LAYER_COLOR, STATE_JA } from "./labels";

const FACET_JA: Record<string, string> = {
  place_description: "場所の記述",
  naming: "呼び名",
  existence_timeline: "存在の年表",
  historical_artifacts: "歴史的な作品",
};

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
  return (
    <section className="flex h-full min-h-0 flex-col gap-2" aria-label="根拠" data-testid="evidence-column">
      <h2 className="flex items-baseline justify-between font-serif text-lg">
        <span>根拠となる資料</span>
        <span className="text-xs text-muted tabular-nums">{new Set(s.candidates.map((c) => c.passageId)).size} 節</span>
      </h2>
      <table className="w-full table-fixed text-[11px]" data-testid="search-matrix" aria-label="観点×言語の検索">
        <thead>
          <tr className="text-muted">
            <th className="w-12 text-left font-normal" />
            {Object.values(FACET_JA).map((f) => (
              <th key={f} className="font-normal">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["en", "ja"] as const).map((lang) => (
            <tr key={lang}>
              <td className="text-muted">{lang === "ja" ? "日本語" : "英語"}</td>
              {Object.keys(FACET_JA).map((f) => {
                const g = [...s.candidateGroups].reverse().find((x) => x.facet === f && x.lang === lang);
                return (
                  <td key={f} className="p-0.5">
                    <span
                      className={`flex h-6 items-center justify-center rounded tabular-nums transition-colors duration-500 ${
                        g ? (g.notFound ? "border border-dashed border-muted/50 text-muted" : "bg-lantern/20 text-paper") : searched ? "shimmer bg-muted/10" : "bg-muted/5"
                      }`}
                    >
                      {g ? (g.notFound ? "見つからず" : `${g.found} 節`) : ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length === 0 && (
        <ul className="flex flex-col gap-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={`h-20 rounded-lg bg-night-2/70 ${searched ? "shimmer" : ""}`} />
          ))}
        </ul>
      )}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
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
                animate={{ opacity: hot && hot !== c.sourceId ? 0.45 : 1, x: 0 }}
                transition={{ duration: 0.35 }}
                onMouseEnter={() => setHot(c.sourceId)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(c.sourceId)}
                onBlur={() => setHot(null)}
                tabIndex={0}
                className="relative rounded-lg bg-night-2/90 px-3 py-2 ring-1 ring-muted/15 outline-none focus-visible:ring-lantern"
                style={{ borderLeft: `3px ${c.state === "pending" ? "dashed" : "solid"} ${color}` }}
                data-testid="evidence-card"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-serif text-[15px]" lang={c.lang}>
                    {c.title}
                  </span>
                  {c.year && (
                    <span className={`font-serif text-sm tabular-nums ${c.yearKind === "published" ? "text-muted" : "text-lantern"}`} title={c.yearKind === "published" ? "刊行・公開年（この場所の記述の年ではない）" : "この場所について書かれた年"}>
                      {c.year}
                      {c.yearKind === "published" ? " 刊" : ""}
                    </span>
                  )}
                  <span className="rounded bg-muted/15 px-1 text-[10px] text-muted">{c.lang === "ja" ? "日" : "英"}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-paper/80" lang={c.lang}>
                  {c.excerpt}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {c.accepted > 0 && <span className="text-toki">採用 {c.accepted}</span>}
                  {c.downgraded + c.rejected > 0 && <span className="text-muted">格下げ・却下 {c.downgraded + c.rejected}</span>}
                  {c.existence && (
                    <span className={c.existence.value === "absent" ? "font-bold text-ba" : c.existence.value === "present" ? "text-toki" : "text-muted"}>
                      {EXIST_JA[c.existence.value]}
                    </span>
                  )}
                  {c.state && (
                    <span className={broken ? "text-ba" : "text-muted"}>
                      ・{STATE_JA[c.state] ?? c.state}（糸 {c.threads.length}）
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
