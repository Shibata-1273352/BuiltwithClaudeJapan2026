"use client";

/**
 * 旅ノート (FR-42, screen 8): the photo and its cut-outs, the story, and for each sentence the claims
 * it cites with the original text, a reference translation and the source ticket (切符).
 */
import { BackLink } from "../../ui/back-link";
import { PostcardButton } from "../../postcard-button";
import { useEffect, useState } from "react";
import type { Cite, Lang, Note, NarrativeLike } from "@/lib/note";
import { dict, useLang, useSetLang } from "../../i18n";
import { VisualHitCard } from "../../visual-hit";
import { Button, ButtonLink } from "../../ui/button";
import { Pencil, Section } from "../../ui/marks";
import { LoomLegend } from "../../ui/legend";

const T = dict({
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
    confirm: "確かめた印をつける",
    unconfirm: "印を外す",
    visual: "提灯から提灯へ・似た図像",
    noNarrative: "この言語の物語はまだありません。",
    make: "作る",
    derived: "推論（年表との照合）",
    interpretive: "解釈",
    direct: "資料の記述",
    simple: "空間解析：簡易表示",
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
    confirm: "Mark as checked by me",
    unconfirm: "Remove my mark",
    visual: "Lantern to lantern · similar images",
    noNarrative: "No story in this language yet.",
    make: "Write it",
    derived: "derived (checked against the chronology)",
    interpretive: "interpretation",
    direct: "stated by the source",
    stats: (s: Note["stats"]) => `${((s.elapsed_ms ?? 0) / 1000).toFixed(1)} s · Claude ${s.claude_calls ?? "?"} calls · $${(s.cost_usd ?? 0).toFixed(3)}`,
    simple: "Spatial analysis: simple view",
  },
});

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
/** graph predicates in labels read as words, not ids (CLAUDE.md design 9) */
const PRED: Record<string, { ja: string; en: string }> = {
  destroyed_in: { ja: "焼失", en: "destroyed" },
  rebuilt_in: { ja: "再建", en: "rebuilt" },
  built_in: { ja: "建立", en: "built" },
  describes: { ja: "記述", en: "describes" },
  mentions: { ja: "言及", en: "mentions" },
  observed: { ja: "観察", en: "observed" },
  named_as: { ja: "呼び名", en: "named" },
  dedicated_to: { ja: "祀る", en: "dedicated to" },
  depicts: { ja: "描く", en: "depicts" },
};
const plain = (s: string, lang: Lang) =>
  s.replace(/（([a-z_]+)(「[^」]*」)?）/g, (m, p: string, q?: string) => (PRED[p] ? `（${PRED[p][lang]}${q ?? ""}）` : m));

export function NoteView({ note }: { note: Note }) {
  // the page language (FR-40): ?lang= or the cookie, shared with every other screen
  const lang = useLang();
  const setLang = useSetLang();
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

  const path = (lang === "en" ? note.place?.pathEn : undefined) ?? note.place?.path ?? [];
  return (
    <article className="flex flex-col gap-14" data-testid="travel-note" lang={lang}>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div>
          <BackLink className="-ml-1 mb-2" />
          <p className="label">
            {t.title}
            {path.length > 1 ? (lang === "en" ? ` / ${path.slice(0, -1).join(" / ")}` : ` ／ ${path.slice(0, -1).join(" ／ ")}`) : ""}
          </p>
          <h1 className="mt-2 font-serif text-display font-bold">{path.at(-1) ?? "—"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PostcardButton expId={note.id} />
        <div className="flex rounded-sm border border-rule-strong" role="group" aria-label="language">
          {(["ja", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setSelected(0);
              }}
              aria-pressed={lang === l}
              className={`min-h-11 min-w-11 px-4 text-small ${lang === l ? "bg-paper text-night" : "text-muted hover:text-paper"}`}
              data-testid={`note-lang-${l}`}
            >
              {l === "ja" ? "日本語" : "English"}
            </button>
          ))}
        </div>
        </div>
      </header>

      <section className="grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, session-scoped cache file
          <img src={photo} alt="" className="max-h-[78vh] w-full rounded-md object-contain object-left" />
        ) : (
          <div className="flex min-h-64 items-center justify-center border-y border-rule text-muted">{t.simple}</div>
        )}
        <div className="flex flex-col gap-6">
          <div>
            <p className="label">{t.seen}</p>
            <dl className="mt-3 flex flex-col gap-3">
              {note.see
                .filter((x) => x.text_original)
                .slice(0, 4)
                .map((x, i) => (
                  <div key={i}>
                    <dt className="font-serif text-title leading-tight" lang="ja">
                      {x.text_original}
                    </dt>
                    <dd className="text-small text-paper/75">
                      {x.reading && <span className="mr-2 font-serif text-muted italic">{x.reading}</span>}
                      {x.meaning?.[lang]}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
          {cutouts.length > 0 && (
            <div className="flex flex-wrap items-end gap-4">
              {cutouts.map((c) => (
                // eslint-disable-next-line @next/next/no-img-element -- cut-out PNG with alpha
                <img key={c.e} src={c.src} alt={c.e} className="h-20 w-auto object-contain" />
              ))}
            </div>
          )}
          {note.space && (
            <div>
              <ButtonLink href={note.space.url}>
                {t.space}
                {note.space.aligned ? ` ── ${t.aligned}` : ""}
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      {note.visual.length > 0 && (
        <Section label={<>{t.visual} <Pencil /></>} data-testid="note-visual">
          <ul className="flex gap-4 overflow-x-auto pb-2">
            {note.visual.map((h) => (
              <VisualHitCard key={h.id} h={h} width="w-28" />
            ))}
          </ul>
        </Section>
      )}

      <section className="grid gap-12 md:grid-cols-2">
        <div className="border-t border-rule pt-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="label">{t.story}</h2>
            <span className="text-caption text-muted">{t.pick}</span>
          </div>
          {narrative?.sentences.length ? (
            <ol className="flex flex-col font-serif text-body" data-testid="note-sentences">
              {narrative.sentences.map((x, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={selected === i}
                    className={`w-full border-l-2 py-2 pr-2 pl-4 text-left transition-colors ${selected === i ? "border-paper bg-paper/5" : "border-transparent text-paper/80 hover:text-paper"}`}
                  >
                    {x.text}
                    <span className="ml-2 inline-block font-sans text-caption whitespace-nowrap text-muted">{t[x.assertion_type as "direct" | "derived" | "interpretive"] ?? x.assertion_type}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">
              {t.noNarrative}{" "}
              <Button onClick={makeNarrative} disabled={busy}>
                {busy ? "…" : t.make}
              </Button>
            </p>
          )}
        </div>

        <aside aria-live="polite" data-testid="note-evidence" className="self-start border-t border-rule pt-3 md:sticky md:top-8">
          <h2 className="label mb-4">{t.evidence}</h2>
          <ul className="flex flex-col">
            {cites.map((c) => (
              <li key={c.claimId} className="border-b border-rule pb-4 not-first:pt-4">
                <p className="text-small text-muted">{c.sourceTitle}</p>
                {c.kind === "evidence" ? (
                  <>
                    <blockquote className="mt-2 border-l-2 border-koto pl-4 font-serif text-body" lang={c.lang}>
                      <span className="sr-only">{t.original}: </span>
                      {c.excerpt}
                    </blockquote>
                    {c.lang !== lang && (
                      <p className="mt-2 pl-4 text-small text-paper/80">
                        <span className="block text-caption text-muted">{t.ref}</span>
                        {refs[lang] ? (refs[lang]?.[c.sentenceIds.join("|")] ?? "—") : t.refLoading}
                      </p>
                    )}
                  </>
                ) : (
                  <p className={`mt-2 border-l-2 pl-4 ${LAYER.toki} ${STATE[c.state]?.cls ?? ""}`}>
                    <span className="block text-caption text-muted">{STATE[c.state]?.[lang] ?? c.state}</span>
                    {c.label[lang]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <Section label={t.threads}>
        <ul className="grid gap-x-10 gap-y-3 text-small md:grid-cols-2">
          {note.threads
            .filter((th) => th.state !== "ink" || th.layer !== "koto")
            .sort((a, b) => Number(b.state === "pending" || b.state === "pencil") - Number(a.state === "pending" || a.state === "pencil"))
            .slice(0, 14)
            .map((th) => (
              <li
                key={th.id}
                className={`border-l-2 pl-4 ${LAYER[th.layer] ?? ""} ${confirmed[th.id] ? STATE.user_confirmed.cls : (STATE[th.state]?.cls ?? "")}`}
                data-testid={`thread-${th.state}`}
              >
                <span className="block text-caption text-muted">
                  {confirmed[th.id] ? `${STATE.user_confirmed[lang]}（${STATE[th.state]?.[lang] ?? th.state}）` : (STATE[th.state]?.[lang] ?? th.state)}
                </span>
                {plain(th.label[lang], lang)}
                {(th.state === "pending" || th.state === "pencil") && (
                  <Button variant="quiet" onClick={() => toggleConfirm(th.id)} aria-pressed={Boolean(confirmed[th.id])} className="ml-1 text-caption" data-testid="confirm-thread">
                    {confirmed[th.id] ? t.unconfirm : t.confirm}
                  </Button>
                )}
              </li>
            ))}
        </ul>
      </Section>

      <Section label={t.tickets}>
        <ul className="grid gap-4 md:grid-cols-3" data-testid="note-tickets">
          {note.tickets.map((k) => (
            <li key={k.id} className="grid grid-cols-[1fr_auto] rounded-sm border border-rule-strong">
              <div className="min-w-0 p-4">
                <p className="font-serif text-lead leading-snug" lang={k.lang}>
                  {k.title}
                </p>
                <p className="mt-1 text-small">
                  {k.author ?? ""}
                  {k.first_published ? ` · ${k.first_published}${lang === "ja" ? " 刊" : " (pub.)"}` : ""}
                </p>
                <p className="mt-2 text-caption text-muted">{[k.provider, k.edition, k.license?.replace(/\s*\(isPublicDomain=true\)/, "")].filter(Boolean).join(" · ")}</p>
                {k.url && (
                  <a href={k.url} className="mt-2 block truncate text-caption text-muted underline decoration-rule-strong underline-offset-4 hover:text-paper" rel="noreferrer noopener" target="_blank">
                    {k.url}
                  </a>
                )}
              </div>
              <p className="flex w-14 flex-col items-center justify-center border-l border-dashed border-rule-strong text-caption text-muted">
                <span>{t.cited}</span>
                <span className="font-serif text-title text-paper tabular-nums">{k.cited}</span>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="flex flex-wrap justify-between gap-4 border-t border-rule pt-4 text-caption text-muted tabular-nums">
        <span>
          {t.stats(note.stats)}
        </span>
        <LoomLegend />
      </footer>
    </article>
  );
}
