"use client";

/** Step rail, live chip, result strip, toasts — the frame around the photo (6.2). */
import { AnimatePresence, m } from "motion/react";
import { etaSeconds, STEPS, stepElapsed, stepStatus } from "@/lib/live/eta";
import { stripNumbers, type LiveState } from "@/lib/live/state";
import { STAGE_WORK, WHO_LABEL } from "./labels";

export function StepRail({ s, elapsed, finished }: { s: LiveState; elapsed: number; finished: boolean }) {
  const eta = etaSeconds(s.stages, elapsed);
  return (
    <ol className="flex max-w-full items-center gap-x-1 overflow-x-auto text-sm whitespace-nowrap lg:flex-wrap lg:gap-y-2" data-testid="step-rail" aria-label="探索の段階">
      {/* screen readers hear step changes and completion, not the ticking timers */}
      <li className="sr-only" aria-live="polite">
        {finished ? "探索が完了しました" : (STEPS.find((st) => stepStatus(st, s.stages) === "running")?.ja ?? "")}
      </li>
      {STEPS.map((st, i) => {
        const status = stepStatus(st, s.stages);
        const sec = stepElapsed(st, s.stages, elapsed) / 1000;
        return (
          <li key={st.key} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className={`mx-1 h-px w-5 ${st.parallel ? "border-t border-dashed border-muted/60" : "bg-muted/40"}`} />}
            <span
              className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition-colors ${
                status === "running" ? "bg-lantern/20 text-paper ring-1 ring-lantern" : status === "done" ? "text-paper" : "text-muted/70"
              }`}
              aria-current={status === "running" ? "step" : undefined}
            >
              <span aria-hidden className={`size-2 rounded-full ${status === "running" ? "animate-pulse bg-lantern" : status === "done" ? "bg-toki" : "bg-muted/40"}`} />
              <span className="font-serif">{st.ja}</span>
              {status !== "waiting" && <span className="tabular-nums text-xs text-muted">{sec.toFixed(1)}s</span>}
            </span>
          </li>
        );
      })}
      <li className="ml-3 text-xs text-muted tabular-nums">
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
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="live-chip">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold tracking-wider ${replay ? "bg-koto/20 text-koto" : finished ? "bg-toki/20 text-toki" : "bg-ba/20 text-ba"}`}>
        <span aria-hidden className={`size-1.5 rounded-full ${replay ? "bg-koto" : finished ? "bg-toki" : "animate-pulse bg-ba"}`} />
        {replay ? "記録の再生" : finished ? "完了" : "LIVE"}
      </span>
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${w.who === "claude" ? "border-lantern/60 text-paper" : "border-muted/40 text-muted"}`}
            >
              <span className={w.who === "claude" ? "font-bold text-lantern" : "font-bold"}>{w.who === "claude" ? claude : WHO_LABEL[w.who]}</span>
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
    <div className="flex min-w-16 flex-col">
      <m.span key={ticking ? "t" : v.toFixed(digits)} initial={ticking ? false : { opacity: 0.3, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`font-serif text-3xl leading-none tabular-nums ${accent ?? ""}`}>
        {unit === "$" ? "$" : ""}
        {v.toFixed(digits)}
        {unit && unit !== "$" ? <span className="ml-0.5 text-base">{unit}</span> : null}
      </m.span>
      <span className="mt-1 text-[11px] text-muted">{label}</span>
    </div>
  );
}

/** The big numbers (6.2): what this run looked at and what it kept. */
export function ResultStrip({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const n = stripNumbers(s);
  const sec = s.done?.elapsed_ms ? s.done.elapsed_ms / 1000 : elapsed / 1000;
  return (
    <div className="flex flex-wrap items-end gap-x-7 gap-y-3" data-testid="result-strip">
      <Num v={sec} label="経過" digits={1} unit="秒" ticking />
      <Num v={n.sources} label="資料" />
      <Num v={n.passages} label="読んだ節" />
      <Num v={n.languages} label="言語" />
      <Num v={n.accepted} label="採用した主張" accent="text-toki" />
      <Num v={n.downgraded + n.rejected} label="格下げ・却下" accent="text-muted" />
      <Num v={n.threads} label="糸" />
      <Num v={n.broken} label="切れた糸" accent="text-ba" />
      <Num v={n.claudeCalls} label="Claude 呼び出し" accent="text-lantern" />
      <Num v={n.costUsd} label="費用" digits={2} unit="$" />
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

export function Toasts({ s, elapsed }: { s: LiveState; elapsed: number }) {
  const live = toastsOf(s).filter((t) => elapsed - t.at < 4500);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-80 flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {live.map((t) => (
          <m.div
            key={t.key}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="rounded-lg border border-muted/30 bg-night-2/95 px-3 py-2 text-sm shadow-lg backdrop-blur"
          >
            <span className="mr-2 text-xs font-bold text-lantern">{t.who}</span>
            {t.text}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
