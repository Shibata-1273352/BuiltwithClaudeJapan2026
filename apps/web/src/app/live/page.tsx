import { connection } from "next/server";
import { Suspense } from "react";
import { demoReplayId } from "@/lib/demo";
import { SampleStage } from "./sample-stage";

export const metadata = { title: "TSUMUGI — 例で試す（雷門）" };

async function Live() {
  await connection();
  return <SampleStage demoReplay={demoReplayId()} />;
}

/** "例で試す": a LIVE exploration of the CC0 Kaminarimon photo; the recording is offered only if live is refused. */
export default function LivePage() {
  return (
    <Suspense fallback={<p className="p-10 text-muted">準備中…</p>}>
      <Live />
    </Suspense>
  );
}
