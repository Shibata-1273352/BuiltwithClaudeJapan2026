import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EXP_ID_RE } from "@/lib/note-server";
import { isDemoReplay } from "@/lib/demo";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";
import { ExplorationView } from "../../exploration-view";
import { ReplayStage } from "./replay-stage";

export const metadata = { title: "TSUMUGI — 記録の再生" };

/** FR-47: a stored exploration replayed with its original pacing (only when live fails). */
async function Replay({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  if (!EXP_ID_RE.test(id)) notFound();
  const presenter = await isPresenter();
  const sid = await sessionId();
  const row = store().prepare("SELECT session_id, capture_id, created_at, status FROM explorations WHERE id = ?").get(id) as
    | { session_id: string; capture_id: string; created_at: string; status: string }
    | undefined;
  if (!row || row.status !== "done" || (!presenter && !isDemoReplay(id) && row.session_id !== sid)) notFound();
  const photo = `/api/cache/scenes/${row.capture_id}/photo.jpg`;
  // 6.4: the list (accessible, and what the E2E checks) — the stage is the default
  if (sp.view === "list") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- the recorded photo (session-scoped cache) */}
        <img src={photo} alt="" className="max-h-[50vh] w-auto self-center rounded-md" />
        <ExplorationView replay={{ explorationId: id, recordedAt: row.created_at }} />
      </main>
    );
  }
  return <ReplayStage explorationId={id} photo={photo} recordedAt={row.created_at} />;
}

export default function ReplayPage({ params, searchParams }: PageProps<"/replay/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">読み込み中…</p>}>
      <Replay params={params} searchParams={searchParams} />
    </Suspense>
  );
}
