import { sourceMeta } from "./corpus/titles";
import { eventsAfter } from "./dag/events";
import { cachedNarrative } from "./narrative-service";
import { confirmationsFor } from "./confirmations";
import { buildNote, type Note } from "./note";
import { store } from "./store";

export const EXP_ID_RE = /^exp_[0-9a-f]{20}$/;

/** The note for an exploration the viewer may read (own session, or the read-only presenter). */
export function loadNote(id: string, viewer: { sid: string | null; presenter: boolean }): Note | null {
  if (!EXP_ID_RE.test(id)) return null;
  const row = store().prepare("SELECT session_id, capture_id, status FROM explorations WHERE id = ?").get(id) as
    | { session_id: string; capture_id: string; status: string }
    | undefined;
  if (!row || (!viewer.presenter && row.session_id !== viewer.sid)) return null;
  const cached = { ja: cachedNarrative(id, "ja") ?? undefined, en: cachedNarrative(id, "en") ?? undefined };
  return buildNote(id, row.capture_id, eventsAfter(id, 0), sourceMeta(), cached, confirmationsFor(id));
}
