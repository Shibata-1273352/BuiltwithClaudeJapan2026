"use client";

/**
 * 旅ノート (FR-42, screen 8): the photo and its cut-outs, the story, and for each sentence the claims
 * it cites with the original text, a reference translation and the source ticket (切符).
 */
import { useEffect, useState } from "react";
import type { Cite, Lang, Note, NarrativeLike } from "@/lib/note";
import { VisualHitCard } from "../../visual-hit";

const T = {
  ja: {
    title: "旅ノート",
    story: "物語",
    pick: "文を選ぶと、その文の根拠が出ます。",
    evidence: "根拠",
    original: "原文",
    ref: "参考訳（Claudeによる機械訳。根拠は原文）",
    refLoading: "参考訳を作っています…",
    threads: "糸",
    tickets: "切符（出典）",
    cited: "引用",
    space: "間（ま）で見る",
    aligned: "広重の絵と位置合わせ済み",
    seen: "写真の中で読めたもの",
    confirm: "確認しました",
    unconfirm: "確認を取り消す",
    visual: "提灯から提灯へ（似た図像。根拠ではありません）",
    noNarrative: "この言語の物語はまだありません。",
    make: "作る",
    derived: "推論（年表との照合）",
    interpretive: "解釈",
    direct: "資料の記述",
    stats: (s: Note["stats"]) => `${((s.elapsed_ms ?? 0) / 1000).toFixed(1)} 秒 · Claude ${s.claude_calls ?? "?"} 回 · $${(s.cost_usd ?? 0).toFixed(3)}`,
  },
  en: {
    title: "Travel note",
    story: "Story",
    pick: "Choose a sentence to see its evidence.",
    evidence: "Evidence",
    original: "Original",
    ref: "Reference translation (machine, by Claude; the original is the evidence)",
    refLoading: "Translating…",
    threads: "Threads",
    tickets: "Tickets (sources)",
    cited: "cited",
    space: "View in 間 (ma)",
    aligned: "aligned to the Hiroshige print",
    seen: "Read in the photo",
    confirm: "I checked this",
    unconfirm: "Undo my check",
    visual: "Lantern to lantern (similar images, not evidence)",
    noNarrative: "No story in this language yet.",
    make: "Write it",
    derived: "derived (checked against the chronology)",
    interpretive: "interpretation",
    direct: "stated by the source",
    stats: (s: Note["stats"]) => `${((s.elapsed_ms ?? 0) / 1000).toFixed(1)} s · Claude ${s.claude_calls ?? "?"} calls · $${(s.cost_usd ?? 0).toFixed(3)}`,
  },
};

const STATE: Record<string, { ja: string; en: string; cls: string }> = {
  ink: { ja: "インク", en: "ink", cls: "border-solid" },
  combined: { ja: "組み合わせ", en: "combined", cls: "border-solid" },
  absent: { ja: "不在", en: "absent", cls: "border-dashed" },
  conflict: { ja: "相違", en: "conflict", cls: "border-double" },
  pencil: { ja: "鉛筆", en: "pencil", cls: "border-dotted" },
  pending: { ja: "確認待ち", en: "pending", cls: "border-dotted opacity-70" },
  user_confirmed: { ja: "あなたの確認", en: "confirmed by you", cls: "border-double" },
};
const LAYER: Record<string, string> = { toki: "border-toki", ba: "border-ba", koto: "border-koto", ma: "border-ma" };

export function NoteView({ note, initialLang }: { note: Note; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [narratives, setNarratives] = useState(note.narratives);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [refs, setRefs] = useState<Partial<Record<Lang, Record<string, string>>>>({});
  const [confirmed, setConfirmed] = useState<Record<string, string | undefined>>(Object.fromEntries(note.threads.map((t) => [t.id, t.confirmedAt])));
  async function toggleConfirm(threadId: string) {
    const on = !confirmed[threadId];
    const r = await fetch(`/api/explorations/${note.id}/confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, confirmed: on }),
    });
    if (r.ok) setConfirmed((p) => ({ ...p, [threadId]: on ? new Date().toISOString() : undefined }));
  }
  const t = T[lang];
  const narrative: NarrativeLike | undefined = narratives[lang];
  const sentence = narrative?.sentences[selected];
  const cites = (sentence?.claim_ids ?? []).map((id) => note.cites[id]).filter((c): c is Cite => Boolean(c));
  const needsRef = cites.some((c) => c.kind === "evidence" && c.lang !== lang);

  useEffect(() => {
    if (!needsRef || refs[lang]) return;
    let off = false;
    void fetch(`/api/explorations/${note.id}/translations?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then((j: { items: Record<string, string> }) => !off && setRefs((p) => ({ ...p, [lang]: j.items })));
    return () => {
      off = true;
    };
  }, [lang, needsRef, note.id, refs]);

  async function makeNarrative() {
    setBusy(true);
    try {
      const r = await fetch(`/api/explorations/${note.id}/narrative?lang=${lang}`);
      if (r.ok) {
        const j = (await r.json()) as NarrativeLike;
        setNarratives((p) => ({ ...p, [lang]: { ...j, lang } }));
        setSelected(0);
      }
    } finally {
      setBusy(false);
    }
  }

  const photo = note.space && note.captureId ? `/api/cache/scenes/${note.captureId}/photo.jpg` : null;
  const cutouts = note.space && note.captureId ? note.space.elements.filter((e) => e !== "people").map((e) => ({ e, src: `/api/cache/scenes/${note.captureId}/${e}.png` })) : [];

  return (
    <article className="flex flex-col gap-10" data-testid="travel-note" lang={lang}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-widest text-muted">{t.title}</p>
          <h1 className="font-serif text-4xl md:text-5xl">{note.place?.path.join(" › ") ?? "—"}</h1>
        </div>
        <div className="flex gap-2" role="group" aria-label="language">
          {(["ja", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setSelected(0);
              }}
              aria-pressed={lang === l}
              className={`min-h-11 min-w-11 rounded-full border px-4 ${lang === l ? "border-lantern text-lantern" : "border-muted/40"}`}
              data-testid={`note-lang-${l}`}
            >
              {l === "ja" ? "日本語" : "English"}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, session-scoped cache file
          <img src={photo} alt="" className="max-h-[70vh] w-full rounded-lg object-contain" />
        ) : (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-muted/30 text-muted">空間解析：簡易表示</div>
        )}
        <div className="flex flex-col gap-4">
          {cutouts.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {cutouts.map((c) => (
                // eslint-disable-next-line @next/next/no-img-element -- cut-out PNG with alpha
                <img key={c.e} src={c.src} alt={c.e} className="h-24 w-auto rounded bg-night/60 object-contain p-1" />
              ))}
            </div>
          )}
          <h2 className="font-serif text-xl">{t.seen}</h2>
          <ul className="flex flex-col gap-2">
            {note.see
              .filter((s) => s.text_original)
              .slice(0, 4)
              .map((s, i) => (
                <li key={i}>
                  <span className="font-serif text-2xl" lang="ja">
                    {s.text_original}
                  </span>{" "}
                  <span className="text-sm text-muted">
                    {s.reading} — {s.meaning?.[lang]}
                  </span>
                </li>
              ))}
          </ul>
          {note.space && (
            <a href={note.space.url} className="underline decoration-ma underline-offset-4">
              {t.space}
              {note.space.aligned ? `（${t.aligned}）` : ""}
            </a>
          )}
        </div>
      </section>

      {note.visual.length > 0 && (
        <section data-testid="note-visual">
          <h2 className="mb-3 font-serif text-xl">{t.visual}</h2>
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {note.visual.map((h) => (
              <VisualHitCard key={h.id} h={h} width="w-28" />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-1 font-serif text-2xl">{t.story}</h2>
          <p className="mb-4 text-sm text-muted">{t.pick}</p>
          {narrative?.sentences.length ? (
            <ol className="flex flex-col gap-3 text-lg leading-relaxed" data-testid="note-sentences">
              {narrative.sentences.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={selected === i}
                    className={`w-full rounded-md border-l-4 px-3 py-2 text-left ${selected === i ? "border-lantern bg-paper/5" : "border-transparent hover:bg-paper/5"}`}
                  >
                    {s.text}
                    <span className="ml-2 align-middle text-xs text-muted">{t[s.assertion_type as "direct" | "derived" | "interpretive"] ?? s.assertion_type}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">
              {t.noNarrative}{" "}
              <button type="button" onClick={makeNarrative} disabled={busy} className="min-h-11 rounded-full border border-lantern px-4 text-lantern">
                {busy ? "…" : t.make}
              </button>
            </p>
          )}
        </div>

        <aside aria-live="polite" data-testid="note-evidence">
          <h2 className="mb-4 font-serif text-2xl">{t.evidence}</h2>
          <ul className="flex flex-col gap-4">
            {cites.map((c) => (
              <li key={c.claimId} className="rounded-lg border border-muted/30 p-4">
                <p className="text-sm text-muted">
                  {c.sourceTitle} <span className="font-mono text-xs">· {c.claimId}</span>
                </p>
                {c.kind === "evidence" ? (
                  <>
                    <blockquote className="mt-2 border-l-2 border-koto pl-3 font-serif" lang={c.lang}>
                      <span className="sr-only">{t.original}: </span>
                      {c.excerpt}
                    </blockquote>
                    <p className="mt-1 font-mono text-xs text-muted">{c.sentenceIds.join(", ")}</p>
                    {c.lang !== lang && (
                      <p className="mt-2 text-sm">
                        <span className="text-xs text-muted">{t.ref}：</span>
                        {refs[lang] ? (refs[lang]?.[c.sentenceIds.join("|")] ?? "—") : t.refLoading}
                      </p>
                    )}
                  </>
                ) : (
                  <p className={`mt-2 border-l-4 pl-3 ${LAYER.toki} ${STATE[c.state]?.cls ?? ""}`}>
                    <span className="text-sm text-muted">[{STATE[c.state]?.[lang] ?? c.state}] </span>
                    {c.label[lang]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-2xl">{t.threads}</h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {note.threads
            .filter((th) => th.state !== "ink" || th.layer !== "koto")
            .sort((a, b) => Number(b.state === "pending" || b.state === "pencil") - Number(a.state === "pending" || a.state === "pencil"))
            .slice(0, 14)
            .map((th) => (
              <li
                key={th.id}
                className={`border-l-4 pl-3 ${LAYER[th.layer] ?? ""} ${confirmed[th.id] ? STATE.user_confirmed.cls : (STATE[th.state]?.cls ?? "")}`}
                data-testid={`thread-${th.state}`}
              >
                <span className="text-muted">
                  [{confirmed[th.id] ? `${STATE.user_confirmed[lang]}（${STATE[th.state]?.[lang] ?? th.state}）` : (STATE[th.state]?.[lang] ?? th.state)}]
                </span>{" "}
                {th.label[lang]}
                {(th.state === "pending" || th.state === "pencil") && (
                  <button
                    type="button"
                    onClick={() => toggleConfirm(th.id)}
                    aria-pressed={Boolean(confirmed[th.id])}
                    className="ml-2 inline-flex min-h-11 items-center rounded-full border border-muted/50 px-3 text-xs"
                    data-testid="confirm-thread"
                  >
                    {confirmed[th.id] ? t.unconfirm : t.confirm}
                  </button>
                )}
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-2xl">{t.tickets}</h2>
        <ul className="grid gap-4 md:grid-cols-3" data-testid="note-tickets">
          {note.tickets.map((k) => (
            <li key={k.id} className="relative rounded-md border border-dashed border-lantern/60 bg-paper/5 p-4">
              <p className="font-serif text-lg" lang={k.lang}>
                {k.title}
              </p>
              <p className="text-sm">
                {k.author ?? ""}
                {k.first_published ? ` · ${k.first_published}` : ""}
              </p>
              <p className="mt-2 text-xs text-muted">{[k.provider, k.edition, k.license].filter(Boolean).join(" · ")}</p>
              {k.url && (
                <a href={k.url} className="mt-2 block truncate text-xs underline" rel="noreferrer noopener" target="_blank">
                  {k.url}
                </a>
              )}
              <p className="absolute top-3 right-3 text-xs text-muted">
                {t.cited} {k.cited}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-muted tabular-nums">
        {note.id} · {t.stats(note.stats)}
      </footer>
    </article>
  );
}
