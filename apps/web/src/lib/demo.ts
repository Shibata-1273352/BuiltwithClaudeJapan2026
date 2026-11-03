/**
 * The one public recording (FR-47 fallback for "例で試す"): DEMO_REPLAY_ID names an exploration of
 * the CC0 sample photo that anyone with access to the app may replay — a visitor's own photos stay
 * private. Opened only for: the replay page, the events route with ?pace=replay, and its scene files.
 */
import { store } from "./store";

export function demoReplayId(): string | null {
  const id = process.env.DEMO_REPLAY_ID;
  return id && /^exp_[0-9a-f]{20}$/.test(id) ? id : null;
}

export function isDemoReplay(explorationId: string): boolean {
  return demoReplayId() === explorationId;
}

/** The capture id of the demo recording (its scene files may be served). */
export function demoCaptureId(): string | null {
  const id = demoReplayId();
  if (!id) return null;
  const r = store().prepare("SELECT capture_id FROM explorations WHERE id = ?").get(id) as { capture_id: string } | undefined;
  return r?.capture_id ?? null;
}
