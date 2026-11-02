"use client";

/**
 * Presentation mode (FR-46, 6.5 2:15–2:40): what Claude decided and what code verified, live.
 * Follows the latest exploration (presenter: across sessions, read-only). Large type for 1920×1080.
 */
import { useEffect, useRef, useState } from "react";

type Ev = { seq: number; type: string; data: unknown };
type Call = { stage: string; model: string; elapsedMs: number; usage: { input: number; output: number; cacheRead: number }; costUsd: number };
type Stage = { stage: string; status: string; ms?: number };
type Claim = { status: string; predicate: string; subject: string; value: string | null; failed_checks: string[]; source?: string };
type Gap = { assessment?: string; gaps?: { facet: string; lang: string; reason: string; terms: string[] }[]; found?: number; skipped?: string };

const STAGES = ["see", "place", "plan", "retrieve", "extract:en", "extract:ja", "gap", "extract2", "existence", "names", "narrate", "graph"];
const STAGE_JA: Record<string, string> = {
  see: "視る（Claude）",
  place: "場所の特定",
  plan: "検索プラン",
  retrieve: "検索",
  "extract:en": "証拠の抽出・英（Claude）",
  "extract:ja": "証拠の抽出・日（Claude）",
  extract2: "追加の抽出（Claude）",
  gap: "不足の評価（Claude、抽出と並行）",
  existence: "存在判定（コード）",
  names: "言の地層（コード）",
  narrate: "紡ぐ（Claude）",
  graph: "Evidence Graph 保存",
};
const CHECK_JA: Record<string, string> = {
  sentence_ids_exist: "引用文が実在しない",
  subject_known: "対象が辞書にない",
  object_known: "対象が辞書にない",
  name_in_sentence: "呼び名が本文にない",
  subject_named_in_sentence: "対象が文中に出ない",
  negation_handled: "否定文",
  time_consistent: "時期の矛盾",
};
const PROBLEM_JA = (p: string) =>
  p.startsWith("number_not_in_claims")
    ? `主張にない数字（${p.split(":")[1]}）`
    : p.startsWith("entity_not_in_claims")
      ? "主張にない固有名"
      : p === "overstated_absence"
        ? "不在の言い過ぎ"
        : p === "no_claims"
          ? "根拠なし"
          : p;

export function PresentLive() {
  const [expId, setExpId] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    const poll = async () => {
      try {
        const r = await fetch("/api/explorations/latest", { cache: "no-store" });
        if (!r.ok) return setError(r.status === 401 ? "発表者の鍵が必要です（/api/presenter?key=…）" : `取得失敗 ${r.status}`);
        const { exploration_id } = (await r.json()) as { exploration_id: string | null };
        if (!exploration_id || exploration_id === current.current) return;
        current.current = exploration_id;
        setExpId(exploration_id);
        setEvents([]);
        es?.close();
        es = new EventSource(`/api/explorations/${exploration_id}/events`);
        const on = (e: MessageEvent) => {
          const ev = { seq: Number(e.lastEventId), type: e.type, data: JSON.parse(e.data) };
          setEvents((p) => (p.some((x) => x.seq === ev.seq) ? p : [...p, ev]));
        };
        for (const t of ["stage", "see", "place", "candidates", "gap", "claims", "existence", "names", "threads", "narrative", "graph", "ai_call", "done", "failed"])
          es.addEventListener(t, on);
      } catch {
        setError("通信に失敗しました");
      }
    };
    void poll();
    const t = setInterval(poll, 3000);
    return () => {
      clearInterval(t);
      es?.close();
    };
  }, []);

  const of = <T,>(type: string) => events.filter((e) => e.type === type).map((e) => e.data as T);
  const stages = of<Stage>("stage");
  const calls = of<Call>("ai_call");
  const claims = of<{ claims: Claim[] }>("claims").flatMap((c) => c.claims);
  const gap = of<Gap>("gap")[0];
  const narrative = of<{ sentences?: unknown[]; dropped?: { text: string; problems: string[] }[] }>("narrative")[0];
  const graph = of<{ saved: boolean; ms?: number }>("graph")[0];
  const done = of<{ elapsed_ms?: number; cost_usd?: number; claude_calls?: number }>("done")[0];
  const place = of<{ chosen?: { path: { name: { ja: string } }[] } }>("place")[0];
  const cost = calls.reduce((s, c) => s + c.costUsd, 0);
  const tokens = calls.reduce((s, c) => s + c.usage.input + c.usage.output, 0);
  const downgraded = claims.filter((c) => c.status !== "accepted");

  const stageStatus = (s: string) => {
    const xs = stages.filter((x) => x.stage === s);
    const d = xs.find((x) => x.status === "done");
    return d ? { label: `${((d.ms ?? 0) / 1000).toFixed(1)}s`, cls: "text-toki" } : xs.length ? { label: "実行中…", cls: "text-lantern" } : { label: "—", cls: "text-muted/60" };
  };

  return (
    <div className="grid flex-1 grid-cols-1 gap-8 text-xl lg:grid-cols-3" data-testid="present-live">
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-3xl">処理の流れ</h2>
        {error && <p className="text-ba">{error}</p>}
        {expId && <p className="text-sm text-muted">{expId}</p>}
        {place?.chosen && <p className="text-2xl">{place.chosen.path.slice().reverse().map((p) => p.name.ja).join(" › ")}</p>}
        <ol className="flex flex-col gap-2">
          {STAGES.map((s) => {
            const st = stageStatus(s);
            return (
              <li key={s} className="flex justify-between gap-4 border-b border-muted/20 pb-1">
                <span>{STAGE_JA[s]}</span>
                <span className={`tabular-nums ${st.cls}`}>{st.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-2xl tabular-nums" data-testid="present-totals">
          {done?.elapsed_ms ? `${(done.elapsed_ms / 1000).toFixed(1)} 秒` : "…"} · Claude {calls.length} 回 · {tokens.toLocaleString()} tokens · ${cost.toFixed(3)}
        </p>
        {graph && <p className="text-base text-muted">Evidence Graph：{graph.saved ? `保存 ${graph.ms} ms（1トランザクション）` : "保存失敗"}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-3xl">Claudeの判断</h2>
        {gap?.assessment && (
          <div className="rounded-lg border border-koto/40 p-4" data-testid="present-gap">
            <p className="text-base text-muted">何が足りないか</p>
            <p>{gap.assessment}</p>
            <ul className="mt-2 text-base">
              {(gap.gaps ?? []).map((g, i) => (
                <li key={i}>
                  → {g.reason}
                  <span className="text-muted">（追加検索：{g.terms.join("、")}）</span>
                </li>
              ))}
            </ul>
            {gap.found !== undefined && <p className="mt-1 text-base text-muted">追加で {gap.found} 節</p>}
          </div>
        )}
        <h3 className="mt-2 text-2xl">呼び出しの記録</h3>
        <table className="w-full text-base tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="text-left font-normal">段階</th>
              <th className="text-right font-normal">入力</th>
              <th className="text-right font-normal">出力</th>
              <th className="text-right font-normal">秒</th>
              <th className="text-right font-normal">$</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c, i) => (
              <tr key={i}>
                <td>{c.stage}</td>
                <td className="text-right">{c.usage.input.toLocaleString()}</td>
                <td className="text-right">{c.usage.output.toLocaleString()}</td>
                <td className="text-right">{(c.elapsedMs / 1000).toFixed(1)}</td>
                <td className="text-right">{c.costUsd.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {calls[0] && <p className="text-sm text-muted">model: {calls[0].model}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-3xl">コードの検証</h2>
        <p>
          主張 {claims.length} 件 → 採用 {claims.length - downgraded.length} ・格下げ/却下 {downgraded.length}
        </p>
        <ul className="text-base">
          {downgraded.slice(0, 6).map((c, i) => (
            <li key={i}>
              <span className="text-ba">✕</span> {c.source ?? ""}：{c.predicate}
              {c.value ? `「${c.value}」` : ""} <span className="text-muted">（{c.failed_checks.map((k) => CHECK_JA[k] ?? k).join("・") || c.status}）</span>
            </li>
          ))}
        </ul>
        {narrative && (
          <>
            <p className="mt-2">
              物語 {narrative.sentences?.length ?? 0} 文を採用
              {narrative.dropped?.length ? ` ・ ${narrative.dropped.length} 文を除外` : ""}
            </p>
            <ul className="text-base">
              {(narrative.dropped ?? []).map((d, i) => (
                <li key={i}>
                  <span className="text-ba">✕</span> <span className="text-muted">{d.problems.map(PROBLEM_JA).join("・")}：</span>
                  {d.text.slice(0, 50)}…
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-auto text-base text-muted">
          目的はコードのDAGが固定し、Claudeは段階ごとの限られた判断だけを行う。出力はすべてコードが検査する（OWASP ASI01）。
        </p>
      </section>
    </div>
  );
}
