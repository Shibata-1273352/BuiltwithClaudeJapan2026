import { Suspense } from "react";
import { HealthPanel } from "./health-panel";

export const metadata = { title: "TSUMUGI — 発表モード" };

export default function PresentPage() {
  return (
    <main className="flex flex-1 flex-col gap-10 px-12 py-10 text-2xl">
      <h1 className="font-serif text-5xl">発表モード</h1>
      <p className="text-muted">
        探索の各段階・Claude の呼び出し・所要時間・費用をここに表示します（FR-46、11/7 実装予定）。
      </p>
      <Suspense fallback={<p className="text-muted">接続を確認中…</p>}>
        <HealthPanel />
      </Suspense>
    </main>
  );
}
