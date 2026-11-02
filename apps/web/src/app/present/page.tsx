import { Suspense } from "react";
import { HealthPanel } from "./health-panel";
import { PresentLive } from "./present-live";

export const metadata = { title: "TSUMUGI — 発表モード" };

export default function PresentPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col gap-8 px-12 py-10">
      <header className="flex items-start justify-between gap-8">
        <h1 className="font-serif text-5xl">発表モード</h1>
        <div className="text-base">
          <Suspense fallback={<p className="text-muted">接続を確認中…</p>}>
            <HealthPanel />
          </Suspense>
        </div>
      </header>
      <PresentLive />
    </main>
  );
}
