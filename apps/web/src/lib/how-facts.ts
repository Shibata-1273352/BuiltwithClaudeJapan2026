/**
 * /how: what each Claude call costs and takes, measured from the stored calls (ai_calls) — never
 * typed. Per stage: how many calls, which models answered, the median time and the mean cost.
 */
import { store } from "./store";

export type StageFact = { stage: string; calls: number; models: string[]; medianS: number; meanCost: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** Group call records by stage (pure: the page passes rows from the store). */
export function stageFacts(rows: { stage: string; record_json: string; cost_usd: number }[]): StageFact[] {
  const by = new Map<string, { ms: number[]; cost: number[]; models: Set<string> }>();
  for (const r of rows) {
    const rec = JSON.parse(r.record_json) as { elapsedMs?: number; servedModel?: string; model?: string };
    const key = r.stage.replace(/^extract.*$/, "extract").replace(/^narrate.*$/, "narrate");
    const g = by.get(key) ?? { ms: [], cost: [], models: new Set<string>() };
    if (typeof rec.elapsedMs === "number") g.ms.push(rec.elapsedMs);
    g.cost.push(r.cost_usd);
    const m = rec.servedModel ?? rec.model;
    if (m) g.models.add(m.replace(/-\d{8}$/, ""));
    by.set(key, g);
  }
  return [...by.entries()]
    .map(([stage, g]) => ({ stage, calls: g.cost.length, models: [...g.models].sort(), medianS: median(g.ms) / 1000, meanCost: g.cost.reduce((a, b) => a + b, 0) / Math.max(1, g.cost.length) }))
    .sort((a, b) => b.calls - a.calls);
}

export function howFacts(days = 14): { stages: StageFact[]; runs: number; since: string } {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = store();
  const rows = db.prepare("SELECT stage, record_json, cost_usd FROM ai_calls WHERE ts > ?").all(since) as { stage: string; record_json: string; cost_usd: number }[];
  const runs = (db.prepare("SELECT count(DISTINCT exploration_id) AS n FROM ai_calls WHERE ts > ?").get(since) as { n: number }).n;
  return { stages: stageFacts(rows), runs, since: since.slice(0, 10) };
}
