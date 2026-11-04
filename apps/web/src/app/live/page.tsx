import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { demoReplayId } from "@/lib/demo";
import { EXP_ID_RE } from "@/lib/note-server";
import { TRY_SAMPLES } from "@/lib/samples";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";
import { AttachStage, SampleStage } from "./sample-stage";

export const metadata = { title: "TSUMUGI — 例で試す" };

async function Live({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { run, sample } = await searchParams;
  // ?run=<id>: the visitor came back (from the note, the print, /how) to a run of this session — show it, start nothing
  if (typeof run === "string" && EXP_ID_RE.test(run)) {
    const sid = await sessionId();
    const row = store().prepare("SELECT session_id, capture_id FROM explorations WHERE id = ?").get(run) as { session_id: string; capture_id: string } | undefined;
    if (row && sid && row.session_id === sid) return <AttachStage explorationId={run} photo={`/api/cache/scenes/${row.capture_id}/photo.jpg`} demoReplay={demoReplayId()} />;
    redirect("/"); // someone else's or a stale link: never a new paid run
  }
  return <SampleStage name={typeof sample === "string" && TRY_SAMPLES.has(sample) ? sample : "kaminarimon_cc0.jpg"} demoReplay={demoReplayId()} />;
}

/** "例で試す": a LIVE exploration of a CC0 sample photo (Kaminarimon unless ?sample= names another); the recording is offered only if live is refused. */
export default function LivePage({ searchParams }: PageProps<"/live">) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">準備中…</p>}>
      <Live searchParams={searchParams as Promise<Record<string, string | string[] | undefined>>} />
    </Suspense>
  );
}
