"use client";

/**
 * The text column (6.2): what the run has understood, in reading order — the place, the words on
 * the photo, Claude's judgment of what is missing (labelled as Claude's), the broken thread, and
 * finally the story, sentence by sentence, each citing its sources.
 */
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { threadSource } from "@/lib/live/state";
import { ViewpointCard } from "./viewpoint-card";

const FACET_JA: Record<string, string> = { place_description: "場所の記述", naming: "呼び名", existence_timeline: "存在の年表", historical_artifacts: "歴史的な作品" };

function Typed({ text, since, reduced, cps = 45 }: { text: string; since: number; reduced: boolean; cps?: number }) {
  const n = reduced ? text.length : Math.max(0, Math.floor((since / 1000) * cps));
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-lantern align-[-0.15em]" />}
    </>
  );
}

/** What the see call asks Claude for (SEE_SYSTEM), ticked one by one while it works, all at once when it answers. */
const ASK = ["看板・銘の文字を原文のまま読む", "読みと意味を日英で添える", "写っている要素と位置を囲む", "場所の候補を階層で挙げる"];

function SeeAsk({ s, since }: { s: LiveState; since: number }) {
  const answered = Boolean(s.see);
  const call = s.calls.find((c) => c.stage === "see");
  const els = s.seeProgress?.elements ?? [];
  // ticked by what has actually arrived: text read, readings/meanings, boxes; places come with the answer
  const doneAt = [els.some((e) => e.text_original), els.some((e) => e.reading || e.meaning), els.length > 0, answered];
  const thinking = s.seeProgress?.thinking?.trim();
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-lantern pl-4" data-testid="see-ask">
      <p className="label">
        Claude への依頼 <span className="text-lantern">{answered && call ? `応答 ${(call.elapsedMs / 1000).toFixed(1)} 秒` : "読んでいます"}</span>
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-small">
        {ASK.map((a, i) => {
          const shown = answered || doneAt[i] || since > 600 + i * 1700;
          const ok = answered || doneAt[i];
          return shown ? (
            <m.li key={a} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={`flex gap-3 ${ok ? "text-paper" : "text-paper/70"}`}>
              <span aria-hidden className={`w-4 text-caption tabular-nums ${ok ? "text-toki" : "text-lantern"}`}>
                {ok ? "✓" : "…"}
              </span>
              {a}
            </m.li>
          ) : null;
        })}
      </ol>
      {thinking && !answered && (
        <div className="mt-4" data-testid="see-thinking">
          <p className="label">Claude の思考（要約・ライブ）</p>
          <p className="mt-1 line-clamp-4 font-serif text-small text-paper/75 italic">{thinking.slice(-280)}</p>
        </div>
      )}
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
  const readings = (s.see?.elements ?? s.seeProgress?.elements ?? []).filter((e) => e.text_original).slice(0, 3);
  const broken = (s.threads ?? []).filter((t) => t.state === "absent");
  const showBroken = broken.length > 0 && since("threads") > 1800;
  const brokenYear = (() => {
    const src = broken[0] ? broken[0].claimId.split(":").pop() : null;
    const row = s.existence?.rows.find((r) => r.source === src);
    return row?.time?.start?.slice(0, 4) ?? null;
  })();
  const sentences = s.narrative?.sentences ?? s.narrativeProgress?.sentences ?? [];
  const sinceNarr = s.at.narrative_progress !== undefined ? elapsed - s.at.narrative_progress : since("narrative");
  const order = new Map(cards.map((c, i) => [c.sourceId, i + 1]));
  const showStory = sinceNarr >= 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label="わかったこと">
      <div className="fade-end flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto pr-3 pb-12">
        {/* the place */}
        <div className="min-h-28">
          {docked ? (
            <div>
              <p className="label">{[...s.place!.path.slice(1)].reverse().map((p) => p.name.ja).join(" ／ ")}</p>
              <m.h1 layoutId="place-ja" className="mt-1 font-serif text-display font-bold" data-testid="place-title">
                {placeName.ja}
              </m.h1>
              <m.p layoutId="place-en" className="font-serif text-lead text-paper/70 italic">
                {placeName.en}
              </m.p>
            </div>
          ) : s.place === null ? (
            <p className="text-small text-muted" data-testid="place-unknown">
              場所を一つに決められませんでした{s.placeTried?.length ? `（候補：${s.placeTried.join("、")}）` : ""}
            </p>
          ) : (
            <p className="font-serif text-display text-paper/80">{s.stages.see ? "この写真は、どこだろう。" : "写真を受け取りました。"}</p>
          )}
        </div>

        {/* the discovery: the broken thread */}
        <AnimatePresence>
          {showBroken && (
            <m.div key="broken" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="broken-callout">
              <p className="label flex items-center gap-2">
                <svg width="28" height="6" aria-hidden>
                  <path d="M0 3 H10 M18 3 H28" stroke="var(--thread-toki)" strokeWidth="2" />
                </svg>
                切れた糸
              </p>
              <p className="mt-1 flex items-baseline gap-4">
                <span className="font-serif text-hero leading-none text-toki tabular-nums">{brokenYear ?? ""}</span>
                <span className="font-serif text-title">{placeName?.ja ?? ""}は、まだなかった</span>
              </p>
              <p className="mt-2 font-serif text-body text-paper/80">{broken[0].label.ja.replace(/（[^（）]*（[^）]*）[^）]*）$|（[^）]*）$/, "")}</p>
              <p className="mt-1 text-caption text-muted">年表との照合はコード。Claude には判定させていません。</p>
            </m.div>
          )}
        </AnimatePresence>

        {s.stages.see && !s.at.place && <SeeAsk s={s} since={since("received") >= 0 ? since("received") : elapsed} />}

        {docked && !showStory && <ViewpointCard s={s} />}

        {/* the words on the photo */}
        {readings.length > 0 && !showStory && (
          <div>
            <p className="label">写真の中の文字</p>
            <dl className="mt-2 flex flex-col gap-3">
              {readings.map((e, i) => (
                <m.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}>
                  <dt className="font-serif text-title leading-tight">{e.text_original}</dt>
                  <dd className="text-small text-paper/75">
                    {e.reading && <span className="mr-2 font-serif text-muted italic">{e.reading}</span>}
                    {e.meaning?.ja}
                  </dd>
                </m.div>
              ))}
            </dl>
          </div>
        )}

        {/* Claude's own judgment (gap.assessment), labelled as Claude's — not a code decision */}
        {s.gap?.assessment && !showStory && (
          <m.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-lantern pl-4" data-testid="claude-line">
            <figcaption className="label">Claude の判断 ── 何が足りないか</figcaption>
            <blockquote className="mt-1 font-serif text-body">
              <Typed text={s.gap.assessment} since={since("gap")} reduced={reduced} />
            </blockquote>
            {s.gap.gaps && s.gap.gaps.length > 0 && since("gap") > 1500 && (
              <p className="mt-2 text-caption text-muted">
                追加で探す語：
                {s.gap.gaps
                  .flatMap((g) => g.terms.map((t) => ({ t, g })))
                  .slice(0, 8)
                  .map(({ t, g }, i) => (
                    <m.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="text-paper" title={`${FACET_JA[g.facet] ?? g.facet}（${g.lang === "ja" ? "日本語" : "英語"}）`}>
                      {i > 0 ? "、" : ""}
                      {t}
                    </m.span>
                  ))}
              </p>
            )}
          </m.figure>
        )}

        {/* the story, sentence by sentence (350 ms each), with source numbers */}
        {showStory && (
          <article data-testid="narrative" lang={s.narrative?.lang ?? s.narrativeProgress?.lang ?? "ja"}>
            <p className="label">この場所の物語</p>
            <div className="mt-2 flex flex-col gap-3">
              {sentences.map((x, i) => {
                const srcs = [...new Set(x.claim_ids.map((c) => sourceOfClaim(s, c)).filter((v): v is string => !!v))];
                const on = reduced || sinceNarr > i * 350;
                if (!on) return null;
                const lit = hot && srcs.includes(hot);
                return (
                  <m.p
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: hot && !lit ? 0.4 : 1, y: 0 }}
                    onMouseEnter={() => setHot(srcs[0] ?? null)}
                    onMouseLeave={() => setHot(null)}
                    className={`font-serif text-body ${x.assertion_type === "uncertain" ? "text-paper/70" : ""}`}
                  >
                    {x.text}
                    {srcs.map((sid) => (
                      <sup key={sid} className="ml-0.5 font-sans text-caption text-muted tabular-nums">
                        {order.get(sid) ?? "?"}
                      </sup>
                    ))}
                  </m.p>
                );
              })}
            </div>
          </article>
        )}

        {/* the viewpoint may land after the story has started: keep it, below the story */}
        {showStory && <ViewpointCard s={s} />}

        {/* threads that exist but are not drawn on a phone */}
        {s.threads && (
          <p className="text-caption text-muted lg:hidden">
            糸 {s.threads.length} 本（切れた糸 {s.threads.filter((t) => t.state === "absent").length}）：{[...new Set(s.threads.map(threadSource))].length} 資料
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-rule pt-4 lg:flex lg:flex-wrap lg:items-center">{actions}</div>
    </section>
  );
}
