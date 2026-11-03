/**
 * FR-44 あなたの確認: the viewer marks a pencil / pending thread as checked by them. It records the
 * viewer's own judgment (who, when) and changes the line style to a double line; it never changes
 * the evidence, the claim's status, or what other viewers see as verified.
 */
import { store } from "./store";

export const CONFIRMABLE = new Set(["pencil", "pending"]);
export const THREAD_ID_RE = /^th:[A-Za-z0-9:_.\-]{1,200}$/;

export function confirmationsFor(explorationId: string): Map<string, string> {
  const rows = store().prepare("SELECT thread_id, confirmed_at FROM confirmations WHERE exploration_id = ?").all(explorationId) as { thread_id: string; confirmed_at: string }[];
  return new Map(rows.map((r) => [r.thread_id, r.confirmed_at]));
}

export function setConfirmation(explorationId: string, threadId: string, sessionId: string, on: boolean, now = new Date()): void {
  if (on)
    store()
      .prepare("INSERT INTO confirmations (exploration_id, thread_id, session_id, confirmed_at) VALUES (?,?,?,?) ON CONFLICT(exploration_id, thread_id) DO NOTHING")
      .run(explorationId, threadId, sessionId, now.toISOString());
  else store().prepare("DELETE FROM confirmations WHERE exploration_id = ? AND thread_id = ?").run(explorationId, threadId);
}
