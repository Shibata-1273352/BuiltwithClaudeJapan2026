"use client";

/** Step rail, live chip, result strip, toasts — the frame around the photo (6.2). */
import { AnimatePresence, m } from "motion/react";
import { etaSeconds, STEPS, stepElapsed, stepStatus } from "@/lib/live/eta";
import { stripNumbers, type LiveState } from "@/lib/live/state";
import { StatusDot, Tag } from "../ui/marks";
import { STAGE_WORK, WHO_LABEL } from "./labels";

export function StepRail({ s, elapsed, finished }: { s: LiveState; elapsed: number; finished: boolean }) {
  const eta = etaSeconds(s.stages, elapsed);
  return (
    <ol className="fade-right flex max-w-full items-baseline gap-x-6 overflow-x-auto text-small whitespace-nowrap lg:flex-wrap" data-testid="step-rail" aria-label="探索の段階">
      {/* screen readers hear step changes and completion, not the ticking timers */}
      <li className="sr-only" aria-live="polite">
        {finished ? "探索が完了しました" : (STEPS.find((st) => stepStatus(st, s.stages) === "running")?.ja ?? "")}
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
            <span className="font-serif text-body">{st.ja}</span>
            {status !== "waiting" && <span className="text-caption text-muted tabular-nums">{sec.toFixed(1)}</span>}
          </li>
        );
      })}
      <li className="text-caption text-muted tabular-nums">
        {finished ? `完了 ${((s.done?.elapsed_ms ?? elapsed) / 1000).toFixed(1)} 秒` : eta > 0 ? `残り 約${eta}秒` : "まもなく"}
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

export function LiveChips({ s, finished, replay }: { s: LiveState; finished: boolean; replay?: boolean }) {
  const running = Object.entries(s.stages).filter(([, v]) => v.done === undefined).map(([k]) => k);
  const claude = servedLabel(s);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-small" data-testid="live-chip">
      <Tag tone={replay ? "koto" : finished ? "toki" : "ba"}>
        <span className="mr-1.5 inline-flex">
          <StatusDot tone={replay ? "koto" : finished ? "toki" : "ba"} pulse={!replay && !finished} />
        </span>
        {replay ? "記録の再生" : finished ? "完了" : "LIVE"}
      </Tag>
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
              <span className={`text-caption font-medium ${w.who === "claude" ? "text-lantern" : "text-muted"}`}>{w.who === "claude" ? claude : WHO_LABEL[w.who]}</span>
              {w.ja}
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
  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-4 lg:flex lg:items-end [&>div]:contents lg:[&>div]:flex lg:[&>div]:gap-6 lg:[&>div+div]:ml-6 lg:[&>div+div]:border-l lg:[&>div+div]:border-rule lg:[&>div+div]:pl-6" data-testid="result-strip">
      <div>
        <Num v={sec} label="経過" digits={1} unit="秒" ticking />
      </div>
      <div>
        <Num v={n.sources} label="資料" />
        <Num v={n.passages} label="読んだ節" />
        <Num v={n.languages} label="言語" />
      </div>
      <div>
        <Num v={n.accepted} label="採用した主張" />
        <Num v={n.downgraded + n.rejected} label="格下げ・却下" accent="text-muted" />
      </div>
      <div>
        <Num v={n.threads} label="糸" />
        <Num v={n.broken} label="切れた糸" />
      </div>
      <div>
        <Num v={n.claudeCalls} label="Claude 呼び出し" />
        <Num v={n.costUsd} label="費用" digits={2} unit="$" />
      </div>
    </div>
  );
}

type Toast = { key: string; at: number; text: string; who: string };

function toastsOf(s: LiveState): Toast[] {
  const out: Toast[] = [];
  const see = s.calls.find((c) => c.stage === "see");
  if (s.see && s.at.see !== undefined) out.push({ key: "see", at: s.at.see, who: "Claude", text: `写真から ${s.see.elements.length} 要素を読み取り${see ? ` · ${(see.elapsedMs / 1000).toFixed(1)} s` : ""}` });
  if (s.place && s.at.place !== undefined) out.push({ key: "place", at: s.at.place, who: "コード", text: `場所：${[...s.place.path].reverse().map((p) => p.name.ja).join(" › ")}` });
  if (s.space?.ok && s.at.space !== undefined) out.push({ key: "space", at: s.at.space, who: "SAM 3", text: `${s.space.elements?.length ?? 0} 層に分離 · ${((s.space.ms ?? 0) / 1000).toFixed(1)} s${s.space.aligned ? " · 広重の絵と位置合わせ" : ""}` });
  if (s.visual?.hits.length && s.at.visual !== undefined) out.push({ key: "visual", at: s.at.visual, who: "SigLIP", text: `似た図像：${s.visual.hits[0].title}（${s.visual.hits[0].score.toFixed(2)}）` });
  if (s.graph && s.at.graph !== undefined) out.push({ key: "graph", at: s.at.graph, who: "Neo4j", text: `根拠グラフに保存 · ${((s.graph.ms ?? 0) / 1000).toFixed(1)} s` });
  return out;
}

/** The latest event, docked in the status line (never over the content). */
export function Toasts({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const t = toastsOf(s)
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
