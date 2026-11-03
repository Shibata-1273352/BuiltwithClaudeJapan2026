import { randomUUID } from "node:crypto";
import type { CaptureRow } from "../captures";
import { runExploration } from "../dag/run";
import { checkGuards } from "../guards";
import { store } from "../store";

export type StartResult = { ok: true; exploration_id: string; events: string } | { ok: false; status: number; error: string };

/** Start an exploration for a capture of this session (guards: kill switch, hourly, daily cost). */
export function startExploration(cap: CaptureRow, sid: string): StartResult {
  const g = checkGuards();
  if (!g.ok) return { ok: false, status: g.reason === "killed" ? 503 : 429, error: g.reason };
  const id = `exp_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  store()
    .prepare("INSERT INTO explorations (id, capture_id, session_id, status, created_at) VALUES (?,?,?,?,?)")
    .run(id, cap.id, sid, "running", new Date().toISOString());
  void runExploration(id, cap); // background; the DAG enforces its own deadline
  return { ok: true, exploration_id: id, events: `/api/explorations/${id}/events` };
}
