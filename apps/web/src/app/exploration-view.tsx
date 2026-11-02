"use client";

/**
 * Upload → start exploration → follow events over SSE (FR-01, FR-04, 4.11). Day-3 view: shows the
 * stages, what Claude read, the place, and candidates per facet/language including "not found".
 * All text from the server is rendered as text (no HTML) — ASI05.
 */
import { useEffect, useRef, useState } from "react";
import type { SeeOutput } from "@tsumugi/core";
import type { Retrieved } from "@/lib/dag/retrieve";
import type { ExistenceRow, Thread } from "@/lib/dag/threads";

type CandidatesEvent = { facet: string; lang: "en" | "ja"; widened: string[]; found: number; notFound: boolean; candidates: Retrieved[] };
type PlaceEvent = { chosen: { entity: string; path: { id: string; name: { ja: string; en: string } }[] } | null };
type StageEvent = { stage: string; status: string; ms: number };
type CallEvent = { usage: { input: number; output: number }; costUsd: number };
type ExistenceEvent = { rows: ExistenceRow[] };
type ClaimsEvent = { passages: number; accepted: number; downgraded: number; rejected: number };

const EXIST_LABEL: Record<string, string> = { present: "あった", absent: "なかった（恒久的な門）", unknown: "確かめられない" };
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

const STAGE_LABEL: Record<string, string> = { see: "視る", place: "場所", plan: "検索プラン", retrieve: "検索", extract: "証拠の抽出", existence: "存在判定" };
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

export function ExplorationView({ jpeg, useLocation }: { jpeg: Blob; useLocation: boolean }) {
  const [events, setEvents] = useState<Ev[]>([]);
  const [status, setStatus] = useState<string>("送信の準備中…");
  const [locStatus, setLocStatus] = useState<string>(useLocation ? "位置情報：確認中" : "位置情報：使わない");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let es: EventSource | null = null;
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
      if (!ex.ok) return setStatus(`探索を始められませんでした（${(await ex.json().catch(() => ({}))).error ?? ex.status}）`);
      const { events: url } = await ex.json();
      setStatus("探索中…");
      es = new EventSource(url);
      const on = (e: MessageEvent) => {
        const ev = { seq: Number(e.lastEventId), type: e.type, data: JSON.parse(e.data) };
        setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
        if (e.type === "done") setStatus("完了");
        if (e.type === "failed") setStatus(`失敗：${(ev.data as { message: string }).message}`);
        if (e.type === "done" || e.type === "failed") es?.close();
      };
      for (const t of ["received", "stage", "see", "place", "plan", "candidates", "claims", "existence", "conflicts", "threads", "ai_call", "notice", "done", "failed"]) es.addEventListener(t, on);
    })().catch(() => setStatus("通信に失敗しました"));
    return () => es?.close();
  }, [jpeg, useLocation]);

  const pick = <T,>(t: string) => events.find((e) => e.type === t)?.data as T | undefined;
  const see = pick<SeeOutput>("see");
  const place = pick<PlaceEvent>("place");
  const cands = events.filter((e) => e.type === "candidates").map((e) => e.data as CandidatesEvent);
  const stages = events.filter((e) => e.type === "stage").map((e) => e.data as StageEvent).filter((s) => s.status === "done");
  const call = pick<CallEvent>("ai_call");
  const notice = pick<{ message: string }>("notice");
  const existence = pick<ExistenceEvent>("existence");
  const claims = pick<ClaimsEvent>("claims");
  const threads = pick<Thread[]>("threads");

  return (
    <section className="flex w-full flex-col gap-4 rounded-lg border border-muted/30 p-4" data-testid="exploration">
      <p className="font-bold" data-testid="exploration-status">
        {status}
      </p>
      <p className="text-sm text-muted">{locStatus}</p>
      {stages.length > 0 && (
        <p className="text-sm text-muted">
          {stages.map((s) => `${STAGE_LABEL[s.stage] ?? s.stage} ${(s.ms / 1000).toFixed(1)}s`).join(" → ")}
          {call ? ` · Claude ${call.usage.input + call.usage.output} tokens · $${call.costUsd.toFixed(3)}` : ""}
        </p>
      )}
      {see && (
        <div>
          <h3 className="font-serif text-lg">視る</h3>
          <ul className="text-sm">
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
      {existence && (
        <div data-testid="existence">
          <h3 className="font-serif text-lg">時：その時、門はあったか</h3>
          <ul className="text-sm">
            {existence.rows.map((r) => (
              <li key={r.source}>
                <span className={r.value === "absent" ? "text-ba" : r.value === "present" ? "text-toki" : "text-muted"}>
                  {EXIST_LABEL[r.value]}
                </span>{" "}
                {r.sourceTitle}（{r.time?.kind}: {r.time?.start}
                {r.time?.end ? `–${r.time.end}` : ""}）
              </li>
            ))}
          </ul>
        </div>
      )}
      {claims && (
        <p className="text-sm text-muted" data-testid="claims">
          主張：採用 {claims.accepted} ・格下げ {claims.downgraded} ・却下 {claims.rejected}（{claims.passages} 節から）
        </p>
      )}
      {threads && (
        <div data-testid="threads">
          <h3 className="font-serif text-lg">糸</h3>
          <ul className="text-sm">
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
          <h4 className="text-sm font-bold">
            {FACET_LABEL[c.facet] ?? c.facet}・{c.lang === "ja" ? "日本語" : "英語"}：{c.found} 件
            {c.widened.length ? <span className="font-normal text-muted">（対象で足りず上位の場所まで広げました）</span> : null}
          </h4>
          {c.notFound ? (
            <p className="text-sm text-muted">{c.lang === "ja" ? "日本語" : "英語"}の関連資料は見つかりませんでした。</p>
          ) : (
            <ul className="text-sm">
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
