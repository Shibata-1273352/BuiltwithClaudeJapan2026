import { connection } from "next/server";
import { Suspense } from "react";
import { notesFor } from "@/lib/notes-list";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { LoadingText } from "../loading-text";
import { NotesHeader, NotesList } from "./notes-view";

export const metadata = { title: "TSUMUGI — 旅ノート一覧" };

async function List() {
  await connection();
  const notes = notesFor({ sid: await sessionId(), presenter: await isPresenter() });
  return <NotesList notes={notes} />;
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <NotesHeader />
      <Suspense fallback={<LoadingText />}>
        <List />
      </Suspense>
    </main>
  );
}
