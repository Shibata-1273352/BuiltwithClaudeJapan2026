import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { readCacheJson } from "@/lib/data-files";
import { entities } from "@/lib/entities-server";
import { timelineData } from "@/lib/timeline-server";
import { demoCaptureId } from "@/lib/demo";
import { isPresenter } from "@/lib/presenter";
import type { SceneJson } from "@/lib/scene";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";
import { SpaceViewer } from "./space-viewer";

export const metadata = { title: "TSUMUGI — 間" };

async function Scene({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enter?: string; "2d"?: string; film?: string; "3d"?: string }> }) {
  await connection();
  const { id } = await params;
  // A visitor's own photo (cap_…): only its session or the read-only presenter (same rule as the cache route)
  let target = "ent:kaminarimon"; // the prepared demo scenes are of Kaminarimon
  if (id.startsWith("cap_")) {
    const presenter = await isPresenter();
    const sid = await sessionId();
    const own = presenter || id === demoCaptureId() || (sid && store().prepare("SELECT 1 FROM captures WHERE id = ? AND session_id = ?").get(id, sid));
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
  const sp = await searchParams;
  return <SpaceViewer id={id} scene={scene} timeline={tl} autoEnter={sp.enter === "1"} force2d={sp["2d"] === "1"} force3d={sp["3d"] === "1"} film={sp.film === "1"} />;
}

export default function SpacePage(props: PageProps<"/space/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="flex-1" />}>
        <Scene params={props.params} searchParams={props.searchParams as Promise<{ enter?: string; "2d"?: string; film?: string; "3d"?: string }>} />
      </Suspense>
    </main>
  );
}
