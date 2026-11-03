import { Suspense } from "react";
import { HealthPanel } from "./health-panel";
import { PresentLive } from "./present-live";

export const metadata = { title: "TSUMUGI — 発表モード" };

async function Live({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const r = (await searchParams).replay;
  // FR-47: ?replay=<exploration id> replays a recording (validated; the events route checks access)
  return <PresentLive replayId={r && /^exp_[0-9a-f]{20}$/.test(r) ? r : undefined} />;
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
        <Live searchParams={searchParams as Promise<{ replay?: string }>} />
      </Suspense>
    </main>
  );
}
