import { CapturePreview } from "./capture-preview";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-serif text-5xl tracking-[0.3em]">TSUMUGI</h1>
        <p className="mt-3 text-muted">時代も、場所も、言葉も、空間も越えて、日本を紡ぐ。</p>
        <nav className="mt-4 flex justify-center gap-4 text-sm" aria-label="ページ">
          <a href="/notes" className="inline-flex min-h-11 items-center underline decoration-muted underline-offset-4">
            旅ノート一覧
          </a>
          <a href="/time" className="inline-flex min-h-11 items-center underline decoration-muted underline-offset-4">
            時をめくる
          </a>
        </nav>
      </header>
      <CapturePreview />
    </main>
  );
}
