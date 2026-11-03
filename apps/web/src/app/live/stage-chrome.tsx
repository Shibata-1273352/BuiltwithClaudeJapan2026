"use client";

/** Step rail, live chip, result strip, toasts — the frame around the photo (6.2). */
import { AnimatePresence, m } from "motion/react";
import { etaSeconds, STEPS, stepElapsed, stepStatus } from "@/lib/live/eta";
import { stripNumbers, type LiveState } from "@/lib/live/state";
import { StatusDot, Tag } from "../ui/marks";
import { dict, useDict, useLang } from "../i18n";
import { STAGE_WORK, WHO_LABEL } from "./labels";

const T = dict({
  ja: { steps: "探索の段階", done: "探索が完了しました", finished: (s: string) => `完了 ${s} 秒`, eta: (n: number) => `残り 約${n}秒`, soon: "まもなく", replay: "記録の再生", fin: "完了", elapsed: "経過", sec: "秒", sources: "資料", passages: "読んだ節", langs: "言語", accepted: "採用した主張", down: "格下げ・却下", threads: "糸", broken: "切れた糸", calls: "Claude 呼び出し", cost: "費用", code: "コード", read: (n: number) => `写真から ${n} 要素を読み取り`, place: "場所：", layers: (n: number) => `${n} 層に分離`, aligned: " · 広重の絵と位置合わせ", similar: "似た図像：", graph: "根拠グラフに保存" },
  en: { steps: "Steps of the exploration", done: "The exploration is complete", finished: (s: string) => `Done in ${s} s`, eta: (n: number) => `about ${n} s left`, soon: "almost there", replay: "Replay", fin: "Done", elapsed: "elapsed", sec: "s", sources: "sources", passages: "passages read", langs: "languages", accepted: "claims kept", down: "downgraded / rejected", threads: "threads", broken: "broken", calls: "Claude calls", cost: "cost", code: "Code", read: (n: number) => `read ${n} things in the photo`, place: "Place: ", layers: (n: number) => `${n} layers`, aligned: " · aligned with Hiroshige's print", similar: "Similar picture: ", graph: "saved to the evidence graph" },
});

export function StepRail({ s, elapsed, finished }: { s: LiveState; elapsed: number; finished: boolean }) {
  const eta = etaSeconds(s.stages, elapsed);
  const t = useDict(T);
  const lang = useLang();
  return (
    <ol className="fade-right flex max-w-full items-baseline gap-x-6 overflow-x-auto text-small whitespace-nowrap lg:flex-wrap" data-testid="step-rail" aria-label={t.steps}>
      {/* screen readers hear step changes and completion, not the ticking timers */}
      <li className="sr-only" aria-live="polite">
        {finished ? t.done : (STEPS.find((st) => stepStatus(st, s.stages) === "running")?.[lang] ?? "")}
      </li>
      {STEPS.map((st, i) => {
        const status = stepStatus(st, s.stages);
        const sec = stepElapsed(st, s.stages, elapsed) / 1000;
        return (
          <li
            key={st.key}
            className={`flex items-baseline gap-1.5 border-b-2 pb-1 transition-colors ${status === "running" ? "border-lantern text-paper" : status === "done" ? "border-transparent text-paper/60" : "border-transparent text-muted/70"}`}
            aria-current={status === "running" ? "step" : undefined}
          >
            <span className="text-caption text-muted tabular-nums">{st.parallel ? "∥" : String(i + 1).padStart(2, "0")}</span>
            <span className="font-serif text-body">{st[lang]}</span>
            {status === "running" && <span className="text-caption text-muted tabular-nums">{sec.toFixed(1)}</span>}
          </li>
        );
      })}
      <li className="text-caption text-muted tabular-nums">
        {finished ? t.fin : eta > 0 ? t.eta(eta) : t.soon}
      </li>
    </ol>
  );
}

/** What is working right now — several at once when the DAG runs in parallel. */
/** The model that actually answered (server-side fallback may serve another one). */
function servedLabel(s: LiveState): string {
  const m = s.calls.at(-1)?.served ?? "claude-opus-5-5";
  return m.replace(/^claude-/, "Claude ").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/(^|\s)([a-z])/g, (x) => x.toUpperCase());
}

export function LiveChips({ s, finished, replay, note }: { s: LiveState; finished: boolean; replay?: boolean; note?: React.ReactNode }) {
  const running = Object.entries(s.stages)
    .filter(([, v]) => v.done === undefined)
    .map(([k]) => k)
    .slice(-3);
  const claude = servedLabel(s);
  const t = useDict(T);
  const lang = useLang();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-small" data-testid="live-chip">
      <Tag tone={replay ? "koto" : finished ? "toki" : "ba"}>
        <span className="mr-1.5 inline-flex">
          <StatusDot tone={replay ? "koto" : finished ? "toki" : "ba"} pulse={!replay && !finished} />
        </span>
        {replay ? t.replay : finished ? t.fin : "LIVE"}
      </Tag>
      {note}
      <AnimatePresence initial={false}>
        {running.map((k) => {
          const w = STAGE_WORK[k];
          if (!w) return null;
          return (
            <m.span
              key={k}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={`inline-flex items-baseline gap-2 ${w.who === "claude" ? "text-paper" : "text-muted"}`}
            >
              <span className={`text-caption font-medium ${w.who === "claude" ? "text-lantern" : "text-muted"}`}>{w.who === "claude" ? claude : WHO_LABEL[lang][w.who]}</span>
              {w[lang]}
            </m.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Num({ v, label, accent, digits = 0, unit = "", ticking = false }: { v: number; label: string; accent?: string; digits?: number; unit?: string; ticking?: boolean }) {
  return (
    <div className="flex min-w-14 flex-col">
      <m.span key={ticking ? "t" : v.toFixed(digits)} initial={ticking ? false : { opacity: 0.3, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`font-serif text-title leading-none font-medium tabular-nums ${v === 0 && !ticking ? "text-muted" : (accent ?? "")}`}>
        {unit === "$" ? "$" : ""}
        {v.toFixed(digits)}
        {unit && unit !== "$" ? <span className="ml-0.5 text-small text-muted">{unit}</span> : null}
      </m.span>
      <span className="mt-1 text-caption text-muted">{label}</span>
    </div>
  );
}

/** The big numbers (6.2): what this run looked at and what it kept. */
export function ResultStrip({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const n = stripNumbers(s);
  const sec = s.done?.elapsed_ms ? s.done.elapsed_ms / 1000 : elapsed / 1000;
  const t = useDict(T);
  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-4 lg:flex lg:items-end [&>div]:contents lg:[&>div]:flex lg:[&>div]:gap-6 lg:[&>div+div]:ml-6 lg:[&>div+div]:border-l lg:[&>div+div]:border-rule lg:[&>div+div]:pl-6" data-testid="result-strip">
      <div>
        <Num v={sec} label={t.elapsed} digits={1} unit={t.sec} ticking />
      </div>
      <div>
        <Num v={n.sources} label={t.sources} />
      </div>
      <div>
        <Num v={n.threads} label={t.threads} />
        <Num v={n.broken} label={t.broken} />
      </div>
    </div>
  );
}

type Toast = { key: string; at: number; text: string; who: string };

function toastsOf(s: LiveState, t: (typeof T)["ja"], lang: "ja" | "en"): Toast[] {
  const out: Toast[] = [];
  const see = s.calls.find((c) => c.stage === "see");
  if (s.see && s.at.see !== undefined) out.push({ key: "see", at: s.at.see, who: "Claude", text: `${t.read(s.see.elements.length)}${see ? ` · ${(see.elapsedMs / 1000).toFixed(1)} s` : ""}` });
  if (s.place && s.at.place !== undefined) out.push({ key: "place", at: s.at.place, who: t.code, text: `${t.place}${[...s.place.path].reverse().map((p) => p.name[lang]).join(" › ")}` });
  if (s.space?.ok && s.at.space !== undefined) out.push({ key: "space", at: s.at.space, who: "SAM 3", text: `${t.layers(s.space.elements?.length ?? 0)} · ${((s.space.ms ?? 0) / 1000).toFixed(1)} s${s.space.aligned ? t.aligned : ""}` });
  if (s.visual?.hits.length && s.at.visual !== undefined) out.push({ key: "visual", at: s.at.visual, who: "SigLIP", text: `${t.similar}${s.visual.hits[0].title}（${s.visual.hits[0].score.toFixed(2)}）` });
  if (s.graph && s.at.graph !== undefined) out.push({ key: "graph", at: s.at.graph, who: "Neo4j", text: `${t.graph} · ${((s.graph.ms ?? 0) / 1000).toFixed(1)} s` });
  return out;
}

/** The latest event, docked in the status line (never over the content). */
export function Toasts({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const tt = useDict(T);
  const lang = useLang();
  const t = toastsOf(s, tt, lang)
    .filter((x) => elapsed - x.at < 5000)
    .sort((a, b) => b.at - a.at)[0];
  return (
    <span className="min-w-0 truncate text-caption text-muted" aria-live="polite" data-testid="event-line">
      <AnimatePresence mode="wait">
        {t && (
          <m.span key={t.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="mr-2 text-paper/80">{t.who}</span>
            {t.text}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}
