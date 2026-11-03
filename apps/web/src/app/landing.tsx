"use client";

/** The landing page in the visitor's language (FR-40); page.tsx stays a Server Component. */
import Link from "next/link";
import { CapturePreview } from "./capture-preview";
import { dict, LangToggle, useDict } from "./i18n";
import { ButtonLink } from "./ui/button";
import { Warm } from "./warm";

const THREADS = [
  { ja: "時", en: "time", color: "var(--thread-toki)" },
  { ja: "場", en: "place", color: "var(--thread-ba)" },
  { ja: "言", en: "words", color: "var(--thread-koto)" },
  { ja: "間", en: "space", color: "var(--thread-ma)" },
];

const T = dict({
  ja: {
    nav: "ページ",
    notes: "旅ノート",
    time: "時をめくる",
    kicker: "一枚の写真から、170年前の目へ",
    hero: (
      <>
        雷門の大提灯の下で、
        <br />
        バードや広重が
        <br />
        <span className="text-lantern">何を見たか</span>を、
        <br />
        根拠つきで。
      </>
    ),
    intro: (
      <>
        旅先で古い本や絵を探しても、それが<span className="text-paper">同じ場所の、同じ時代の話か</span>
        までは分かりません。1878年のイザベラ・バードは浅草を歩きましたが、そのとき雷門は焼失して存在しませんでした。TSUMUGI
        は資料をつなぐ前に、時代・場所・言葉が本当につながるかを確かめます。
      </>
    ),
    trySample: "例で試す ── 雷門",
    own: "自分の写真で",
    sampleNote: "例はライブで解析します（約40秒）。写真は Wikimedia Commons の CC0。",
    altNow: "雷門の大提灯（現在）",
    altPrint: "歌川広重《名所江戸百景 浅草金龍山》1856",
    capNow: "いまの雷門",
    capPrint: "広重《浅草金龍山》1856",
    steps: [
      { n: "01", title: "かざす", body: "目の前の景色を一枚。顔は端末の中でぼかし、位置は任意です。" },
      { n: "02", title: "紡ぐ", body: "Claude が写真の文字を読み、日英の古い旅行記・随筆・浮世絵・公式資料から根拠を探します。" },
      { n: "03", title: "確かめる", body: "書かれた年に、それは本当にあったか。年表と照合して糸を結び、合わない糸は切ります。" },
    ],
    threads: "四本の糸",
    cut: "切れた糸",
    cutNote: "その年、それはなかった",
    captureTitle: "目の前の景色を、一枚",
    captureNote: "写真は端末の中で縮小・位置情報の除去・顔のぼかしをしてから送ります。",
  },
  en: {
    nav: "Pages",
    notes: "Travel notes",
    time: "Turn the years",
    kicker: "From one photo to eyes of 170 years ago",
    hero: (
      <>
        Under Kaminarimon’s
        <br />
        great lantern,
        <br />
        <span className="text-lantern">what Bird and
        <br />
        Hiroshige saw</span> —
        <br />
        with evidence.
      </>
    ),
    intro: (
      <>
        Old books and prints are easy to find on a trip, but not whether they speak of{" "}
        <span className="text-paper">the same place, in the same era</span>. Isabella Bird walked Asakusa in 1878 — when
        the Kaminarimon gate had burnt down and did not exist. Before TSUMUGI ties sources together, it checks that the
        era, the place and the words really connect.
      </>
    ),
    trySample: "Try the example ── Kaminarimon",
    own: "With your own photo",
    sampleNote: "The example is analysed live (about 40 s). Photo: Wikimedia Commons, CC0.",
    altNow: "The great lantern of Kaminarimon (today)",
    altPrint: "Utagawa Hiroshige, One Hundred Famous Views of Edo: Kinryūzan Temple, Asakusa, 1856",
    capNow: "Kaminarimon today",
    capPrint: "Hiroshige, Kinryūzan, Asakusa, 1856",
    steps: [
      { n: "01", title: "Hold up", body: "One photo of the view in front of you. Faces are blurred on your device; location is optional." },
      { n: "02", title: "Weave", body: "Claude reads the text in the photo and looks for evidence in old Japanese and English travelogues, essays, ukiyo-e and official sources." },
      { n: "03", title: "Check", body: "Did it really exist in the year it was written about? Threads are tied against the chronology; the ones that do not fit are cut." },
    ],
    threads: "Four threads",
    cut: "Cut thread",
    cutNote: "it was not there that year",
    captureTitle: "The view in front of you, in one photo",
    captureNote: "Your photo is resized, stripped of location data and face-blurred on your device before it is sent.",
  },
});

export function Landing() {
  const t = useDict(T);
  return (
    <main className="flex flex-1 flex-col">
      <Warm />
      <header className="mx-auto flex w-full max-w-7xl items-baseline justify-between px-5 pt-6">
        <span className="font-serif text-lead tracking-[0.3em]">TSUMUGI</span>
        <nav className="flex items-center gap-1" aria-label={t.nav}>
          <Link href="/notes" className="inline-flex min-h-11 items-center px-2 text-small text-muted hover:text-paper">
            {t.notes}
          </Link>
          <Link href="/time" className="inline-flex min-h-11 items-center px-2 text-small text-muted hover:text-paper">
            {t.time}
          </Link>
          <LangToggle className="ml-2" />
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-5 pt-12 pb-16 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-16 lg:pt-16">
        <div>
          <p className="label">{t.kicker}</p>
          <h1 className="mt-6 font-serif text-title font-bold whitespace-nowrap sm:text-display xl:text-hero">{t.hero}</h1>
          <p className="mt-8 max-w-[34em] text-body text-paper/80">{t.intro}</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <ButtonLink href="/live" variant="primary" className="px-6 text-body" data-testid="try-sample">
              {t.trySample}
            </ButtonLink>
            <ButtonLink href="#capture">{t.own}</ButtonLink>
          </div>
          <p className="mt-3 text-caption text-muted">{t.sampleNote}</p>
        </div>
        <figure className="hidden lg:block">
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- the CC0 sample photo (allowlisted) */}
            <img src="/api/samples/kaminarimon_cc0.jpg" alt={t.altNow} className="aspect-[3/4] w-full rounded-md object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element -- public-domain print */}
            <img src="/api/cache/visual/images/edo100-095fe827.jpg" alt={t.altPrint} className="aspect-[3/4] w-full rounded-md object-cover object-top" />
          </div>
          <figcaption className="mt-3 flex justify-between text-caption text-muted">
            <span>{t.capNow}</span>
            <span>{t.capPrint}</span>
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-16">
        <ol className="grid border-t border-rule md:grid-cols-3 md:gap-10">
          {t.steps.map((s) => (
            <li key={s.n} className="border-b border-rule py-6 md:border-b-0">
              <span className="text-caption text-muted tabular-nums">{s.n}</span>
              <p className="mt-1 font-serif text-title leading-tight">{s.title}</p>
              <p className="mt-2 text-small text-paper/75">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="label">{t.threads}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small">
            {THREADS.map((th) => (
              <li key={th.ja} className="flex items-center gap-2">
                <svg width="24" height="4" aria-hidden>
                  <path d="M0 2 H24" stroke={th.color} strokeWidth="2" />
                </svg>
                {th.ja}
                <span className="text-caption text-muted">{th.en}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <svg width="24" height="6" aria-hidden>
                <path d="M0 3 H9 M15 3 H24" stroke="var(--paper)" strokeWidth="2" />
              </svg>
              {t.cut}
              <span className="text-caption text-muted">{t.cutNote}</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="capture" className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-5 py-14">
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
