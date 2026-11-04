"use client";

/**
 * The text column (6.2): what the run has understood, in reading order — the place, the words on
 * the photo, Claude's judgment of what is missing (labelled as Claude's), the broken thread, and
 * finally the story, sentence by sentence, each citing its sources.
 */
import { By } from "../ui/by";
import { interimSince } from "@/lib/time-river";
import { FirstAnswer } from "./first-answer";
import { AnimatePresence, m } from "motion/react";
import type { LiveState, SourceCard } from "@/lib/live/state";
import { threadSource } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { FACET_LABEL } from "./labels";
import { ViewpointCard } from "./viewpoint-card";

const T = dict({
  ja: {
    ask: ["看板・銘の文字を原文のまま読む", "読みと意味を日英で添える", "写っている要素と位置を囲む", "場所の候補を階層で挙げる"],
    request: "Claude への依頼",
    answered: (s: string) => `応答 ${s} 秒`,
    reading: "読んでいます",
    thinking: "Claude の思考（要約・ライブ）",
    found: "わかったこと",
    noPlace: "この場所の資料はまだ持っていません。歴史は確かめていないので、ここでは写真の文字の読みとガイドだけを出します。",
    tried: (c: string) => `写真から推定した場所の候補：${c}`,
    where: "この写真は、どこだろう。",
    received: "写真を受け取りました。",
    broken: "切れた糸",
    notYet: (p: string) => `${p}は、まだなかった`,
    notYetPermanent: (p: string) => `恒久的な${p}は、まだなかった`,
    byCodeShort: "年表との照合（コード）。Claude には判定させない",
    interim: (y: number) => `${y}年に仮設の門が設けられた（年表）。その後もあったかは記録されていない`,
    byCode: "年表との照合はコード。Claude には判定させていません。",
    words: "写真の中の文字",
    judgment: "Claude の判断 ── 何が足りないか",
    more: "追加で探す語：",
    ja: "日本語",
    en: "英語",
    sep: "、",
    found2: "見つけた：",
    searched: (n: number) => `Claude が足りない観点を判断し、追加で探した（${n} 節が見つかった）：`,
    judgedEn: (n: number) => `${n}`,
    story: "この場所の物語 ── Claude が書き、一文ずつコードが確かめた",
    skippedGap: "追加の探索はしなかった（残り時間が少ないため・コードの判断）",
    threads: (n: number, b: number, src: number) => `糸 ${n} 本（切れた糸 ${b}）：糸のある資料 ${src}`,
  },
  en: {
    ask: ["Read the signs and inscriptions as written", "Add readings and meanings in Japanese and English", "Box what is in the photo", "Name the place, from wide to narrow"],
    request: "Asked of Claude",
    answered: (s: string) => `answered in ${s} s`,
    reading: "reading",
    thinking: "Claude's thinking (summary, live)",
    found: "What we found",
    noPlace: "We do not have sources for this place yet. Its history is not checked, so here you get the reading of the words in the photo and the guide.",
    tried: (c: string) => `Places the photo may show: ${c}`,
    where: "Where is this photo?",
    received: "Photo received.",
    broken: "Not there that year",
    notYet: (p: string) => `${p || "it"} was gone`,
    notYetPermanent: (p: string) => `the permanent ${p || "structure"} was gone`,
    byCodeShort: "checked against the timeline by code, not by Claude",
    interim: (y: number) => `a temporary gate was put up in ${y} (timeline); whether one stood later is not recorded`,
    byCode: "Checked against the timeline by code — not left to Claude.",
    words: "Words in the photo",
    judgment: "Claude's judgment — what is missing",
    more: "Also searching for: ",
    ja: "Japanese",
    en: "English",
    sep: ", ",
    found2: "found: ",
    searched: (n: number) => `Claude judged what was missing and searched again (${n} passages found): `,
    judgedEn: (n: number) => `Claude judged what was still missing and searched again — ${n} more passages found.`,
    story: "The story of this place — written by Claude, each sentence checked by code",
    skippedGap: "No further search (little time left — the code's decision)",
    threads: (n: number, b: number, src: number) => `${n} threads (${b} broken), from ${src} sources with threads`,
  },
});

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

function SeeAsk({ s, since }: { s: LiveState; since: number }) {
  const answered = Boolean(s.see);
  const call = s.calls.find((c) => c.stage === "see");
  const els = s.seeProgress?.elements ?? [];
  // ticked by what has actually arrived: text read, readings/meanings, boxes; places come with the answer
  const doneAt = [els.some((e) => e.text_original), els.some((e) => e.reading || e.meaning), els.length > 0, answered];
  const thinking = s.seeProgress?.thinking?.trim();
  const t = useDict(T);
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-lantern pl-4" data-testid="see-ask">
      <p className="label">
        {t.request} <span className="text-lantern">{answered && call ? t.answered((call.elapsedMs / 1000).toFixed(1)) : t.reading}</span>
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-small">
        {t.ask.map((a, i) => {
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
          <p className="label">{t.thinking}</p>
          <p className="mt-1 line-clamp-4 font-serif text-small text-paper/75 italic">{thinking.slice(-280)}</p>
        </div>
      )}
    </m.div>
  );
}

/** "Kaminarimon (Thunder Gate)" → "Kaminarimon": the gloss is said once, in the title. */
const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "");

/** The thread's label without its trailing basis in parentheses, and (English) the gloss said once. */
export function plainLabel(label: string, ui: "ja" | "en", placeEn?: string): string {
  let s = label.replace(/（[^（）]*（[^）]*）[^）]*）$|（[^）]*）$/, "");
  if (ui === "en") {
    s = s.replace(/\s*\((?:from|see)\b(?:[^()]|\([^()]*\))*\)\s*$/, "");
    if (placeEn) {
      const short = shortName(placeEn);
      if (short !== placeEn) s = s.split(placeEn).join(short);
    }
  }
  return s.trim();
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
  guide,
  guideFocus,
  story,
  world,
  holdBroken = false,
}: {
  /** ?hold=broken (recording): the discovery waits until the visitor turns the years */
  holdBroken?: boolean;
  s: LiveState;
  cards: SourceCard[];
  elapsed: number;
  reduced: boolean;
  hot: string | null;
  setHot: (id: string | null) => void;
  actions: React.ReactNode;
  /** the guide cards (Loom), in place of the plain readings once Claude has read the photo */
  guide: React.ReactNode;
  /** after the story has started: the guide card of the object being touched */
  guideFocus?: React.ReactNode;
  /** the story in the visitor's language when it differs from the run's (fetched once, cached) */
  /** FR-25: where the sources come from (after the story) */
  world?: React.ReactNode;
  story?: { lang: "ja" | "en"; sentences: { text: string; claim_ids: string[]; assertion_type: string }[] } | null;
}) {
  const t = useDict(T);
  const ui = useLang();
  const since = (k: string) => (s.at[k] !== undefined ? elapsed - s.at[k] : -1);
  const placeName = s.place?.path[0]?.name; // the path is leaf-first
  const docked = placeName && since("place") >= 1900;
  const readings = (s.see?.elements ?? s.seeProgress?.elements ?? []).filter((e) => e.text_original).slice(0, 3);
  const broken = (s.threads ?? []).filter((t) => t.state === "absent");
  const showBroken = broken.length > 0 && since("threads") > 1800 && !holdBroken;
  const foundTitles = [...new Set((s.gap?.candidates ?? []).map((c) => c.sourceTitle).filter(Boolean))].slice(0, 2);
  const brokenYearNum = (() => {
    const src = broken[0] ? broken[0].claimId.split(":").pop() : null;
    const row = s.existence?.rows.find((r) => r.source === src);
    return row?.time?.start ? Number(row.time.start.slice(0, 4)) : null;
  })();
  const interim = brokenYearNum && s.timeline ? interimSince(s.timeline as never, brokenYearNum) : null;
  const brokenYear = (() => {
    const src = broken[0] ? broken[0].claimId.split(":").pop() : null;
    const row = s.existence?.rows.find((r) => r.source === src);
    return row?.time?.start?.slice(0, 4) ?? null;
  })();
  const sentences = story?.sentences ?? s.narrative?.sentences ?? s.narrativeProgress?.sentences ?? [];
  const sinceNarr = s.at.narrative_progress !== undefined ? elapsed - s.at.narrative_progress : since("narrative");
  const order = new Map(cards.map((c, i) => [c.sourceId, i + 1]));
  const showStory = sinceNarr >= 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label={t.found}>
      <div className="answer-col fade-end flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto pr-3 pb-12 [&>*]:shrink-0">
        {/* the place (presenter/video: the first answer and the discovery name it, so the column keeps 1878 in frame) */}
        <div className={`min-h-28 ${docked ? "present-hide" : ""}`}>
          {docked ? (
            <div>
              <p className="present-hide label">{[...s.place!.path.slice(1)].reverse().map((p) => p.name[ui]).join(ui === "ja" ? " ／ " : " / ")}</p>
              <m.h1 layoutId="place-ja" className={`mt-1 font-serif font-bold ${ui === "ja" ? "text-display" : "text-title leading-tight"}`} data-testid="place-title">
                {ui === "ja" ? placeName.ja : placeName.en}
              </m.h1>
              <m.p layoutId="place-en" className="present-hide font-serif text-lead text-paper/70 italic">
                {ui === "ja" ? placeName.en : placeName.ja}
              </m.p>
            </div>
          ) : s.place === null ? (
            <div data-testid="place-unknown">
              <p className="border-l-2 border-rule-strong pl-4 font-serif text-lead">{t.noPlace}</p>
              {s.placeTried?.length ? <p className="mt-2 pl-4 text-caption text-muted">{t.tried(s.placeTried.join(t.sep))}</p> : null}
            </div>
          ) : (
            <p className={`font-serif text-paper/80 ${s.stages.see ? "text-title" : "text-display"}`}>{s.stages.see ? t.where : t.received}</p>
          )}
        </div>

        {/* the friend's two questions, answered first */}
        <FirstAnswer s={s} />
        {/* after the story, Claude's judgment stays as one line: what it found missing, what it searched for */}
        {showStory && s.gap?.gaps && s.gap.gaps.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted" data-testid="claude-searched">
            <By who="claude" did={{ ja: `足りないものを探し直した（+${s.gap.found ?? 0} 節）`, en: `searched again for what was missing (+${s.gap.found ?? 0})` }} />
            {/* what that search brought in: the sources it found that the first search had not */}
            {foundTitles.length > 0 && (
              <span className="text-paper" data-testid="claude-found">
                {t.found2}
                <span className="font-serif text-body">{foundTitles.join(t.sep)}</span>
              </span>
            )}
            <span className="present-hide text-paper">
              {s.gap.gaps
                .flatMap((g) => g.terms)
                .slice(0, 4)
                .join(t.sep)}
            </span>
          </p>
        )}

        {/* the discovery: the broken thread */}
        <AnimatePresence>
          {showBroken && (
            <m.div key="broken" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="broken-callout">
              <p className="label flex flex-wrap items-center gap-2">
                <svg width="28" height="6" aria-hidden>
                  <path d="M0 3 H10 M18 3 H28" stroke="var(--thread-toki)" strokeWidth="2" />
                </svg>
                {t.broken}
                {/* presenter (the video): the code's verdict sits on the label line, so it is always in frame */}
                <span className="present-only-inline ml-2">
                  <By who="code" did={{ ja: "年表で判定（Claude ではない）", en: "timeline — not Claude" }} />
                </span>
              </p>
              <p className="mt-1 flex items-baseline gap-4">
                <span className="font-serif text-hero leading-none text-toki tabular-nums">{brokenYear ?? ""}</span>
                <span className="font-serif text-title">{(interim ? t.notYetPermanent : t.notYet)(ui === "ja" ? (placeName?.ja ?? "") : shortName(placeName?.en ?? ""))}</span>
              </p>
              {interim && <p className="present-hide mt-1 text-small text-paper/75">{t.interim(interim)}</p>}
              <p className="present-hide mt-2 font-serif text-body text-paper/80">{plainLabel(broken[0].label[ui], ui, placeName?.en)}</p>
              <p className="present-hide mt-1 text-caption text-muted">{t.byCode}</p>
            </m.div>
          )}
        </AnimatePresence>

        {s.stages.see && !s.at.place && <SeeAsk s={s} since={since("received") >= 0 ? since("received") : elapsed} />}

        {docked && !showStory && <ViewpointCard s={s} />}

        {/* the words on the photo */}
        {!showStory ? guide : guideFocus}
        {false && readings.length > 0 && !showStory && (
          <div>
            <p className="label">{t.words}</p>
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
        {s.gap?.skipped === "time" && !s.gap.assessment && (
          <p className="text-caption text-muted" data-testid="gap-skipped">
            {t.skippedGap}
          </p>
        )}
        {s.gap?.assessment && !showStory && (
          <m.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-lantern pl-4" data-testid="claude-line">
            <figcaption className="label">{t.judgment}</figcaption>
            <blockquote className="mt-1 font-serif text-body">
              {/* Claude wrote its judgment in the run's language; an English reader of a Japanese run gets a plain English line (the terms follow below) */}
              <Typed text={ui === "en" && /[\u3040-\u30ff\u4e00-\u9fff]/.test(s.gap.assessment) ? t.judgedEn(s.gap.found ?? 0) : s.gap.assessment} since={since("gap")} reduced={reduced} />
            </blockquote>
            {s.gap.gaps && s.gap.gaps.length > 0 && since("gap") > 1500 && (
              <p className="mt-2 text-caption text-muted">
                {t.more}
                {s.gap.gaps
                  .flatMap((g) => g.terms.map((term) => ({ term, g })))
                  .slice(0, 8)
                  .map(({ term, g }, i) => (
                    <m.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="text-paper" title={`${FACET_LABEL[ui][g.facet] ?? g.facet} (${g.lang === "ja" ? t.ja : t.en})`}>
                      {i > 0 ? t.sep : ""}
                      {term}
                    </m.span>
                  ))}
              </p>
            )}
          </m.figure>
        )}

        {/* the story, sentence by sentence (350 ms each), with source numbers */}
        {showStory && (
          <article className="present-hide" data-testid="narrative" lang={story?.lang ?? s.narrative?.lang ?? s.narrativeProgress?.lang ?? "ja"}>
            <p className="label">{t.story}</p>
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
        {showStory && <div className="present-hide"><ViewpointCard s={s} /></div>}
        {showStory && world}

        {/* threads that exist but are not drawn on a phone */}
        {s.threads && (
          <p className="text-caption text-muted lg:hidden">
            {t.threads(s.threads.length, s.threads.filter((x) => x.state === "absent").length, [...new Set(s.threads.map(threadSource))].length)}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-rule pt-4 lg:flex lg:flex-wrap lg:items-center">{actions}</div>
    </section>
  );
}
