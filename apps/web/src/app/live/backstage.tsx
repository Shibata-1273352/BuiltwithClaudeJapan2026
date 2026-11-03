"use client";

/**
 * 「この探索の舞台裏」: what Claude did and what code decided in this run — each Claude call on a
 * timeline (parallel calls overlap), the checks code ran on Claude's output and what they rejected.
 */
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";

const CALL_JA: Record<string, string> = {
  see: "視る（写真を読む）",
  extract: "主張の抽出",
  gap: "不足の判断",
  viewpoint: "視点の見立て（鉛筆）",
  "narrate:ja": "物語（日本語）",
  "narrate:en": "物語（英語）",
  translate: "翻訳",
};

// the code checks of packages/core/src/claims.ts
const CHECK_JA: Record<string, string> = {
  sentence_ids_exist: "引用した文が実在する",
  subject_known: "主語が辞書にある",
  object_known: "目的語が辞書にある",
  subject_named_in_sentence: "主語が文中で名指しされている",
  name_in_sentence: "呼び名が文中にある",
  negation_handled: "否定文を肯定と読んでいない",
  time_consistent: "時間が矛盾しない",
};

export function Backstage({ s, onClose }: { s: LiveState; onClose: () => void }) {
  const calls = s.calls.filter((c) => c.startedAt);
  const t0 = Math.min(...calls.map((c) => Date.parse(c.startedAt)));
  const t1 = Math.max(...calls.map((c) => Date.parse(c.startedAt) + c.elapsedMs), t0 + 1);
  const span = t1 - t0;
  const failed = new Map<string, number>();
  for (const c of s.claims) for (const k of c.failed_checks ?? []) failed.set(k, (failed.get(k) ?? 0) + 1);
  const dropped = s.narrative?.dropped?.length ?? 0;
  const judged = s.existence?.rows.length ?? 0;
  return (
    <m.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-xl border-t border-lantern/40 bg-night-2/97 p-5 shadow-2xl backdrop-blur lg:left-auto lg:w-[560px]"
      aria-label="この探索の舞台裏"
      data-testid="backstage"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg">この探索の舞台裏</h2>
        <button type="button" onClick={onClose} className="min-h-9 rounded-full px-3 text-sm text-muted hover:text-paper">
          閉じる
        </button>
      </div>

      <h3 className="mt-3 text-xs font-bold text-lantern">Claude の呼び出し（{calls.length} 回・並列は重なって見えます）</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {calls.map((c, i) => {
          const left = ((Date.parse(c.startedAt) - t0) / span) * 100;
          const width = Math.max(1.5, (c.elapsedMs / span) * 100);
          return (
            <li key={c.seq} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
              <span className="truncate text-muted">{CALL_JA[c.stage] ?? c.stage}</span>
              <span className="relative h-5 rounded bg-muted/10">
                <m.span
                  className="absolute inset-y-0 rounded bg-lantern/70"
                  style={{ left: `${left}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                />
                <span className="absolute inset-y-0 flex items-center pl-1 text-[10px] text-night tabular-nums" style={{ left: `${left}%` }}>
                  {(c.elapsedMs / 1000).toFixed(1)}s
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-muted">
        モデル：{[...new Set(calls.map((c) => c.served))].join("、")}（サーバー側フォールバック有効。応答したモデルを表示）・費用 $
        {s.calls.reduce((a, c) => a + c.costUsd, 0).toFixed(3)}
      </p>

      <h3 className="mt-4 text-xs font-bold text-koto">コードが決めたこと・確かめたこと</h3>
      <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
        <li>
          Claude の主張 {s.claims.length} 件を原文と照合：採用 {s.claimTotals.accepted}・格下げ {s.claimTotals.downgraded}・却下 {s.claimTotals.rejected}
          {failed.size > 0 && (
            <span className="text-muted">
              （落ちた検査：{[...failed].map(([k, n]) => `${CHECK_JA[k] ?? k} ${n}`).join("、")}）
            </span>
          )}
        </li>
        {judged > 0 && <li>「書かれた年に、それはあったか」を年表と照合：{judged} 資料（Claude には判定させない）</li>}
        <li>糸の線種（確か・切れた・保留・結び目）はコードが状態から決める</li>
        {s.narrative && <li>物語の各文の引用を検査：削除 {dropped} 文</li>}
        {s.visual && <li>似た図像は画像の類似度（SigLIP）。根拠には使わない</li>}
        {s.viewpoint && <li>視点の見立ては鉛筆（解釈）。主張・糸・グラフにはしない</li>}
      </ul>
    </m.aside>
  );
}
