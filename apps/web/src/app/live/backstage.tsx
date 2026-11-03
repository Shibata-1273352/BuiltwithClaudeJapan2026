"use client";

/**
 * 「この探索の舞台裏」: what Claude did and what code decided in this run — each Claude call on a
 * timeline (parallel calls overlap), the checks code ran on Claude's output and what they rejected.
 */
import { GraphDiagram } from "./graph-diagram";
import { m } from "motion/react";
import { evalSummary } from "@/lib/eval-summary";
import type { LiveState } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { StagePanel } from "./stage-panel";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const CALL: Record<string, { ja: string; en: string }> = {
  see: { ja: "視る（写真を読む）", en: "See (read the photo)" },
  extract: { ja: "主張の抽出", en: "Extract claims" },
  gap: { ja: "不足の判断", en: "Judge gaps" },
  viewpoint: { ja: "視点の見立て（鉛筆）", en: "Viewpoint (pencil)" },
  "narrate:ja": { ja: "物語（日本語）", en: "Story (Japanese)" },
  "narrate:en": { ja: "物語（英語）", en: "Story (English)" },
  translate: { ja: "翻訳", en: "Translate" },
};

// the code checks of packages/core/src/claims.ts
const CHECK: Record<string, { ja: string; en: string }> = {
  sentence_ids_exist: { ja: "引用した文が実在する", en: "the cited sentence exists" },
  subject_known: { ja: "主語が辞書にある", en: "the subject is in the dictionary" },
  object_known: { ja: "目的語が辞書にある", en: "the object is in the dictionary" },
  subject_named_in_sentence: { ja: "主語が文中で名指しされている", en: "the subject is named in the sentence" },
  name_in_sentence: { ja: "呼び名が文中にある", en: "the name is in the sentence" },
  negation_handled: { ja: "否定文を肯定と読んでいない", en: "a negation was not read as a statement" },
  time_consistent: { ja: "時間が矛盾しない", en: "the times are consistent" },
};

const T = dict({
  ja: {
    title: "この探索の舞台裏",
    calls: (n: number) => `Claude の呼び出し（${n} 回・並列は重なって見えます）`,
    models: (models: string, cost: string) => `モデル：${models}（サーバー側フォールバック有効。応答したモデルを表示）・費用 $${cost}`,
    sep: "、",
    code: "コードが決めたこと・確かめたこと",
    claims: (n: number, a: number, d: number, r: number) => `Claude の主張 ${n} 件を原文と照合：採用 ${a}・格下げ ${d}・却下 ${r}`,
    failed: (list: string) => `（落ちた検査：${list}）`,
    existence: (n: number) => `「書かれた年に、それはあったか」を年表と照合：${n} 資料（Claude には判定させない）`,
    lines: "糸の線種（確か・切れた・保留・結び目）はコードが状態から決める",
    dropped: (n: number) => `物語の各文の引用を検査：削除 ${n} 文`,
    visual: "似た図像は画像の類似度（SigLIP）。根拠には使わない",
    viewpoint: "視点の見立ては鉛筆（解釈）。主張・糸・グラフにはしない",
    evalTitle: (run: string, n: number, cost: string) => `評価（${run}・Batch API ${n} 件 $${cost}）`,
    withTime: "存在の判定：資料の「時」で照合",
    misbind: (n: number) => `・誤結合 ${n}`,
    byPub: "　（比較）刊行年で照合した場合",
    exact: (n: number) => `引用が原文と一致（n=${n}）`,
    fabricated: "捏造した引用を拒否",
    generation: "根拠のない文：Claude が書き、検査が捕捉／表示",
    shown: (n: number) => `表示 ${n}`,
    live: (n: number) => `実行（n=${n}）`,
    liveValue: (s: string, cost: string, fail: string) => `中央値 ${s} 秒・$${cost}・失敗 ${fail}`,
    caveat: (by: string) =>
      `手作りの小さな評価セット（${by}）。幻覚がゼロであることの証明ではありません。指示を書いた紙の写真でも乗っ取られないことは SEC-01〜03（実際の Claude 呼び出し）で検査。`,
  },
  en: {
    title: "Backstage of this exploration",
    calls: (n: number) => `Claude calls (${n}; parallel calls overlap)`,
    models: (models: string, cost: string) => `Models: ${models} (server-side fallback on; the model that answered is shown) · cost $${cost}`,
    sep: ", ",
    code: "What code decided and checked",
    claims: (n: number, a: number, d: number, r: number) => `Checked Claude's ${n} claims against the original text: accepted ${a} · downgraded ${d} · rejected ${r}`,
    failed: (list: string) => ` (failed checks: ${list})`,
    existence: (n: number) => `"Did it exist in the year it was written about?" checked against the chronology: ${n} sources (never judged by Claude)`,
    lines: "The thread line styles (sure, cut, pending, knot) are decided by code from the state",
    dropped: (n: number) => `Checked the citations of every story sentence: ${n} removed`,
    visual: "Similar images are by image similarity (SigLIP) and never used as evidence",
    viewpoint: "The viewpoint is pencil (interpretation): never a claim, a thread or a graph node",
    evalTitle: (run: string, n: number, cost: string) => `Evaluation (${run} · Batch API, ${n} requests, $${cost})`,
    withTime: "Existence: checked by the source's own time",
    misbind: (n: number) => ` · ${n} misbound`,
    byPub: "　(for comparison) checked by publication year",
    exact: (n: number) => `Citations match the original (n=${n})`,
    fabricated: "Fabricated citations rejected",
    generation: "Unsupported sentences: written by Claude, caught by the checks / shown",
    shown: (n: number) => `shown ${n}`,
    live: (n: number) => `Runs (n=${n})`,
    liveValue: (s: string, cost: string, fail: string) => `median ${s} s · $${cost} · failed ${fail}`,
    caveat: (by: string) =>
      `A small hand-made evaluation set (${by}). It does not prove zero hallucination. That a photo of a note with written instructions cannot hijack it is tested by SEC-01–03 (real Claude calls).`,
  },
});

export function Backstage({
  s,
  onClose,
}: {
  s: LiveState;
  onClose: () => void;
}) {
  const t = useDict(T);
  const lang = useLang();
  const calls = s.calls.filter((c) => c.startedAt);
  const t0 = Math.min(...calls.map((c) => Date.parse(c.startedAt)));
  const t1 = Math.max(
    ...calls.map((c) => Date.parse(c.startedAt) + c.elapsedMs),
    t0 + 1,
  );
  const span = t1 - t0;
  const failed = new Map<string, number>();
  for (const c of s.claims)
    for (const k of c.failed_checks ?? [])
      failed.set(k, (failed.get(k) ?? 0) + 1);
  const dropped = s.narrative?.dropped?.length ?? 0;
  const judged = s.existence?.rows.length ?? 0;
  return (
    <StagePanel
      title={t.title}
      onClose={onClose}
      testid="backstage"
      wide
    >
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <h3 className="text-caption font-bold text-lantern">
            {t.calls(calls.length)}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {calls.map((c, i) => {
              const left = ((Date.parse(c.startedAt) - t0) / span) * 100;
              const width = Math.max(1.5, (c.elapsedMs / span) * 100);
              return (
                <li
                  key={c.seq}
                  className="grid grid-cols-[110px_1fr] items-center gap-2 text-caption"
                >
                  <span className="truncate text-muted">
                    {CALL[c.stage]?.[lang] ?? c.stage}
                  </span>
                  <span className="relative h-5 rounded-sm bg-muted/10">
                    <m.span
                      className="absolute inset-y-0 rounded-sm bg-lantern/70"
                      style={{ left: `${left}%` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                    />
                    <span
                      className="absolute inset-y-0 flex items-center pl-1 text-caption text-night tabular-nums"
                      style={{ left: `${left}%` }}
                    >
                      {(c.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-caption text-muted">
            {t.models(
              [...new Set(calls.map((c) => c.served))].join(t.sep),
              s.calls.reduce((a, c) => a + c.costUsd, 0).toFixed(3),
            )}
          </p>

          <h3 className="mt-4 text-caption font-bold text-koto">{t.code}</h3>
          <ul className="mt-1 list-disc pl-5 text-small leading-relaxed">
            <li>
              {t.claims(
                s.claims.length,
                s.claimTotals.accepted,
                s.claimTotals.downgraded,
                s.claimTotals.rejected,
              )}
              {failed.size > 0 && (
                <span className="text-muted">
                  {t.failed(
                    [...failed]
                      .map(([k, n]) => `${CHECK[k]?.[lang] ?? k} ${n}`)
                      .join(t.sep),
                  )}
                </span>
              )}
            </li>
            {judged > 0 && <li>{t.existence(judged)}</li>}
            <li>{t.lines}</li>
            {s.narrative && <li>{t.dropped(dropped)}</li>}
            {s.visual && <li>{t.visual}</li>}
            {s.viewpoint && <li>{t.viewpoint}</li>}
          </ul>
        </div>
        <EvalNumbers />
      </div>
      {s.graph?.sketch && <GraphDiagram sketch={s.graph.sketch} />}
    </StagePanel>
  );
}

/** 6.5 2:40 — the evaluation, from the stored result file (same numbers as the report). */
function EvalNumbers() {
  const t = useDict(T);
  const e = evalSummary();
  return (
    <section data-testid="eval-numbers">
      <h3 className="text-caption font-bold text-toki">
        {t.evalTitle(e.run, e.batch.requests, e.batch.cost_usd.toFixed(2))}
      </h3>
      <table className="mt-1 w-full text-small">
        <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums">
          <tr>
            <td>{t.withTime}</td>
            <td className="text-toki">
              {pct(e.existence.withTime)}{t.misbind(e.existence.misbindWith)}
            </td>
          </tr>
          <tr>
            <td className="text-muted">{t.byPub}</td>
            <td className="text-ba">
              {pct(e.existence.byPublication)}
              {t.misbind(e.existence.misbindPublication)}
            </td>
          </tr>
          <tr>
            <td>{t.exact(e.citation.n)}</td>
            <td>{pct(e.citation.exact)}</td>
          </tr>
          <tr>
            <td>{t.fabricated}</td>
            <td>
              {e.citation.rejected}/{e.citation.fabricated}
            </td>
          </tr>
          <tr>
            <td>{t.generation}</td>
            <td>
              {e.generation.caught}/{e.generation.sentences} ・{" "}
              {t.shown(e.generation.shown)}
            </td>
          </tr>
          <tr>
            <td>{t.live(e.live.n)}</td>
            <td>
              {t.liveValue(
                e.live.medianS.toFixed(1),
                e.live.cost.toFixed(2),
                pct(e.live.failure),
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-caption text-muted">{t.caveat(e.annotatedBy)}</p>
    </section>
  );
}
