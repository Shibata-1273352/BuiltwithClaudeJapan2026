"use client";

/**
 * /how — how TSUMUGI uses Claude, and what code decides (FR-40 ja/en). The measured times and costs
 * come from the stored calls (how-facts.ts); the evaluation figures from the latest report.
 */
import Link from "next/link";
import { BackLink } from "../ui/back-link";
import type { StageFact } from "@/lib/how-facts";
import type { LandingFacts } from "@/lib/landing-facts";
import { dict, LangToggle, useDict } from "../i18n";

type Row = { stage: string; claude: string; code: string };

const T = dict({
  ja: {
    back: "TSUMUGI",
    title: "しくみ",
    lead: "Claude が読み、解説し、探し、書く。旅行者が頼る「はい／いいえ」は、コードが確かめる。",
    why: "Claude でなければできないこと：縦書きの筆文字を原文のまま読む。明治の英文と日本語の資料から、主張とその原文を抜き出す。何が足りないかを自分で判断し、探す語を出す。一文ずつ資料を引用しながら、物語と答えを書く。",
    splitTitle: "Claude がすること、コードが決めること",
    colStage: "段階",
    colClaude: "Claude",
    colCode: "コード",
    rows: [
      { stage: "視る", claude: "写真の文字を原文のまま読み、読み・意味・場所の候補を出す（画像の理解、構造化出力、途中経過のストリーミング）", code: "枠の妥当性を確かめ、場所を辞書に照合する。辞書にない場所では資料を出さない" },
      { stage: "ガイド", claude: "見どころ・意味・やってみること・漢字のなりたち・次の質問（要素ごとに小さな並列呼び出し）", code: "写真にない漢字、長すぎる文を落とす。ガイドは根拠や糸には決してしない" },
      { stage: "確かめる", claude: "日英の資料から主張と原文を抜き出し（並列）、足りない観点を判断して追加で探す", code: "主張ごとに検査（文の実在、主語、否定、時代…）し、採用・格下げ・却下を決める" },
      { stage: "時を照らす", claude: "あえて任せない（存在の判定は誤りが許されないため）", code: "書かれた年に、それが本当にあったかを年表で判定する。この段では Claude に判定させない（質問への答えは Claude が資料から書く）" },
      { stage: "紡ぐ", claude: "主張を引用しながら、この場所の物語を書く", code: "各文の引用をもう一度確かめ、根拠のない文は捨てる" },
      { stage: "糸を引く", claude: "質問に、今回の資料だけから答える（ネイティブの引用：search_result）", code: "引用が原文にあるかを照合する。なければ「書かれていません」と答える" },
      { stage: "評価", claude: "同じ呼び出しを Batch API で一括実行する", code: "正解データと比べて採点し、画面の数字をそこから計算する" },
    ] as Row[],
    measuredTitle: "実測（保存された呼び出しから）",
    measuredNote: (runs: number, since: string) => `${since} 以降の ${runs} 回の探索から。時間は中央値、費用は平均。`,
    colCalls: "呼び出し",
    colModels: "応答したモデル",
    colTime: "時間",
    colCost: "費用",
    stageName: { see: "視る", guide: "ガイド", extract: "確かめる（抜き出し）", gap: "足りない観点の判断", extract2: "追加の資料", narrate: "紡ぐ", viewpoint: "視点の見立て", ask: "糸を引く", translate: "参考訳" } as Record<string, string>,
    featuresTitle: "使っている Claude の機能と、選んだ理由",
    features: [
      ["画像の理解とストリーミング", "写真の文字を読み、読んでいる途中を舞台に見せる"],
      ["構造化出力（zod）", "すべての答えを型で受け、コードの検査を確実にかける"],
      ["ネイティブの引用（search_result）", "答えの一文一文を、資料の原文に紐づけて照合できる"],
      ["モデルの使い分け", "読むこと・書くことは Opus、軽い判断とガイドは Sonnet"],
      ["サーバー側フォールバック", "ライブのデモが、一つのモデルの混雑で止まらない"],
      ["fast mode", "デモ本番だけ速く（費用は約2倍のため、普段は使わない）"],
      ["プロンプトキャッシュ", "毎回同じ指示文を再利用し、時間と費用を下げる"],
      ["Batch API", "評価を一括・半額で回し、画面の数字はその結果から出す"],
    ],
    evalTitle: "評価の数字",
    evalLine: (f: LandingFacts) => `引用は原文からコードが切り出す（Claude は文の番号だけを指す）：${f.citationExactPct}%（${f.citationN} 件）・作った引用の拒否 ${f.rejected}/${f.fabricated}（人工の${f.fabricated}例）・根拠のない文は設計上表示しない（${f.evalRun}）`,
    codeTitle: "Claude Code で作った",
    code: [
      ["計画 → レビュー", "要件から計画モードで計画を立て、別の目でレビューしてから実装した"],
      ["サブエージェント", "調査、日英化、そして毎回ちがう観点からの新しい目の批評（.claude/agents/design-critic.md）"],
      ["スキル", "Claude API の使い方を確かめるスキル。確認手順をまとめた .claude/skills/tsumugi-verify"],
      ["フック", "画面のファイルを編集するたびにデザイン規則のテストを走らせる（.claude/settings.json）"],
      ["実機での確認", "各モデルをこの Mac で動かし、画面は撮影スクリプトで確かめた"],
    ],
  },
  en: {
    back: "TSUMUGI",
    title: "How it works",
    lead: "Claude reads, explains, searches and writes. Every yes or no a traveller relies on is checked by code.",
    why: "What needs Claude here: reading vertical brush script in its original form; pulling claims and their exact wording out of Meiji-era English and Japanese sources; judging what is missing and choosing what to search for next; writing the story and the answers sentence by sentence, citing the sources.",
    splitTitle: "What Claude does, what code decides",
    colStage: "Stage",
    colClaude: "Claude",
    colCode: "Code",
    rows: [
      { stage: "Read", claude: "Reads the text in the photo as written, with reading, meaning and place candidates (vision, structured outputs, streaming)", code: "Checks the boxes; matches the place against the dictionary. No sources at a place it does not know" },
      { stage: "Guide", claude: "What to look at, why it matters, what to try, how the kanji are built, the next questions (small parallel calls)", code: "Drops kanji not in the photo and anything too long. A guide note never becomes evidence or a thread" },
      { stage: "Check", claude: "Takes claims and exact excerpts from Japanese and English sources (in parallel); judges what is missing and searches again", code: "Checks each claim (sentence exists, subject, negation, era …) and accepts, downgrades or rejects it" },
      { stage: "Time", claude: "Deliberately not Claude (existence must not be wrong)", code: "Decides from the timeline whether it existed when the source was written; Claude is not asked at this stage (answers to questions are Claude's, from the sources)" },
      { stage: "Weave", claude: "Writes the story of the place, citing claims", code: "Re-checks every sentence's citations; drops sentences without support" },
      { stage: "Ask", claude: "Answers a question from this run's sources only (native citations: search_result)", code: "Checks each quote against the original; with none, says the sources do not say" },
      { stage: "Evaluate", claude: "Runs the same calls in one Batch API job", code: "Scores against the gold data; the numbers on screen are computed from it" },
    ] as Row[],
    measuredTitle: "Measured (from the stored calls)",
    measuredNote: (runs: number, since: string) => `From ${runs} explorations since ${since}. Time is the median, cost the mean.`,
    colCalls: "calls",
    colModels: "model that answered",
    colTime: "time",
    colCost: "cost",
    stageName: { see: "Read", guide: "Guide", extract: "Check (excerpts)", gap: "What is missing", extract2: "Extra sources", narrate: "Weave", viewpoint: "Viewpoint", ask: "Ask", translate: "Reference translation" } as Record<string, string>,
    featuresTitle: "Claude features in use, and why",
    features: [
      ["Vision and streaming", "Reads the writing in the photo and shows the reading as it happens"],
      ["Structured outputs (zod)", "Every answer arrives typed, so the code checks always apply"],
      ["Native citations (search_result)", "Each sentence of an answer is tied to the source's own words and checked"],
      ["Model split", "Opus to read and write; Sonnet for the light judgments and the guide"],
      ["Server-side fallback", "A live demo does not stop on one model's capacity"],
      ["Fast mode", "Only for the live demo (about twice the cost)"],
      ["Prompt caching", "The same instructions are reused, cutting time and cost"],
      ["Batch API", "The evaluation runs in one batch at half the cost; the numbers on screen come from it"],
    ],
    evalTitle: "Evaluation",
    evalLine: (f: LandingFacts) => `Quotes are cut from the original by code (Claude only points to sentence numbers): ${f.citationExactPct}% (${f.citationN}) · fabricated quotes rejected ${f.rejected}/${f.fabricated} (${f.fabricated} synthetic cases) · unsupported sentences are never shown, by design (${f.evalRun})`,
    codeTitle: "Built with Claude Code",
    code: [
      ["Plan → review", "Plans in plan mode from the requirements, reviewed by a second pair of eyes before any code"],
      ["Subagents", "Research, the ja/en pass, and fresh-eyes critiques from a different side each round (.claude/agents/design-critic.md)"],
      ["Skills", "The Claude API skill before every API change; the checks gathered in .claude/skills/tsumugi-verify"],
      ["Hooks", "Every edit of a screen file runs the design rules test (.claude/settings.json)"],
      ["Checked on the machine", "Each model run on this Mac; every screen checked by screenshot scripts"],
    ],
  },
});

export function HowView({ stages, runs, since, facts }: { stages: StageFact[]; runs: number; since: string; facts: LandingFacts }) {
  const t = useDict(T);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-10" data-testid="how">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <BackLink />
          <Link href="/" className="font-serif text-lead tracking-[0.3em]">
            {t.back}
          </Link>
        </div>
        <LangToggle />
      </header>
      <div>
        <h1 className="font-serif text-display">{t.title}</h1>
        <p className="mt-3 max-w-[40em] text-body text-paper/85">{t.lead}</p>
        <p className="mt-4 max-w-[44em] border-l-2 border-lantern pl-4 font-serif text-body" data-testid="why-claude">
          {t.why}
        </p>
      </div>

      <section className="border-t border-rule pt-6">
        <p className="label">{t.splitTitle}</p>
        <table className="mt-3 w-full border-collapse text-small">
          <thead>
            <tr className="text-left text-caption text-muted">
              <th className="w-28 py-2 font-normal">{t.colStage}</th>
              <th className="py-2 font-normal text-lantern">{t.colClaude}</th>
              <th className="py-2 font-normal">{t.colCode}</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.stage} className="border-t border-rule align-top">
                <td className="py-3 pr-4 font-serif text-body">{r.stage}</td>
                <td className="py-3 pr-6 text-paper/90">{r.claude}</td>
                <td className="py-3 text-paper/75">{r.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border-t border-rule pt-6" data-testid="how-measured">
        <p className="label">{t.measuredTitle}</p>
        <p className="mt-1 text-caption text-muted">{t.measuredNote(runs, since)}</p>
        <table className="mt-3 w-full border-collapse text-small tabular-nums">
          <thead>
            <tr className="text-left text-caption text-muted">
              <th className="py-2 font-normal">{t.colStage}</th>
              <th className="py-2 text-right font-normal">{t.colCalls}</th>
              <th className="py-2 pl-6 font-normal">{t.colModels}</th>
              <th className="py-2 text-right font-normal">{t.colTime}</th>
              <th className="py-2 text-right font-normal">{t.colCost}</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.stage} className="border-t border-rule">
                <td className="py-2">{t.stageName[s.stage] ?? s.stage}</td>
                <td className="py-2 text-right">{s.calls}</td>
                <td className="py-2 pl-6 text-paper/75">{s.models.map((m) => m.replace(/^claude-/, "")).join(", ")}</td>
                <td className="py-2 text-right">{s.medianS.toFixed(1)} s</td>
                <td className="py-2 text-right">${s.meanCost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-10 border-t border-rule pt-6 md:grid-cols-2">
        <div>
          <p className="label">{t.featuresTitle}</p>
          <dl className="mt-3 flex flex-col gap-3">
            {t.features.map(([k, v]) => (
              <div key={k}>
                <dt className="font-serif text-body">{k}</dt>
                <dd className="text-small text-paper/75">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="label mt-8">{t.evalTitle}</p>
          <p className="mt-2 text-small text-paper/85" data-testid="how-eval">
            {t.evalLine(facts)}
          </p>
        </div>
        <div>
          <p className="label">{t.codeTitle}</p>
          <dl className="mt-3 flex flex-col gap-3">
            {t.code.map(([k, v]) => (
              <div key={k}>
                <dt className="font-serif text-body">{k}</dt>
                <dd className="text-small text-paper/75">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
