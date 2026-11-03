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
    <ul className="flex flex-col border-t border-rule" data-testid="notes-list">
      {notes.map((n) => (
        <li key={n.id} className="flex items-center gap-2 border-b border-rule">
          <a href={`/note/${n.id}`} className="flex min-h-11 flex-1 items-baseline justify-between gap-4 py-4 hover:text-paper">
            <span className="font-serif text-lead">{n.place?.name.ja}</span>
            <span className="text-small text-muted tabular-nums">
              {new Date(n.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} · {n.sentences} 文
            </span>
          </a>
          {/* FR-47: replay the recorded exploration (when live is not possible) */}
          <a href={`/replay/${n.id}`} className="inline-flex min-h-11 items-center px-2 text-small text-muted underline decoration-rule-strong underline-offset-4 hover:text-paper" aria-label={`${n.place?.name.ja}の探索を記録から再生`}>
            再生
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-display">旅ノート</h1>
      <p className="text-small text-muted">撮った写真と旅ノートは、保存から7日で自動的に削除されます。</p>
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <List />
      </Suspense>
    </main>
  );
}
