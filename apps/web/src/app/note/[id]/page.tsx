import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadNote } from "@/lib/note-server";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { LoadingText } from "../../loading-text";
import { NoteView } from "./note-view";

export const metadata = { title: "TSUMUGI — 旅ノート" };

// the language (?lang= or the cookie) is read on the client by the shared LangProvider (FR-40)
async function Note({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const note = loadNote(id, { sid: await sessionId(), presenter: await isPresenter() });
  if (!note) notFound();
  return <NoteView note={note} />;
}

export default function NotePage({ params }: PageProps<"/note/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10">
      <Suspense fallback={<LoadingText />}>
        <Note params={params} />
      </Suspense>
    </main>
  );
}
