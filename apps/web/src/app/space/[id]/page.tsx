import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { readCacheJson } from "@/lib/data-files";
import { entities } from "@/lib/entities-server";
import { timelineData } from "@/lib/timeline-server";
import type { SceneJson } from "@/lib/scene";
import { SpaceViewer } from "./space-viewer";

export const metadata = { title: "TSUMUGI — 間" };

async function Scene({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const scene = await readCacheJson<SceneJson>("scenes", id, "scene.json");
  if (!scene) notFound();
  // The photo's subject is fixed for the demo scenes; the time slider uses the reviewed timeline (FR-56).
  const target = "ent:kaminarimon";
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
