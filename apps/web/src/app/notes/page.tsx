import { connection } from "next/server";
import { Suspense } from "react";
import { notesFor } from "@/lib/notes-list";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";

export const metadata = { title: "TSUMUGI — 旅ノート一覧" };

async function List() {
  await connection();
  const notes = notesFor({ sid: await sessionId(), presenter: await isPresenter() });
  if (!notes.length) return <p className="text-muted">まだ旅ノートはありません。写真を撮って紡ぐと、ここに残ります（7日間）。</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="notes-list">
      {notes.map((n) => (
        <li key={n.id}>
          <a href={`/note/${n.id}`} className="flex min-h-11 items-baseline justify-between gap-4 rounded-lg border border-muted/30 px-4 py-3 hover:border-lantern">
            <span className="font-serif text-xl">{n.place?.name.ja}</span>
            <span className="text-sm text-muted tabular-nums">
              {new Date(n.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} · {n.sentences} 文
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-4xl">旅ノート</h1>
      <p className="text-sm text-muted">撮った写真と旅ノートは、保存から7日で自動的に削除されます。</p>
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <List />
      </Suspense>
    </main>
  );
}
