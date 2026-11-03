/**
 * The timeline of one stored exploration (no Claude): when each stage started and ended, and each
 * Claude call's model, time and output tokens. For finding the critical path.
 *   npx tsx --env-file=.env scripts/profile-run.ts <exploration id>
 */
import path from "node:path";
import Database from "better-sqlite3";

const id = process.argv[2];
if (!id) throw new Error("usage: profile-run.ts <exploration id>");
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const ev = db.prepare("SELECT type, data_json, ts FROM events WHERE exploration_id = ? ORDER BY seq").all(id) as { type: string; data_json: string; ts: string }[];
const t0 = Date.parse(ev[0].ts);
const open: Record<string, number> = {};
const rows: string[] = [];
for (const e of ev) {
  const d = JSON.parse(e.data_json);
  const t = (Date.parse(e.ts) - t0) / 1000;
  if (e.type === "stage" && d.status === "start") open[d.stage] = t;
  if (e.type === "stage" && d.status === "done") rows.push(`${String(open[d.stage]?.toFixed(1)).padStart(5)} → ${t.toFixed(1).padStart(5)}  ${d.stage}`);
  if (e.type === "ai_call") rows.push(`              call ${d.stage} ${d.servedModel} ${(d.elapsedMs / 1000).toFixed(1)}s out ${d.usage.output}${d.speed ? " " + d.speed : ""}`);
  if (e.type === "done") rows.push(`done ${t.toFixed(1)} s · $${d.cost_usd} · ${d.claude_calls} calls`);
}
console.log(rows.join("\n"));
