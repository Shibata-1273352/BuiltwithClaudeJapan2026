import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readCacheJson } from "@/lib/data-files";
import type { SceneJson } from "@/lib/scene";
import { SpaceViewer } from "./space-viewer";

export const metadata = { title: "TSUMUGI — 間" };

async function Scene({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const scene = await readCacheJson<SceneJson>("scenes", id, "scene.json");
  if (!scene) notFound();
  return <SpaceViewer id={id} scene={scene} />;
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
