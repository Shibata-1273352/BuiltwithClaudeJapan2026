"use client";
import { buttonClass } from "./ui/button";
import { Pencil } from "./ui/marks";
import { LoomLegend } from "./ui/legend";
import { EVENT_TYPES } from "@/lib/dag/event-types";

/**
 * Upload → start exploration → follow events over SSE (FR-01, FR-04, 4.11). Day-3 view: shows the
 * stages, what Claude read, the place, and candidates per facet/language including "not found".
 * All text from the server is rendered as text (no HTML) — ASI05.
 */
import { useEffect, useRef, useState } from "react";
import type { SeeOutput } from "@tsumugi/core";
import type { Retrieved } from "@/lib/dag/retrieve";
import type { ExistenceRow, Thread } from "@/lib/dag/threads";
import type { TimelineData } from "@/lib/time-river";
import { guideLine } from "@/lib/guide";
import { Guide } from "./guide";
import { dict, useDict, useLang } from "./i18n";
import { NamesLayer } from "./names-layer";
import { VisualHitCard, type VisualHit } from "./visual-hit";
import { TimeRiver } from "./time-river";

type CandidatesEvent = { facet: string; lang: "en" | "ja"; widened: string[]; found: number; notFound: boolean; candidates: Retrieved[] };
type PlaceEvent = { chosen: { entity: string; path: { id: string; name: { ja: string; en: string } }[] } | null };
type StageEvent = { stage: string; status: string; ms: number };
type CallEvent = { usage: { input: number; output: number }; costUsd: number };
type ExistenceEvent = { rows: ExistenceRow[] };
type NamesEvent = Record<
  string,
  {
    name?: { ja: string; en: string };
    type?: string;
    usages: { text: string; lang: "en" | "ja"; specificity: string; sourceTitle: string; time: string | null; sentence: string; sentenceId: string }[];
  }
>;
type NarrativeEvent = {
  sentences?: { text: string; claim_ids: string[]; assertion_type: string }[];
  dropped?: { text: string; problems: string[] }[];
};
type GapEvent = { assessment?: string; gaps?: { facet: string; lang: string; reason: string; terms: string[] }[]; found?: number };
type ClaimsEvent = { passages: number; accepted: number; downgraded: number; rejected: number };

type L2 = { ja: string; en: string };
const EXIST_LABEL: Record<string, L2> = {
  present: { ja: "あった", en: "it was there" },
  absent: { ja: "なかった", en: "it was not there" },
  unknown: { ja: "確かめられない", en: "cannot be checked" },
};
const STATE_LABEL: Record<string, L2> = {
  ink: { ja: "インク", en: "ink" },
  combined: { ja: "組み合わせ", en: "combined" },
  absent: { ja: "不在", en: "absent" },
  conflict: { ja: "相違", en: "conflict" },
  pencil: { ja: "鉛筆", en: "pencil" },
  pending: { ja: "確認待ち", en: "pending" },
  user_confirmed: { ja: "あなたの確認", en: "confirmed by you" },
};

type Ev = { seq: number; type: string; data: unknown };

const STAGE_LABEL: Record<string, L2> = {
  see: { ja: "視る", en: "See" },
  place: { ja: "場所", en: "Place" },
  plan: { ja: "検索プラン", en: "Search plan" },
  retrieve: { ja: "検索", en: "Search" },
  extract: { ja: "証拠の抽出", en: "Extract evidence" },
  "extract:en": { ja: "抽出（英）", en: "Extract (EN)" },
  "extract:ja": { ja: "抽出（日）", en: "Extract (JA)" },
  extract2: { ja: "追加の抽出", en: "Extra extraction" },
  gap: { ja: "不足の評価（並行）", en: "Gap check (parallel)" },
  space: { ja: "間", en: "間 (space)" },
  existence: { ja: "存在判定", en: "Existence" },
  narrate: { ja: "紡ぐ", en: "Weave" },
};
const FACET_LABEL: Record<string, L2> = {
  place_description: { ja: "場所の記述", en: "The place" },
  naming: { ja: "呼び名", en: "Names" },
  existence_timeline: { ja: "存在期間", en: "When it stood" },
  historical_artifacts: { ja: "作品", en: "Works" },
  contrast: { ja: "対比", en: "Contrast" },
};
const REL_LABEL: Record<string, L2> = {
  same: { ja: "対象そのもの", en: "the site itself" },
  ancestor_place: { ja: "上位の場所", en: "wider area" },
  related: { ja: "関連", en: "related" },
  unknown: { ja: "不明", en: "unknown" },
};

/** What the status line says; kept as a key so the text follows the language (FR-40). */
type Status =
  | { k: "preparing" | "sending" | "exploring" | "done" | "network" }
  | { k: "failed" | "upload" | "refused"; detail: string };
type Loc = "replay" | "checking" | "off" | "sending" | "denied" | "unavailable";

const T = dict({
  ja: {
    status: {
      preparing: "送信の準備中…",
      sending: "送信中…",
      exploring: "探索中…",
      done: "完了",
      network: "通信に失敗しました",
      failed: (m: string) => `失敗：${m}`,
      upload: (m: string) => `送信できませんでした（${m}）`,
      refused: (m: string) => `探索を始められませんでした：${m}`,
    },
    refusal: {
      killed: "現在、新しい探索を停止しています（管理者の操作）",
      hourly_limit: "1時間あたりの探索の上限に達しました。しばらくしてからお試しください",
      daily_cost: "本日の利用上限に達しました",
    } as Record<string, string>,
    loc: {
      replay: "記録の再生（位置情報は使いません）",
      checking: "位置情報：確認中",
      off: "位置情報：使わない",
      sending: "位置情報：送信します",
      denied: "位置情報：許可されませんでした（写真だけで進めます）",
      unavailable: "位置情報：取得できませんでした（写真だけで進めます）",
    } as Record<Loc, string>,
    dateLocale: "ja-JP",
    replayBanner: (d: string) => `記録の再生：live ではありません（${d} の探索）`,
    see: "視る",
    place: "場所：",
    existence: (name?: string) => `時：その時、${name ?? "それ"}はあったか`,
    withheld: "判定保留（史料間で日付が一致しない）",
    narrativeLang: "物語の言語",
    weave: "紡ぐ",
    cited: "各文は根拠の主張に紐づいています（文にカーソルを合わせると主張IDを表示）。",
    droppedN: (n: number) => ` 根拠を確かめられなかった ${n} 文は除きました。`,
    gap: "Claudeの判断：何が足りないか",
    langName: (l: string): string => (l === "ja" ? "日本語" : "英語"),
    gapRow: (facet: string, l: string, reason: string, terms: string) => `${facet}・${l}：${reason}（追加検索：${terms}）`,
    termSep: "、",
    gapFound: (n: number) => `追加で ${n} 節が見つかりました。`,
    claims: (a: number, d: number, r: number, n: number) => `主張：採用 ${a} ・格下げ ${d} ・却下 ${r}（${n} 節から）`,
    lantern: "提灯から提灯へ",
    lanternNote: "切り抜いた大提灯に似た図像（画像の類似度）",
    space: "間（ま）で見る",
    aligned: "：広重の絵と位置合わせ済み",
    simple: "空間解析：簡易表示",
    threads: "糸",
    candHead: (facet: string, l: string, n: number) => `${facet}・${l}：${n} 件`,
    widened: "（対象で足りず上位の場所まで広げました）",
    notFound: (l: string) => `${l}の関連資料は見つかりませんでした。`,
    paren: (x: string) => `（${x}）`,
    colon: "：",
  },
  en: {
    status: {
      preparing: "Getting ready to send…",
      sending: "Sending…",
      exploring: "Exploring…",
      done: "Done",
      network: "Network error",
      failed: (m: string) => `Failed: ${m}`,
      upload: (m: string) => `Could not send the photo (${m})`,
      refused: (m: string) => `Could not start the exploration: ${m}`,
    },
    refusal: {
      killed: "New explorations are paused right now (by the operator)",
      hourly_limit: "The hourly limit of explorations has been reached. Please try again a little later",
      daily_cost: "Today's usage limit has been reached",
    } as Record<string, string>,
    loc: {
      replay: "Replaying a recording (location is not used)",
      checking: "Location: checking",
      off: "Location: not used",
      sending: "Location: will be sent",
      denied: "Location: not allowed (going on with the photo only)",
      unavailable: "Location: unavailable (going on with the photo only)",
    } as Record<Loc, string>,
    dateLocale: "en-GB",
    replayBanner: (d: string) => `Replay of a recording — not live (exploration of ${d})`,
    see: "See",
    place: "Place: ",
    existence: (name?: string) => `時 Time: was ${name ?? "it"} there at the time?`,
    withheld: "withheld (the sources disagree on the dates)",
    narrativeLang: "Story language",
    weave: "Weave",
    cited: "Each sentence is tied to the claims that support it (hover a sentence to see the claim ids).",
    droppedN: (n: number) => ` ${n} sentence${n === 1 ? "" : "s"} whose evidence could not be checked ${n === 1 ? "was" : "were"} left out.`,
    gap: "Claude's judgement: what is missing",
    langName: (l: string) => (l === "ja" ? "Japanese" : "English"),
    gapRow: (facet: string, l: string, reason: string, terms: string) => `${facet} · ${l}: ${reason} (searched again for: ${terms})`,
    termSep: ", ",
    gapFound: (n: number) => `${n} more passage${n === 1 ? "" : "s"} found.`,
    claims: (a: number, d: number, r: number, n: number) => `Claims: accepted ${a} · downgraded ${d} · rejected ${r} (from ${n} passages)`,
    lantern: "Lantern to lantern",
    lanternNote: "Images similar to the cut-out great lantern (image similarity)",
    space: "View in 間 (ma)",
    aligned: " — aligned to the Hiroshige print",
    simple: "Spatial analysis: simple view",
    threads: "Threads",
    candHead: (facet: string, l: string, n: number) => `${facet} · ${l}: ${n}`,
    widened: " (too few for the site itself, so the wider area was searched too)",
    notFound: (l: string) => `No related ${l} sources were found.`,
    paren: (x: string) => ` (${x})`,
    colon: ":",
  },
});

/** The guide's phase, from the status (FR-45). */
function phaseOf(st: Status, noPlace: boolean) {
  if (st.k === "done") return noPlace ? "no_place" : "done";
  if (st.k === "preparing" || st.k === "sending" || st.k === "upload") return "sending";
  if (st.k === "exploring") return "exploring";
  return "failed";
}

function getPosition(): Promise<{ lat: number; lon: number } | "denied" | "unavailable"> {
  if (!("geolocation" in navigator)) return Promise.resolve("unavailable");
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => resolve(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

/**
 * `replay`: FR-47 — show a stored exploration again with its original pacing instead of starting a
 * new one (only when live fails). A banner says "recording" for the whole time.
 */
export function ExplorationView({ jpeg, useLocation = false, replay, attach }: { jpeg?: Blob; useLocation?: boolean; replay?: { explorationId: string; recordedAt: string }; attach?: string }) {
  const [events, setEvents] = useState<Ev[]>([]);
  const t = useDict(T);
  const ui = useLang();
  const [st, setStatus] = useState<Status>({ k: replay ? "exploring" : "preparing" });
  const [expId, setExpId] = useState<string | null>(replay?.explorationId ?? attach ?? null);
  const [lang, setLang] = useState<"ja" | "en">(ui); // the story's language; starts as the page language
  const [alt, setAlt] = useState<Partial<Record<"ja" | "en", NarrativeEvent>>>({});
  const [langBusy, setLangBusy] = useState(false);
  const [loc, setLocStatus] = useState<Loc>(replay ? "replay" : useLocation ? "checking" : "off");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let es: EventSource | null = null;
    const listen = (url: string) => {
      es = new EventSource(url);
      const on = (e: MessageEvent) => {
        const ev = { seq: Number(e.lastEventId), type: e.type, data: JSON.parse(e.data) };
        setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
        if (e.type === "done") setStatus({ k: "done" });
        if (e.type === "failed") setStatus({ k: "failed", detail: (ev.data as { message: string }).message });
        if (e.type === "done" || e.type === "failed") es?.close();
      };
      for (const t of EVENT_TYPES) es.addEventListener(t, on);
    };
    if (replay) {
      listen(`/api/explorations/${replay.explorationId}/events?pace=replay`);
      return () => es?.close();
    }
    // the live stage's "リスト表示": the same running exploration, as a list (6.4)
    if (attach) {
      listen(`/api/explorations/${attach}/events`);
      return () => es?.close();
    }
    if (!jpeg) return;
    (async () => {
      const form = new FormData();
      form.append("image", jpeg, "capture.jpg");
      form.append("lang", document.documentElement.lang === "en" ? "en" : "ja");
      if (useLocation) {
        const pos = await getPosition();
        if (typeof pos === "object") {
          form.append("lat", String(pos.lat));
          form.append("lon", String(pos.lon));
          setLocStatus("sending");
        } else setLocStatus(pos);
      }
      setStatus({ k: "sending" });
      const up = await fetch("/api/captures", { method: "POST", body: form });
      if (!up.ok) return setStatus({ k: "upload", detail: String((await up.json().catch(() => ({}))).error ?? up.status) });
      const { capture_id } = await up.json();
      const ex = await fetch("/api/explorations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capture_id }),
      });
      if (!ex.ok) {
        const reason = (await ex.json().catch(() => ({}))).error ?? ex.status;
        return setStatus({ k: "refused", detail: String(reason) });
      }
      const { events: url, exploration_id } = await ex.json();
      setExpId(exploration_id);
      setStatus({ k: "exploring" });
      listen(url);
    })().catch(() => setStatus({ k: "network" }));
    return () => es?.close();
  }, [jpeg, useLocation, replay, attach]);

  const pick = <T,>(t: string) => events.find((e) => e.type === t)?.data as T | undefined;
  const see = pick<SeeOutput>("see");
  const place = pick<PlaceEvent>("place");
  const cands = events.filter((e) => e.type === "candidates").map((e) => e.data as CandidatesEvent);
  const stages = events.filter((e) => e.type === "stage").map((e) => e.data as StageEvent).filter((s) => s.status === "done");
  const call = pick<CallEvent>("ai_call");
  const notice = pick<{ message: string }>("notice");
  const existence = pick<ExistenceEvent>("existence");
  const gap = pick<GapEvent>("gap");
  const firstNarrative = pick<NarrativeEvent & { lang?: "ja" | "en" }>("narrative");
  const narrative = alt[lang] ?? (firstNarrative?.lang === lang || !firstNarrative?.lang ? firstNarrative : undefined);
  const names = pick<NamesEvent>("names");
  const timelineData = pick<TimelineData>("timeline");
  const space = pick<{ ok: boolean; url?: string; aligned?: boolean; message?: string }>("space");
  const visual = pick<{ element: string; hits: VisualHit[] }>("visual");

  async function switchLang(next: "ja" | "en") {
    setLang(next);
    if (!expId || alt[next] || firstNarrative?.lang === next) return;
    setLangBusy(true);
    try {
      const r = await fetch(`/api/explorations/${expId}/narrative?lang=${next}`);
      if (r.ok) {
        const j = (await r.json()) as NarrativeEvent;
        setAlt((m) => ({ ...m, [next]: j }));
      }
    } finally {
      setLangBusy(false);
    }
  }
  const claimEvents = events.filter((e) => e.type === "claims").map((e) => e.data as ClaimsEvent);
  const claims = claimEvents.length
    ? claimEvents.reduce((a, b) => ({ passages: a.passages + b.passages, accepted: a.accepted + b.accepted, downgraded: a.downgraded + b.downgraded, rejected: a.rejected + b.rejected }))
    : undefined;
  const threads = pick<Thread[]>("threads");

  // FR-45: the guide's line is chosen by code from what the screen shows (never written by Claude)
  const conflictsEv = pick<unknown[]>("conflicts");
  const guide = guideLine(
    {
      phase: phaseOf(st, Boolean(notice && /特定できませんでした/.test(notice.message))),
      absent: existence?.rows.filter((r) => r.value === "absent").length,
      withheld: existence?.rows.filter((r) => r.reason === "sources_disagree").length,
      conflicts: Array.isArray(conflictsEv) ? conflictsEv.length : 0,
      pending: threads?.filter((t) => t.state === "pending" || t.state === "pencil").length,
      visual: Boolean(visual?.hits.length),
      degraded: space ? !space.ok : false,
    },
    lang,
  );
  const status =
    st.k === "failed" || st.k === "upload"
      ? t.status[st.k](st.detail)
      : st.k === "refused"
        ? t.status.refused(t.refusal[st.detail] ?? st.detail)
        : t.status[st.k];
  const langName = t.langName;
  return (
    <section className="flex w-full flex-col gap-6" data-testid="exploration">
      {replay && (
        <p role="status" className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-lg bg-ba px-4 py-2 text-small font-bold text-paper" data-testid="replay-banner">
          {t.replayBanner(new Date(replay.recordedAt).toLocaleString(t.dateLocale, { timeZone: "Asia/Tokyo" }))}
        </p>
      )}
      <Guide line={guide} />
      <p className="font-bold" data-testid="exploration-status">
        {status}
      </p>
      <p className="text-small text-muted">{t.loc[loc]}</p>
      {stages.length > 0 && (
        <p className="text-small text-muted">
          {stages.map((s) => `${STAGE_LABEL[s.stage]?.[ui] ?? s.stage} ${(s.ms / 1000).toFixed(1)}s`).join(" → ")}
          {call ? ` · Claude ${call.usage.input + call.usage.output} tokens · $${call.costUsd.toFixed(3)}` : ""}
        </p>
      )}
      {see && (
        <div>
          <h3 className="font-serif text-lead">{t.see}</h3>
          <ul className="text-small">
            {see.elements.slice(0, 4).map((el, i) => (
              <li key={i}>
                {el.text_original ? <span lang="ja">「{el.text_original}」</span> : null} {el.reading ? <span lang="ja-Latn">{el.reading}</span> : null} —{" "}
                {el.meaning[ui]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {place?.chosen && (
        <p data-testid="place">
          {t.place}
          {place.chosen.path
            .slice()
            .reverse()
            .map((p) => p.name[ui])
            .join(" › ")}
        </p>
      )}
      {notice && <p role="status">{notice.message}</p>}
      {timelineData && <TimeRiver data={timelineData} />}
      {existence && existence.rows.length > 0 && (
        <div data-testid="existence">
          <h3 className="font-serif text-lead">{t.existence(timelineData?.name?.[ui])}</h3>
          <ul className="text-small">
            {existence.rows.map((r) => (
              <li key={r.source}>
                <span className={r.value === "absent" ? "text-ba" : r.value === "present" ? "text-toki" : "text-muted"}>
                  {r.reason === "sources_disagree" ? t.withheld : EXIST_LABEL[r.value]?.[ui]}
                </span>{" "}
                {r.sourceTitle}
                {t.paren(`${r.time?.kind ?? ""}: ${r.time?.start ?? ""}${r.time?.end ? `–${r.time.end}` : ""}`)}
                {/* the reason in the site's own terms (not yet rebuilt / not yet moved here …) */}
                {threads?.find((t) => t.id === `th:exist:${r.source}`) && (
                  <span className="block pl-4 text-caption text-muted">{threads.find((t) => t.id === `th:exist:${r.source}`)!.label[lang]}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {firstNarrative && (
        <div className="flex gap-2" role="group" aria-label={t.narrativeLang}>
          {(["ja", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              data-testid={`lang-${l}`}
              aria-pressed={lang === l}
              onClick={() => switchLang(l)}
              className={`min-h-11 border-b-2 px-2 text-small ${lang === l ? "border-paper text-paper" : "border-transparent text-muted"}`}
            >
              {l === "ja" ? "日本語" : "English"}
            </button>
          ))}
          {langBusy && <span className="self-center text-small text-muted">…</span>}
        </div>
      )}
      {names && <NamesLayer names={names} lang={lang} />}
      {narrative?.sentences && (
        <div data-testid="narrative">
          <h3 className="font-serif text-lead">{t.weave}</h3>
          <p className="font-serif leading-relaxed" lang={lang}>
            {narrative.sentences.map((s, i) => (
              <span key={i} title={s.claim_ids.join(", ")} className={s.assertion_type === "interpretive" ? "italic text-muted" : undefined}>
                {s.text}
                {lang === "en" && i < narrative.sentences!.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <p className="text-caption text-muted">
            {t.cited}
            {narrative.dropped?.length ? t.droppedN(narrative.dropped.length) : ""}
          </p>
        </div>
      )}
      {gap && (
        <div data-testid="gap">
          <h3 className="font-serif text-lead">{t.gap}</h3>
          {gap.assessment && <p className="text-small">{gap.assessment}</p>}
          <ul className="text-small text-muted">
            {(gap.gaps ?? []).map((g, i) => (
              <li key={i}>
                {t.gapRow(FACET_LABEL[g.facet]?.[ui] ?? g.facet, langName(g.lang), g.reason, g.terms.join(t.termSep))}
              </li>
            ))}
          </ul>
          {gap.found !== undefined && <p className="text-small text-muted">{t.gapFound(gap.found)}</p>}
        </div>
      )}
      {claims && (
        <p className="text-small text-muted" data-testid="claims">
          {t.claims(claims.accepted, claims.downgraded, claims.rejected, claims.passages)}
        </p>
      )}
      {st.k === "done" && expId && firstNarrative && (
        <a href={`/note/${expId}?lang=${lang}`} className={buttonClass("primary", "w-fit")} data-testid="note-link">
          {lang === "ja" ? "旅ノートを開く" : "Open the travel note"}
        </a>
      )}
      {visual && visual.hits.length > 0 && (
        <section data-testid="visual" aria-label={t.lantern}>
          <h3 className="font-serif text-lead">{t.lantern}</h3>
          <p className="text-caption text-muted">
            {t.lanternNote} <Pencil />
          </p>
          <LoomLegend />
          <ul className="mt-2 flex gap-3 overflow-x-auto pb-2">
            {visual.hits.map((h) => (
              <VisualHitCard key={h.id} h={h} />
            ))}
          </ul>
        </section>
      )}
      {space && (
        <p className="text-small" data-testid="space-link">
          {space.ok && space.url ? (
            <a className="underline decoration-lantern underline-offset-4" href={space.url}>
              {t.space}
              {space.aligned ? t.aligned : ""}
            </a>
          ) : (
            <span className="text-muted">{space.message ?? t.simple}</span>
          )}
        </p>
      )}
      {threads && (
        <div data-testid="threads">
          <h3 className="font-serif text-lead">{t.threads}</h3>
          <ul className="text-small">
            {threads.map((th) => (
              <li key={th.id}>
                <span className="text-muted">[{STATE_LABEL[th.state]?.[ui] ?? th.state}]</span> {th.label[ui]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cands.map((c, i) => (
        <div key={i}>
          <h4 className="text-small font-bold">
            {t.candHead(FACET_LABEL[c.facet]?.[ui] ?? c.facet, langName(c.lang), c.found)}
            {c.widened.length ? <span className="font-normal text-muted">{t.widened}</span> : null}
          </h4>
          {c.notFound ? (
            <p className="text-small text-muted">{t.notFound(langName(c.lang))}</p>
          ) : (
            <ul className="text-small">
              {c.candidates.slice(0, 3).map((x) => (
                <li key={x.passageId} className="mb-1">
                  <span className="text-muted">
                    [{REL_LABEL[x.relation]?.[ui]}] {x.sourceTitle} / {x.chapterLabel}
                    {t.colon}
                  </span>{" "}
                  <span lang={x.lang}>{x.text.slice(0, 120)}…</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
