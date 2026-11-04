/**
 * Step rail and ETA (6.2, NN/g: show progress and an estimate for waits over 10 s). Medians of the
 * standard-speed runs after the performance work of 2026-11-03 (total ~25 s; fast mode finishes
 * sooner, and an estimate that ends early is the better error). The rail shows these user-facing
 * steps; the DAG stages map onto them.
 */
export type Step = { key: string; ja: string; en: string; stages: string[]; median: number; parallel?: boolean };

export const STEPS: Step[] = [
  { key: "see", ja: "視る", en: "Read the photo", stages: ["see", "place"], median: 9000 },
  { key: "search", ja: "探す", en: "Search books", stages: ["plan", "retrieve"], median: 200 },
  { key: "check", ja: "確かめる", en: "Check claims", stages: ["extract:en", "extract:ja", "gap", "extract2"], median: 9000 },
  { key: "time", ja: "時を照らす", en: "Check the dates", stages: ["existence", "names"], median: 100 },
  { key: "weave", ja: "紡ぐ", en: "Weave the story", stages: ["narrate", "graph"], median: 6500 },
  { key: "ma", ja: "間", en: "Layers", stages: ["space"], median: 7000, parallel: true },
];

type Stages = Record<string, { started: number; done?: number }>;

export function stepStatus(step: Step, stages: Stages): "waiting" | "running" | "done" {
  const st = step.stages.map((k) => stages[k]).filter(Boolean);
  if (!st.length) return "waiting";
  // a step is done when every stage it has started is done and its last stage has been reached
  const last = stages[step.stages[step.stages.length - 1]];
  if (st.every((x) => x!.done !== undefined) && (last?.done !== undefined || step.stages.length === st.length)) return "done";
  return "running";
}

/** Elapsed ms of a step (from its first start to its last done, or to now). */
export function stepElapsed(step: Step, stages: Stages, now: number): number {
  const st = step.stages.map((k) => stages[k]).filter(Boolean) as { started: number; done?: number }[];
  if (!st.length) return 0;
  const start = Math.min(...st.map((x) => x.started));
  const end = st.every((x) => x.done !== undefined) ? Math.max(...st.map((x) => x.done!)) : now;
  return Math.max(0, end - start);
}

/** Seconds left, rounded up, from the medians of the steps not done yet (the serial path). */
export function etaSeconds(stages: Stages, now: number): number {
  let ms = 0;
  for (const step of STEPS) {
    if (step.parallel) continue;
    const s = stepStatus(step, stages);
    if (s === "done") continue;
    ms += s === "running" ? Math.max(1000, step.median - stepElapsed(step, stages, now)) : step.median;
  }
  return Math.ceil(ms / 1000);
}
