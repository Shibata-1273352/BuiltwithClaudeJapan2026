import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { demoReplayId } from "@/lib/demo";
import { HealthPanel } from "./health-panel";
import { PresentLive } from "./present-live";

export const metadata = { title: "TSUMUGI — 発表モード" };

async function Live({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const r = (await searchParams).replay;
  // FR-47: ?replay=<exploration id> replays a recording (validated; the events route checks access)
  return <PresentLive replayId={r && /^exp_[0-9a-f]{20}$/.test(r) ? r : undefined} />;
}

/** 撮影の場面: each take opens in presenter mode (the reveal held until the years enter an absent period) */
async function Takes() {
  await connection(); // the recording id is read at request time, not at build
  const id = demoReplayId();
  if (!id) return null;
  const R = `/replay/${id}`;
  const takes: [string, string][] = [
    ["入口", "/?present=1"],
    ["場面 2–4：読む → 時をめくる（ゆっくり）", `${R}?present=1&hold=broken&speed=0.5`],
    ["場面 2–4：通常の速さ", `${R}?present=1&hold=broken`],
    ["英語で", `${R}?present=1&hold=broken&lang=en`],
    ["終わった舞台から（絵の中へ・寄進・確かめる）", `${R}?present=1&hold=broken&at=end`],
    ["しくみ", "/how?present=1"],
  ];
  return (
    <section className="border-t border-rule pt-6" data-testid="takes">
      <p className="label">撮影の場面</p>
      <ul className="mt-3 flex flex-col">
        {takes.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-11 items-center text-body text-paper underline decoration-rule-strong underline-offset-4 hover:decoration-paper">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PresentPage({ searchParams }: PageProps<"/present">) {
  return (
    <main className="flex min-h-screen flex-1 flex-col gap-8 px-12 py-10">
      <header className="flex items-start justify-between gap-8">
        <h1 className="font-serif text-display">発表モード</h1>
        <div className="text-body">
          <Suspense fallback={<p className="text-muted">接続を確認中…</p>}>
            <HealthPanel />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={null}>
        <Takes />
      </Suspense>
      <Suspense fallback={null}>
        <Live searchParams={searchParams as Promise<{ replay?: string }>} />
      </Suspense>
    </main>
  );
}
