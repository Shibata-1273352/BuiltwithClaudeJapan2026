"use client";

/** The travel-note list in the visitor's language (FR-40, FR-43); the data comes from the server page. */
import type { NoteSummary } from "@/lib/notes-list";
import { dict, LangToggle, useDict, useLang } from "../i18n";

const T = dict({
  ja: {
    title: "旅ノート",
    retention: "撮った写真と旅ノートは、保存から7日で自動的に削除されます。",
    empty: "まだ旅ノートはありません。写真を撮って紡ぐと、ここに残ります（7日間）。",
    sentences: (n: number) => `${n} 文`,
    replay: "再生",
    replayLabel: (place: string) => `${place}の探索を記録から再生`,
  },
  en: {
    title: "Travel notes",
    retention: "Your photos and travel notes are deleted automatically 7 days after they were saved.",
    empty: "No travel notes yet. Take a photo and weave it, and the note stays here (for 7 days).",
    sentences: (n: number) => `${n} sentence${n === 1 ? "" : "s"}`,
    replay: "Replay",
    replayLabel: (place: string) => `Replay the recorded exploration of ${place}`,
  },
});

export function NotesHeader() {
  const t = useDict(T);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-display">{t.title}</h1>
        <LangToggle />
      </div>
      <p className="text-small text-muted">{t.retention}</p>
    </>
  );
}

export function NotesList({ notes }: { notes: NoteSummary[] }) {
  const t = useDict(T);
  const lang = useLang();
  if (!notes.length) return <p className="text-muted">{t.empty}</p>;
  return (
    <ul className="flex flex-col border-t border-rule" data-testid="notes-list">
      {notes.map((n) => (
        <li key={n.id} className="flex items-center gap-2 border-b border-rule">
          <a href={`/note/${n.id}`} className="flex min-h-11 flex-1 items-baseline justify-between gap-4 py-4 hover:text-paper">
            <span className="font-serif text-lead">{n.place?.name[lang]}</span>
            <span className="text-small text-muted tabular-nums">
              {new Date(n.created_at).toLocaleString(lang === "en" ? "en-GB" : "ja-JP", { timeZone: "Asia/Tokyo" })} · {t.sentences(n.sentences)}
            </span>
          </a>
          {/* FR-47: replay the recorded exploration (when live is not possible) */}
          <a
            href={`/replay/${n.id}`}
            className="inline-flex min-h-11 items-center px-2 text-small text-muted underline decoration-rule-strong underline-offset-4 hover:text-paper"
            aria-label={t.replayLabel(n.place?.name[lang] ?? "")}
          >
            {t.replay}
          </a>
        </li>
      ))}
    </ul>
  );
}
