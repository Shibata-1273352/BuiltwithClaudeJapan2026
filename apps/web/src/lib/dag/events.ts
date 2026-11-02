/**
 * Exploration events (REQUIREMENTS.md 4.11): numbered, persisted, replayable. SSE clients resume
 * with Last-Event-ID. An in-process emitter wakes waiting streams; the DB is the source of truth.
 */
import { EventEmitter } from "node:events";
import { store } from "../store";

export type EventType =
  | "received"
  | "stage"
  | "see"
  | "place"
  | "plan"
  | "candidates"
  | "gap"
  | "claims"
  | "existence"
  | "conflicts"
  | "threads"
  | "names"
  | "timeline"
  | "space"
  | "narrative"
  | "graph"
  | "ai_call"
  | "notice"
  | "done"
  | "failed";

export type StoredEvent = { seq: number; type: EventType; data: unknown; ts: string };

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function emit(explorationId: string, type: EventType, data: unknown): StoredEvent {
  const db = store();
  const ts = new Date().toISOString();
  const seq = db.transaction(() => {
    const r = db.prepare("SELECT coalesce(max(seq), 0) + 1 AS s FROM events WHERE exploration_id = ?").get(explorationId) as { s: number };
    db.prepare("INSERT INTO events (exploration_id, seq, type, data_json, ts) VALUES (?,?,?,?,?)").run(
      explorationId,
      r.s,
      type,
      JSON.stringify(data),
      ts,
    );
    return r.s;
  })();
  const ev = { seq, type, data, ts };
  bus.emit(explorationId, ev);
  return ev;
}

export function eventsAfter(explorationId: string, after: number): StoredEvent[] {
  const rows = store()
    .prepare("SELECT seq, type, data_json, ts FROM events WHERE exploration_id = ? AND seq > ? ORDER BY seq")
    .all(explorationId, after) as { seq: number; type: EventType; data_json: string; ts: string }[];
  return rows.map((r) => ({ seq: r.seq, type: r.type, data: JSON.parse(r.data_json), ts: r.ts }));
}

export function subscribe(explorationId: string, fn: (e: StoredEvent) => void): () => void {
  bus.on(explorationId, fn);
  return () => bus.off(explorationId, fn);
}

export const TERMINAL: EventType[] = ["done", "failed"];
