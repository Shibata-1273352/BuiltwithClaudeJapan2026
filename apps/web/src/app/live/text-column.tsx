"use client";

/**
 * The text column (6.2): what the run has understood, in reading order — the place, the words on
 * the photo, Claude's judgment of what is missing (labelled as Claude's), the broken thread, and
 * finally the story, sentence by sentence, each citing its sources.
 */
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { threadSource } from "@/lib/live/state";

const FACET_JA: Record<string, string> = { place_description: "場所の記述", naming: "呼び名", existence_timeline: "存在の年表", historical_artifacts: "歴史的な作品" };

function Typed({ text, since, reduced, cps = 45 }: { text: string; since: number; reduced: boolean; cps?: number }) {
  const n = reduced ? text.length : Math.max(0, Math.floor((since / 1000) * cps));
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-lantern align-middle" />}
    </>
  );
}

/** What the see call asks Claude for (SEE_SYSTEM), ticked one by one while it works, all at once when it answers. */
const ASK = ["看板・銘の文字を原文のまま読む", "読みと意味を日英で添える", "写っている要素と位置を囲む", "場所の候補を階層で挙げる"];

function SeeAsk({ s, since }: { s: LiveState; since: number }) {
  const answered = Boolean(s.see);
  const call = s.calls.find((c) => c.stage === "see");
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-lantern/30 p-3" data-testid="see-ask">
      <p className="text-xs font-bold text-lantern">Claude への依頼{answered && call ? `：応答 ${(call.elapsedMs / 1000).toFixed(1)} 秒` : "：写真を読んでいます"}</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {ASK.map((a, i) => {
          const shown = answered || since > 600 + i * 1700;
          const done = answered;
          return shown ? (
            <m.li key={a} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
              <span aria-hidden className={`inline-flex size-4 items-center justify-center rounded-full text-[10px] ${done ? "bg-toki text-night" : "border border-lantern/70"}`}>
                {done ? "✓" : <span className="size-1.5 animate-pulse rounded-full bg-lantern" />}
              </span>
              {a}
            </m.li>
          ) : null;
        })}
      </ul>
    </m.div>
  );
}

function sourceOfClaim(s: LiveState, claimId: string): string | null {
  if (claimId.startsWith("cl:exist:")) return claimId.split(":").pop() ?? null;
  return s.claims.find((c) => c.id === claimId)?.source_id ?? null;
}

export function TextColumn({
  s,
  cards,
  elapsed,
  reduced,
  hot,
  setHot,
  actions,
}: {
  s: LiveState;
  cards: SourceCard[];
  elapsed: number;
  reduced: boolean;
  hot: string | null;
  setHot: (id: string | null) => void;
  actions: React.ReactNode;
}) {
  const since = (k: string) => (s.at[k] !== undefined ? elapsed - s.at[k] : -1);
  const placeName = s.place?.path[0]?.name; // the path is leaf-first
  const docked = placeName && since("place") >= 1900;
  const readings = (s.see?.elements ?? []).filter((e) => e.text_original).slice(0, 3);
  const broken = (s.threads ?? []).filter((t) => t.state === "absent");
  const showBroken = broken.length > 0 && since("threads") > 1800;
  const sentences = s.narrative?.sentences ?? [];
  const sinceNarr = since("narrative");
  const order = new Map(cards.map((c, i) => [c.sourceId, i + 1]));
  const showStory = sinceNarr >= 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" aria-label="わかったこと">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
      {/* the place */}
      <div className="min-h-24">
        {docked ? (
          <div>
            <p className="text-xs tracking-widest text-muted">{[...s.place!.path.slice(1)].reverse().map((p) => p.name.ja).join(" › ")}</p>
            <m.h1 layoutId="place-ja" className="font-serif text-5xl font-bold tracking-[0.15em]" data-testid="place-title">
              {placeName.ja}
            </m.h1>
            <m.p layoutId="place-en" className="mt-1 font-serif text-xl text-lantern">
              {placeName.en}
            </m.p>
          </div>
        ) : s.place === null ? (
          <p className="text-sm text-muted" data-testid="place-unknown">
            場所を一つに決められませんでした{s.placeTried?.length ? `（候補：${s.placeTried.join("、")}）` : ""}
          </p>
        ) : (
          <p className="font-serif text-2xl text-muted/80">{s.stages.see ? "この写真は、どこだろう…" : "写真を受け取りました"}</p>
        )}
      </div>

      {s.stages.see && !s.at.place && <SeeAsk s={s} since={since("received") >= 0 ? since("received") : elapsed} />}

      {/* the words on the photo */}
      {readings.length > 0 && !showStory && (
        <ul className="flex flex-col gap-2" aria-label="写真の中の文字">
          {readings.map((e, i) => (
            <m.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="border-l-2 border-lantern/60 pl-3">
              <span className="font-serif text-2xl">{e.text_original}</span>
              {e.reading && <span className="ml-2 text-sm text-muted italic">{e.reading}</span>}
              {e.meaning?.ja && <p className="text-sm text-paper/80">{e.meaning.ja}</p>}
            </m.li>
          ))}
        </ul>
      )}

      {/* Claude's own judgment (gap.assessment), labelled as Claude's — not a code decision */}
      {s.gap?.assessment && !showStory && (
        <m.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-lantern/40 bg-lantern/5 p-3" data-testid="claude-line">
          <figcaption className="mb-1 text-xs font-bold text-lantern">Claudeの判断：何が足りないか</figcaption>
          <blockquote className="text-sm leading-relaxed">
            <Typed text={s.gap.assessment} since={since("gap")} reduced={reduced} />
          </blockquote>
          {s.gap.gaps && s.gap.gaps.length > 0 && since("gap") > 1500 && (
            <ul className="mt-2 flex flex-wrap gap-1 text-[11px]">
              {s.gap.gaps.flatMap((g) => g.terms.map((t) => ({ t, g }))).slice(0, 8).map(({ t, g }, i) => (
                <m.li key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} className="rounded-full bg-night-2 px-2 py-0.5" title={`${FACET_JA[g.facet] ?? g.facet}（${g.lang === "ja" ? "日本語" : "英語"}）`}>
                  ＋ {t}
                </m.li>
              ))}
            </ul>
          )}
        </m.figure>
      )}

      {/* the discovery: the broken thread */}
      <AnimatePresence>
        {showBroken && (
          <m.div key="broken" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-ba/50 bg-ba/10 p-3" data-testid="broken-callout">
            <p className="text-xs font-bold text-ba">切れた糸 — 失敗ではなく、発見</p>
            <p className="mt-1 font-serif text-lg leading-snug">{broken[0].label.ja.replace(/（[^（）]*（[^）]*）[^）]*）$|（[^）]*）$/, "")}</p>
            <p className="mt-1 text-xs text-muted">年表との照合はコードが行い、根拠の年代を示します。</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* the story, sentence by sentence (350 ms each), with source numbers */}
      {showStory && (
        <article className="flex flex-col gap-3" data-testid="narrative" lang={s.narrative?.lang ?? "ja"}>
          <h2 className="font-serif text-sm tracking-widest text-muted">この場所の物語（根拠つき）</h2>
          {sentences.map((x, i) => {
            const srcs = [...new Set(x.claim_ids.map((c) => sourceOfClaim(s, c)).filter((v): v is string => !!v))];
            const on = reduced || sinceNarr > i * 350;
            if (!on) return null;
            const lit = hot && srcs.includes(hot);
            return (
              <m.p
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: hot && !lit ? 0.45 : 1, y: 0 }}
                onMouseEnter={() => setHot(srcs[0] ?? null)}
                onMouseLeave={() => setHot(null)}
                className={`font-serif text-[17px] leading-relaxed ${x.assertion_type === "uncertain" ? "text-paper/75" : ""}`}
              >
                {x.text}
                {srcs.map((sid) => (
                  <sup key={sid} className="ml-0.5 text-[11px] text-lantern">
                    [{order.get(sid) ?? "?"}]
                  </sup>
                ))}
              </m.p>
            );
          })}
        </article>
      )}

      {/* threads that exist but are not drawn on a phone */}
      {s.threads && (
        <p className="text-xs text-muted lg:hidden">
          糸 {s.threads.length} 本（切れた糸 {s.threads.filter((t) => t.state === "absent").length}）：{[...new Set(s.threads.map(threadSource))].length} 資料
        </p>
      )}

      </div>
      <div className="flex flex-wrap items-end gap-2">{actions}</div>
    </section>
  );
}
