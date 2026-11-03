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

const EXIST_LABEL: Record<string, string> = { present: "あった", absent: "なかった", unknown: "確かめられない" };
const STATE_LABEL: Record<string, string> = {
  ink: "インク",
  combined: "組み合わせ",
  absent: "不在",
  conflict: "相違",
  pencil: "鉛筆",
  pending: "確認待ち",
  user_confirmed: "あなたの確認",
};

type Ev = { seq: number; type: string; data: unknown };

const STAGE_LABEL: Record<string, string> = { see: "視る", place: "場所", plan: "検索プラン", retrieve: "検索", extract: "証拠の抽出", "extract:en": "抽出（英）", "extract:ja": "抽出（日）", extract2: "追加の抽出", gap: "不足の評価（並行）", space: "間",  existence: "存在判定", narrate: "紡ぐ" };
const FACET_LABEL: Record<string, string> = {
  place_description: "場所の記述",
  naming: "呼び名",
  existence_timeline: "存在期間",
  historical_artifacts: "作品",
  contrast: "対比",
};
const REL_LABEL: Record<string, string> = { same: "対象そのもの", ancestor_place: "上位の場所", related: "関連", unknown: "不明" };

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
  const [status, setStatus] = useState<string>(replay ? "探索中…" : "送信の準備中…");
  const [expId, setExpId] = useState<string | null>(replay?.explorationId ?? attach ?? null);
  const [lang, setLang] = useState<"ja" | "en">("ja");
  const [alt, setAlt] = useState<Partial<Record<"ja" | "en", NarrativeEvent>>>({});
  const [langBusy, setLangBusy] = useState(false);
  const [locStatus, setLocStatus] = useState<string>(replay ? "記録の再生（位置情報は使いません）" : useLocation ? "位置情報：確認中" : "位置情報：使わない");
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
        if (e.type === "done") setStatus("完了");
        if (e.type === "failed") setStatus(`失敗：${(ev.data as { message: string }).message}`);
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
          setLocStatus("位置情報：送信します");
        } else setLocStatus(pos === "denied" ? "位置情報：許可されませんでした（写真だけで進めます）" : "位置情報：取得できませんでした（写真だけで進めます）");
      }
      setStatus("送信中…");
      const up = await fetch("/api/captures", { method: "POST", body: form });
      if (!up.ok) return setStatus(`送信できませんでした（${(await up.json().catch(() => ({}))).error ?? up.status}）`);
      const { capture_id } = await up.json();
      const ex = await fetch("/api/explorations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capture_id }),
      });
      if (!ex.ok) {
        const reason = (await ex.json().catch(() => ({}))).error ?? ex.status;
        const why: Record<string, string> = {
          killed: "現在、新しい探索を停止しています（管理者の操作）",
          hourly_limit: "1時間あたりの探索の上限に達しました。しばらくしてからお試しください",
          daily_cost: "本日の利用上限に達しました",
        };
        return setStatus(`探索を始められませんでした：${why[String(reason)] ?? reason}`);
      }
      const { events: url, exploration_id } = await ex.json();
      setExpId(exploration_id);
      setStatus("探索中…");
      listen(url);
    })().catch(() => setStatus("通信に失敗しました"));
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
      phase:
        status === "完了"
          ? notice && /特定できませんでした/.test(notice.message)
            ? "no_place"
            : "done"
          : status.startsWith("送信")
            ? "sending"
            : status === "探索中…"
              ? "exploring"
              : /失敗|できませんでした/.test(status)
                ? "failed"
                : "idle",
      absent: existence?.rows.filter((r) => r.value === "absent").length,
      withheld: existence?.rows.filter((r) => r.reason === "sources_disagree").length,
      conflicts: Array.isArray(conflictsEv) ? conflictsEv.length : 0,
      pending: threads?.filter((t) => t.state === "pending" || t.state === "pencil").length,
      visual: Boolean(visual?.hits.length),
      degraded: space ? !space.ok : false,
    },
    lang,
  );
  return (
    <section className="flex w-full flex-col gap-6" data-testid="exploration">
      {replay && (
        <p role="status" className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-lg bg-ba px-4 py-2 text-small font-bold text-paper" data-testid="replay-banner">
          記録の再生：live ではありません（{new Date(replay.recordedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} の探索）
        </p>
      )}
      <Guide line={guide} />
      <p className="font-bold" data-testid="exploration-status">
        {status}
      </p>
      <p className="text-small text-muted">{locStatus}</p>
      {stages.length > 0 && (
        <p className="text-small text-muted">
          {stages.map((s) => `${STAGE_LABEL[s.stage] ?? s.stage} ${(s.ms / 1000).toFixed(1)}s`).join(" → ")}
          {call ? ` · Claude ${call.usage.input + call.usage.output} tokens · $${call.costUsd.toFixed(3)}` : ""}
        </p>
      )}
      {see && (
        <div>
          <h3 className="font-serif text-lead">視る</h3>
          <ul className="text-small">
            {see.elements.slice(0, 4).map((el, i) => (
              <li key={i}>
                {el.text_original ? <span lang="ja">「{el.text_original}」</span> : null} {el.reading ? <span lang="ja-Latn">{el.reading}</span> : null} —{" "}
                {el.meaning.ja}
              </li>
            ))}
          </ul>
        </div>
      )}
      {place?.chosen && (
        <p data-testid="place">
          場所：{place.chosen.path.slice().reverse().map((p) => p.name.ja).join(" › ")}
        </p>
      )}
      {notice && <p role="status">{notice.message}</p>}
      {timelineData && <TimeRiver data={timelineData} />}
      {existence && existence.rows.length > 0 && (
        <div data-testid="existence">
          <h3 className="font-serif text-lead">時：その時、{timelineData?.name?.ja ?? "それ"}はあったか</h3>
          <ul className="text-small">
            {existence.rows.map((r) => (
              <li key={r.source}>
                <span className={r.value === "absent" ? "text-ba" : r.value === "present" ? "text-toki" : "text-muted"}>
                  {r.reason === "sources_disagree" ? "判定保留（史料間で日付が一致しない）" : EXIST_LABEL[r.value]}
                </span>{" "}
                {r.sourceTitle}（{r.time?.kind}: {r.time?.start}
                {r.time?.end ? `–${r.time.end}` : ""}）
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
        <div className="flex gap-2" role="group" aria-label="物語の言語">
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
          <h3 className="font-serif text-lead">紡ぐ</h3>
          <p className="font-serif leading-relaxed" lang={lang}>
            {narrative.sentences.map((s, i) => (
              <span key={i} title={s.claim_ids.join(", ")} className={s.assertion_type === "interpretive" ? "italic text-muted" : undefined}>
                {s.text}
                {lang === "en" && i < narrative.sentences!.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <p className="text-caption text-muted">
            各文は根拠の主張に紐づいています（文にカーソルを合わせると主張IDを表示）。
            {narrative.dropped?.length ? ` 根拠を確かめられなかった ${narrative.dropped.length} 文は除きました。` : ""}
          </p>
        </div>
      )}
      {gap && (
        <div data-testid="gap">
          <h3 className="font-serif text-lead">Claudeの判断：何が足りないか</h3>
          {gap.assessment && <p className="text-small">{gap.assessment}</p>}
          <ul className="text-small text-muted">
            {(gap.gaps ?? []).map((g, i) => (
              <li key={i}>
                {FACET_LABEL[g.facet] ?? g.facet}・{g.lang === "ja" ? "日本語" : "英語"}：{g.reason}（追加検索：{g.terms.join("、")}）
              </li>
            ))}
          </ul>
          {gap.found !== undefined && <p className="text-small text-muted">追加で {gap.found} 節が見つかりました。</p>}
        </div>
      )}
      {claims && (
        <p className="text-small text-muted" data-testid="claims">
          主張：採用 {claims.accepted} ・格下げ {claims.downgraded} ・却下 {claims.rejected}（{claims.passages} 節から）
        </p>
      )}
      {status === "完了" && expId && firstNarrative && (
        <a href={`/note/${expId}?lang=${lang}`} className={buttonClass("primary", "w-fit")} data-testid="note-link">
          {lang === "ja" ? "旅ノートを開く" : "Open the travel note"}
        </a>
      )}
      {visual && visual.hits.length > 0 && (
        <section data-testid="visual" aria-label="提灯から提灯へ">
          <h3 className="font-serif text-lead">提灯から提灯へ</h3>
          <p className="text-caption text-muted">切り抜いた大提灯に似た図像（画像の類似度） <Pencil /></p>
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
              間（ま）で見る{space.aligned ? "：広重の絵と位置合わせ済み" : ""}
            </a>
          ) : (
            <span className="text-muted">{space.message ?? "空間解析：簡易表示"}</span>
          )}
        </p>
      )}
      {threads && (
        <div data-testid="threads">
          <h3 className="font-serif text-lead">糸</h3>
          <ul className="text-small">
            {threads.map((t) => (
              <li key={t.id}>
                <span className="text-muted">[{STATE_LABEL[t.state] ?? t.state}]</span> {t.label.ja}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cands.map((c, i) => (
        <div key={i}>
          <h4 className="text-small font-bold">
            {FACET_LABEL[c.facet] ?? c.facet}・{c.lang === "ja" ? "日本語" : "英語"}：{c.found} 件
            {c.widened.length ? <span className="font-normal text-muted">（対象で足りず上位の場所まで広げました）</span> : null}
          </h4>
          {c.notFound ? (
            <p className="text-small text-muted">{c.lang === "ja" ? "日本語" : "英語"}の関連資料は見つかりませんでした。</p>
          ) : (
            <ul className="text-small">
              {c.candidates.slice(0, 3).map((x) => (
                <li key={x.passageId} className="mb-1">
                  <span className="text-muted">
                    [{REL_LABEL[x.relation]}] {x.sourceTitle} / {x.chapterLabel}：
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
