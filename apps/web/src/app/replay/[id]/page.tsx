import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EXP_ID_RE } from "@/lib/note-server";
import { isDemoReplay } from "@/lib/demo";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";
import { ExplorationView } from "../../exploration-view";

export const metadata = { title: "TSUMUGI — 記録の再生" };

/** FR-47: a stored exploration replayed with its original pacing (only when live fails). */
async function Replay({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!EXP_ID_RE.test(id)) notFound();
  const presenter = await isPresenter();
  const sid = await sessionId();
  const row = store().prepare("SELECT session_id, capture_id, created_at, status FROM explorations WHERE id = ?").get(id) as
    | { session_id: string; capture_id: string; created_at: string; status: string }
    | undefined;
  if (!row || row.status !== "done" || (!presenter && !isDemoReplay(id) && row.session_id !== sid)) notFound();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- the recorded photo (session-scoped cache) */}
      <img src={`/api/cache/scenes/${row.capture_id}/photo.jpg`} alt="" className="max-h-[50vh] w-auto self-center rounded-lg" />
      <ExplorationView replay={{ explorationId: id, recordedAt: row.created_at }} />
    </>
  );
}

export default function ReplayPage({ params }: PageProps<"/replay/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <Replay params={params} />
      </Suspense>
    </main>
  );
}
