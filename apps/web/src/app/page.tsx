import Link from "next/link";
import { CapturePreview } from "./capture-preview";

const STEPS = [
  { n: "01", ja: "かざす", body: "目の前の景色を一枚。顔は端末の中でぼかし、位置は任意です。" },
  { n: "02", ja: "紡ぐ", body: "Claude が写真の文字を読み、日英の古い旅行記・随筆・浮世絵・公式資料から根拠を探します。" },
  { n: "03", ja: "確かめる", body: "書かれた年に、それは本当にあったか。年表と照合して糸を結び、合わない糸は切ります。" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-12 pb-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-20">
        <div>
          <p className="text-sm tracking-[0.35em] text-lantern">一枚の写真から、170年前の目へ</p>
          <h1 className="mt-5 font-serif text-4xl leading-[1.35] font-bold sm:text-5xl lg:text-[3.4rem]">
            雷門の大提灯の下で、
            <br />
            バードや広重が
            <br />
            <span className="text-lantern">何を見たか</span>を、
            <br />
            根拠つきで。
          </h1>
          <p className="mt-6 max-w-xl leading-relaxed text-paper/85">
            旅先で古い本や絵を探しても、それが<strong className="text-paper">同じ場所の、同じ時代の話か</strong>
            までは分かりません。1878年のイザベラ・バードは浅草を歩きましたが、そのとき雷門は焼失して存在しませんでした。TSUMUGI
            は資料をつなぐ前に、時代・場所・言葉が本当につながるかを確かめます。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/live" className="lantern-halo inline-flex min-h-12 items-center rounded-full bg-lantern px-7 text-lg font-bold text-night" data-testid="try-sample">
              例で試す（雷門・CC0写真）
            </Link>
            <a href="#capture" className="inline-flex min-h-12 items-center rounded-full border border-paper/40 px-6">
              自分の写真で
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">例はライブで実際に解析します（約40秒）。写真は Wikimedia Commons の CC0。</p>
        </div>
        <ol className="grid gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl bg-night-2 p-5 ring-1 ring-muted/15">
              <p className="flex items-baseline gap-3">
                <span className="font-serif text-sm text-lantern tabular-nums">{s.n}</span>
                <span className="font-serif text-2xl">{s.ja}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper/80">{s.body}</p>
            </li>
          ))}
          <li className="px-1 text-xs leading-relaxed text-muted">
            糸の色：<span className="text-toki">時</span>・<span className="text-ba">場</span>・<span className="text-koto">言</span>・<span className="text-ma">間</span>。
            切れた糸は失敗ではなく、発見です。
          </li>
        </ol>
      </section>

      <section id="capture" className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 border-t border-muted/15 px-5 py-12">
        <h2 className="font-serif text-2xl">自分の写真で紡ぐ</h2>
        <CapturePreview />
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-4 px-5 py-8 text-sm text-muted">
        <span className="font-serif tracking-[0.3em] text-paper">TSUMUGI</span>
        <nav className="flex gap-5" aria-label="ページ">
          <Link href="/notes" className="inline-flex min-h-11 items-center underline decoration-muted underline-offset-4">
            旅ノート一覧
          </Link>
          <Link href="/time" className="inline-flex min-h-11 items-center underline decoration-muted underline-offset-4">
            時をめくる
          </Link>
        </nav>
      </footer>
    </main>
  );
}
