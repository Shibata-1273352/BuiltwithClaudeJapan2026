"use client";

/**
 * The landing page (FR-40 ja/en): who has what problem, and how TSUMUGI solves it — in that order.
 * It opens with the scene it was made from, says the value in one line, shows the product's three
 * moments (real screenshots), why it can be relied on (numbers computed from the evaluation), and
 * where it works today. page.tsx (a Server Component) computes the facts.
 */
import Link from "next/link";
import type { LandingFacts } from "@/lib/landing-facts";
import { CapturePreview } from "./capture-preview";
import { dict, LangToggle, useDict, useLang } from "./i18n";
import { ButtonLink } from "./ui/button";
import { Warm } from "./warm";

const T = dict({
  ja: {
    nav: "ページ",
    notes: "旅ノート",
    how: "しくみ",
    origin: "はじまり",
    scene: "浅草で、外国人の友人に「これ、なんて書いてあるの？　いつからあるの？」と聞かれて、答えられなかった。",
    sceneBy: "── 作者の体験",
    career: "通信事業者で、人と人をつないできた。いま紡ぎたいのは、時と、場所と、人。",
    hero: (
      <>
        <span className="text-lantern">時と場所</span>を読み、
        <br />
        言葉の壁を越える。
      </>
    ),
    sub: "撮った場所が、いつ、何だったのか。日英の原典で確かめて、あなたの言葉で。",
    trySample: "雷門で試す",
    heroAlt: "TSUMUGI の画面：写真の文字の読み、いつからあるか、資料へ伸びる糸",
    own: "カメラで撮る",
    sampleNote: "例の写真は Wikimedia Commons の CC0。その場でライブに解析します。",
    moments: [
      { img: "time", title: "時を越える", body: "明治の旅人が歩いた日、ここに常設の門はなかった。" },
      { img: "read", title: "言葉を越える", body: "縦書きの筆文字も、明治の英文も。" },
    ],
    trustTitle: "安心して使える理由",
    trust: "読むのは Claude、確かめるのはコード。資料にないことは「書かれていません」。",
    numbers: (f: LandingFacts) => [
      { v: `${f.citationExactPct}%`, l: `引用が原文と一致（${f.citationN} 件）` },
      { v: `${f.rejected}/${f.fabricated}`, l: "作られた引用を拒否" },
      { v: `${f.unsupportedShown}`, l: "根拠のない文の表示" },
    ],
    evalNote: (run: string) => `評価：Batch API による一括評価（${run}）`,
    howLink: "しくみを見る",
    whereTitle: "いま使える場所",
    full: (f: LandingFacts) => `${f.places.map((p) => p.ja).join("、")}（日英の資料 ${f.sources} 点）`,
    elsewhere: "ほかの場所では、文字の読みとガイドだけ。",
    captureTitle: "目の前の景色を、一枚",
    captureNote: "位置情報は消し、顔はぼかしてから送ります。",
  },
  en: {
    nav: "Pages",
    notes: "Travel notes",
    how: "How it works",
    origin: "Where it began",
    scene: "In Asakusa, a friend from abroad asked me, “What does this say? How long has it been here?” — and I could not answer.",
    sceneBy: "— the maker’s own experience",
    career: "I have spent my career at a telecom carrier, connecting people. Now I want to weave together time, place and people.",
    hero: (
      <>
        Read <span className="text-lantern">time and place</span>.
        <br />
        Cross the language barrier.
      </>
    ),
    sub: "When was this place, and what was it? Checked in Japanese and English sources, told in your language.",
    trySample: "Try it at Kaminarimon",
    heroAlt: "The TSUMUGI stage: the words in the photo read, how long it has stood, threads to the sources",
    own: "Open the camera",
    sampleNote: "The example photo is CC0 from Wikimedia Commons, analysed live.",
    moments: [
      { img: "time", title: "Across time", body: "When a Meiji-era traveller walked here, no permanent gate stood." },
      { img: "read", title: "Across languages", body: "Vertical brush lettering, Meiji-era English." },
    ],
    trustTitle: "Why you can rely on it",
    trust: "Claude reads; code checks. What the sources do not say, it says so.",
    numbers: (f: LandingFacts) => [
      { v: `${f.citationExactPct}%`, l: `quotes match the original (${f.citationN})` },
      { v: `${f.rejected}/${f.fabricated}`, l: "fabricated quotes rejected" },
      { v: `${f.unsupportedShown}`, l: "unsupported sentences shown" },
    ],
    evalNote: (run: string) => `Evaluation: one batch run with the Batch API (${run})`,
    howLink: "See how it works",
    whereTitle: "Where it works today",
    full: (f: LandingFacts) => `${f.places.map((p) => p.en).join(", ")} (${f.sources} Japanese and English sources)`,
    elsewhere: "Elsewhere: the reading and the guide only.",
    captureTitle: "The view in front of you, in one photo",
    captureNote: "Location removed and faces blurred before sending.",
  },
});

export function Landing({ facts }: { facts: LandingFacts }) {
  const t = useDict(T);
  const lang = useLang();
  return (
    <main className="flex flex-1 flex-col">
      <Warm />
      <header className="mx-auto flex w-full max-w-7xl items-baseline justify-between px-5 pt-6">
        <span className="font-serif text-lead tracking-[0.3em]">TSUMUGI</span>
        <nav className="flex items-center gap-1" aria-label={t.nav}>
          <Link href="/how" className="inline-flex min-h-11 items-center px-2 text-small whitespace-nowrap text-muted hover:text-paper" data-testid="how-link">
            {t.how}
          </Link>
          <Link href="/notes" className="inline-flex min-h-11 items-center px-2 text-small whitespace-nowrap text-muted hover:text-paper">
            {t.notes}
          </Link>
          <LangToggle className="ml-2" />
        </nav>
      </header>

      {/* the scene, the value, the action */}
      <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 pt-10 pb-14 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-14 lg:pt-14">
        <div>
          <h1 className="font-serif text-title leading-tight font-bold sm:text-display">{t.hero}</h1>
          <p className="mt-6 max-w-[36em] text-body text-paper/80">{t.sub}</p>
          <figure className="mt-8 max-w-[38em] border-l-2 border-lantern pl-4" data-testid="origin">
            <figcaption className="label">{t.origin}</figcaption>
            <blockquote className="mt-1 font-serif text-lead text-paper/90">{t.scene}</blockquote>
            <p className="mt-1 text-caption text-muted">{t.sceneBy}</p>
            <p className="mt-3 text-small text-paper/80" data-testid="career">{t.career}</p>
          </figure>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/live" variant="primary" className="px-6 text-body" data-testid="try-sample">
              {t.trySample}
            </ButtonLink>
            <ButtonLink href="#capture">{t.own}</ButtonLink>
          </div>
          <p className="mt-3 text-caption text-muted">{t.sampleNote}</p>
        </div>
        <figure className="mx-auto w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- a screenshot of the app (the guide card) */}
          <img src={`/landing/hero-${lang}.jpg`} alt={t.heroAlt} className="w-full rounded-md ring-1 ring-rule" />
        </figure>
      </section>

      {/* the three moments */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-16" aria-label={t.moments.map((m) => m.title).join(" / ")}>
        <ol className="grid gap-10 border-t border-rule pt-10 md:grid-cols-2">
          {t.moments.map((m, i) => (
            <li key={m.img} className="flex flex-col gap-3">
              <span className="text-caption text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <p className="font-serif text-title leading-tight">{m.title}</p>
              <p className="text-small text-paper/75">{m.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a screenshot of the app */}
              <img src={`/landing/${m.img}-${lang}.jpg`} alt="" loading="lazy" className={`mt-2 w-full rounded-md ${m.img === "postcard" ? "mx-auto max-w-[16rem]" : ""}`} />
            </li>
          ))}
        </ol>
      </section>

      {/* why it can be relied on; where it works */}
      <section className="mx-auto w-full max-w-7xl px-5" data-testid="trust">
        <div className="grid gap-12 border-t border-rule py-14 md:grid-cols-2">
        <div>
          <p className="label">{t.trustTitle}</p>
          <p className="mt-3 max-w-[36em] text-body text-paper/85">{t.trust}</p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            {t.numbers(facts).slice(0, 1).map((n) => (
              <div key={n.l} className="flex flex-col">
                <dt className="order-2 mt-1 text-caption text-muted">{n.l}</dt>
                <dd className="font-serif text-title tabular-nums">{n.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-caption text-muted">
            {t.evalNote(facts.evalRun)} ·{" "}
            <Link href="/how" className="underline decoration-rule-strong underline-offset-4 hover:text-paper">
              {t.howLink}
            </Link>
          </p>
        </div>
        <div>
          <p className="label">{t.whereTitle}</p>
          <p className="mt-3 text-body text-paper/85">{t.full(facts)}</p>
          <p className="mt-3 text-small text-paper/70">{t.elsewhere}</p>
        </div>
        </div>
      </section>

      <section id="capture" className="mx-auto w-full max-w-7xl px-5">
        <div className="flex flex-col items-start gap-6 border-t border-rule py-14">
          <div>
            <p className="label">{t.own}</p>
            <h2 className="mt-2 font-serif text-title">{t.captureTitle}</h2>
            <p className="mt-3 text-small text-paper/75">{t.captureNote}</p>
          </div>
          <CapturePreview />
        </div>
      </section>
    </main>
  );
}
