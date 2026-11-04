"use client";

/**
 * 「この探索の舞台裏」: what Claude did and what code decided in this run — each Claude call on a
 * timeline (parallel calls overlap), the checks code ran on Claude's output and what they rejected.
 */
import { By } from "../ui/by";
import { stripNumbers } from "@/lib/live/state";
import { AssociationThreads } from "./association-threads";
import { GraphDiagram } from "./graph-diagram";
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { StagePanel } from "./stage-panel";


const CALL: Record<string, { ja: string; en: string }> = {
  see: { ja: "視る（写真を読む）", en: "See (read the photo)" },
  closer: { ja: "寄って読む", en: "Read closer" },
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
  observation_on_record: { ja: "見たと記録にある", en: "the record says the writer saw it" },
};

const T = dict({
  ja: {
    totals: (n: ReturnType<typeof stripNumbers>) => `資料 ${n.sources} · 読んだ節 ${n.passages} · ${n.languages} 言語 · 採用 ${n.accepted} · 格下げ・却下 ${n.downgraded + n.rejected} · Claude ${n.claudeCalls} 回 · $${n.costUsd.toFixed(2)}`,
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
  },
  en: {
    totals: (n: ReturnType<typeof stripNumbers>) => `${n.sources} sources · ${n.passages} passages read · ${n.languages} languages · ${n.accepted} kept · ${n.downgraded + n.rejected} downgraded / rejected · ${n.claudeCalls} Claude calls · $${n.costUsd.toFixed(2)}`,
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
  },
});

/** negating words, underlined in the one-check example (ja and en; display only, the check itself is in code) */
const NEGATION = /(ではなく|ではない|なかった|ない|ず|\bnot\b|\bno\b|\bnever\b)/;

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
  const held = s.claims.filter((c) => c.status !== "accepted" && (c.failed_checks?.length ?? 0) > 0 && c.excerpt);
  const example = held.find((c) => c.failed_checks!.includes("negation_handled")) ?? held[0] ?? null;
  const judged = s.existence?.rows.length ?? 0;
  return (
    <StagePanel
      title={t.title}
      onClose={onClose}
      testid="backstage"
      wide
    >
          {/* one check, readable: a claim Claude proposed that code held back, and why (auditability) */}
          {example && (
            <figure className="mb-6 border-l-2 border-rule-strong pl-4" data-testid="one-check">
              <figcaption className="flex flex-wrap items-center gap-2">
                <By who="code" did={{ ja: example.status === "rejected" ? "却下" : "格下げ", en: example.status === "rejected" ? "rejected" : "downgraded" }} />
                <span className="text-small text-paper">
                  {example.failed_checks!.includes("negation_handled") ? (lang === "ja" ? "否定の文を、主張として採らなかった" : "a negation, not taken as a claim") : lang === "ja" ? "通らなかった検査：" : "check not passed: "}
                  {example.failed_checks!.includes("negation_handled") ? null : (CHECK[example.failed_checks![0]]?.[lang] ?? example.failed_checks![0])}
                </span>
              </figcaption>
              <blockquote className="mt-2 line-clamp-3 font-serif text-body text-paper/90" lang={example.lang}>
                {example.excerpt.split(NEGATION).map((part, k) =>
                  NEGATION.test(part) ? (
                    <span key={k} className="underline decoration-paper decoration-2 underline-offset-4">
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
              </blockquote>
            </figure>
          )}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <h3 className="text-caption font-bold text-lantern">
            {t.calls(calls.length)}
          </h3>
          <p className="mt-1 text-caption text-muted tabular-nums" data-testid="backstage-totals">
            {t.totals(stripNumbers(s))}
          </p>
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
      </div>
      {s.graph?.sketch && <GraphDiagram sketch={s.graph.sketch} />}
      <div className="mt-6">
        <AssociationThreads s={s} />
      </div>
    </StagePanel>
  );
}

