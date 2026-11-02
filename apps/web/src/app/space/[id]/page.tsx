import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { readCacheJson } from "@/lib/data-files";
import { entities } from "@/lib/entities-server";
import { timelineData } from "@/lib/timeline-server";
import { isPresenter } from "@/lib/presenter";
import type { SceneJson } from "@/lib/scene";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";
import { SpaceViewer } from "./space-viewer";

export const metadata = { title: "TSUMUGI — 間" };

async function Scene({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  // A visitor's own photo (cap_…): only its session or the read-only presenter (same rule as the cache route)
  let target = "ent:kaminarimon"; // the prepared demo scenes are of Kaminarimon
  if (id.startsWith("cap_")) {
    const presenter = await isPresenter();
    const sid = await sessionId();
    const own = presenter || (sid && store().prepare("SELECT 1 FROM captures WHERE id = ? AND session_id = ?").get(id, sid));
    if (!own) notFound();
    // the subject is the place the exploration of this photo settled on
    const row = store().prepare("SELECT result_json FROM explorations WHERE capture_id = ? AND result_json IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(id) as
      | { result_json: string }
      | undefined;
    const place = row ? (JSON.parse(row.result_json) as { place?: string }).place : undefined;
    if (place && entities().get(place)) target = place;
  }
  const scene = await readCacheJson<SceneJson>("scenes", id, "scene.json");
  if (!scene) notFound();
  // The time slider uses the reviewed timeline of the subject (FR-56).
  const titles = sourceTitles();
  const tl = timelineData(target, entities().get(target)?.name, (s) => titles.get(s) ?? s);
  return <SpaceViewer id={id} scene={scene} timeline={tl} />;
}

export default function SpacePage(props: PageProps<"/space/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="p-8 text-muted">読み込み中…</p>}>
        <Scene params={props.params} />
      </Suspense>
    </main>
  );
}
