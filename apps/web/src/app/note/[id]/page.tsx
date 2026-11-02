import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadNote } from "@/lib/note-server";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { NoteView } from "./note-view";

export const metadata = { title: "TSUMUGI — 旅ノート" };

async function Note({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  await connection();
  const { id } = await params;
  const note = loadNote(id, { sid: await sessionId(), presenter: await isPresenter() });
  if (!note) notFound();
  const asked = (await searchParams).lang;
  return <NoteView note={note} initialLang={asked === "en" ? "en" : "ja"} />;
}

export default function NotePage({ params, searchParams }: PageProps<"/note/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10">
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <Note params={params} searchParams={searchParams as Promise<{ lang?: string }>} />
      </Suspense>
    </main>
  );
}
