"use client";

/**
 * Guide cards (Loom): what each object in the photo is, why it matters, what to try — and how its
 * kanji are built. Claude's explanation (the guide mark; silk threads), not evidence. A card opens
 * deeper when its object is touched: the kanji parts, then the questions that pull a new thread.
 */
import { AnimatePresence, m } from "motion/react";
import type { GuideNote } from "@tsumugi/core";
import type { LiveState } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { GuideMark } from "../ui/legend";

const L = dict({
  ja: { what: "見どころ", why: "意味", try: "やってみる", ask: "糸を引く", writing: "Claude がガイドを書いています", kanji: "漢字のなりたち" },
  en: { what: "Look", why: "Why it matters", try: "Try", ask: "Pull a thread", writing: "Claude is writing the guide", kanji: "How the kanji are built" },
});

export function GuideCards({
  s,
  register,
  selectedSee,
  onSelectSee,
  onAsk,
  only,
}: {
  s: LiveState;
  register: (key: string) => (el: HTMLElement | null) => void;
  /** the see index of the touched object (its card opens deeper) */
  selectedSee: number | null;
  onSelectSee: (i: number) => void;
  onAsk?: (q: string, see: number) => void;
  /** show only this element's card (after the story has started) */
  only?: number | null;
}) {
  const l = useDict(L);
  const lang = useLang();
  const elements = s.see?.elements ?? s.seeProgress?.elements ?? [];
  const notes = new Map((s.guide?.notes ?? []).map((n) => [n.element, n]));
  // the objects with writing first (the same order the guide is written in)
  const order = elements
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => e.text_original || notes.has(i))
    .filter(({ i }) => only === undefined || only === i)
    .slice(0, 3);
  if (!order.length) return null;
  const writing = s.stages.guide && s.stages.guide.done === undefined;
  // the element the first answer already names (the largest with writing): its card skips the heading
  const answered = only === undefined ? elements.map((e, i) => ({ i, a: e.text_original && e.box ? e.box.w * e.box.h : -1 })).sort((a, b) => b.a - a.a)[0] : undefined;
  const answeredIdx = answered && answered.a >= 0 ? answered.i : -1;
  return (
    <section aria-label={l.what} className="flex flex-col gap-3" data-testid="guide-cards">
      {order.map(({ e, i }, pos) => {
        const n = notes.get(i);
        const open = selectedSee === i;
        return (
          <m.article
            key={i}
            ref={register(`guide:${i}`)}
            layout="position"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-md border-l-2 bg-night-2/60 py-3 pr-3 pl-4 transition-colors ${open ? "border-paper bg-night-2" : "border-paper/25"}`}
            data-testid="guide-card"
          >
            <button type="button" onClick={() => onSelectSee(i)} className="block w-full text-left" aria-expanded={open}>
              {i === answeredIdx && !open ? (
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-caption text-muted">{e.text_original}</p>
                  {n && <GuideMark />}
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-title leading-tight" lang={e.text_original ? "ja" : lang}>
                      {e.text_original ?? n?.name?.[lang] ?? e.label}
                    </p>
                    {n && <GuideMark />}
                  </div>
                  <p className="text-small text-paper/70">
                    {e.reading && <span className="mr-2 font-serif italic">{e.reading}</span>}
                    {e.meaning?.[lang]}
                  </p>
                </>
              )}
            </button>
            {n ? <Note n={n} open={open} l={l} lang={lang} onAsk={onAsk ? (q) => onAsk(q, i) : undefined} /> : writing && pos === 0 ? <p className="shimmer mt-2 rounded-sm text-caption text-muted">{l.writing}</p> : null}
          </m.article>
        );
      })}
    </section>
  );
}

function Note({ n, open, l, lang, onAsk }: { n: GuideNote; open: boolean; l: (typeof L)["ja"]; lang: "ja" | "en"; onAsk?: (q: string) => void }) {
  return (
    <div className="mt-2 text-small">
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-caption text-muted">{l.what}</dt>
        <dd>{n.what[lang]}</dd>
        <dt className="text-caption text-muted">{l.why}</dt>
        <dd>{n.why[lang]}</dd>
        <dt className="text-caption text-muted">{l.try}</dt>
        <dd>{n.try[lang]}</dd>
      </dl>
      <AnimatePresence initial={false}>
        {open && (
          <m.div key="deeper" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {n.kanji.length > 0 && (
              <div className="mt-3 border-t border-rule pt-2" data-testid="kanji-parts">
                <p className="label">{l.kanji}</p>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {n.kanji.map((k) => (
                    <li key={k.char} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-serif text-title" lang="ja">
                        {k.char}
                      </span>
                      <span className="text-muted">＝</span>
                      {k.parts.map((p, j) => (
                        <span key={j} className="inline-flex items-baseline gap-1">
                          {j > 0 && <span className="text-muted">＋</span>}
                          <span className="font-serif text-lead" lang="ja">
                            {p.part}
                          </span>
                          <span className="text-caption text-muted">{p.meaning[lang]}</span>
                        </span>
                      ))}
                      <span className="text-caption text-paper/70">→ {k.meaning[lang]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {onAsk && n.questions.length > 0 && (
              <div className="mt-3 border-t border-rule pt-2">
                <p className="label">{l.ask}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {n.questions.map((q, j) => (
                    <li key={j}>
                      <button type="button" onClick={() => onAsk(q[lang])} className="min-h-9 rounded-sm border border-rule-strong px-2 text-left text-caption hover:border-paper/60" data-testid="ask-suggestion">
                        {q[lang]}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
