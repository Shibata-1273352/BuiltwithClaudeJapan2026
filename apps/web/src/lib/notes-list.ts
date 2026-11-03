/**
 * FR-43: the viewer's travel notes. Notes are rebuilt from the stored exploration events, so they
 * survive reloads; captures (and with them their explorations) are deleted after 7 days (FR-51).
 */
import { entities } from "./entities-server";
import { store } from "./store";

export type NoteSummary = { id: string; created_at: string; place: { id: string; name: { ja: string; en: string } } | null; sentences: number; cost_usd: number };

export function notesFor(viewer: { sid: string | null; presenter: boolean }, limit = 50): NoteSummary[] {
  if (!viewer.sid && !viewer.presenter) return [];
  const rows = (
    viewer.presenter
      ? store().prepare("SELECT id, created_at, cost_usd, result_json FROM explorations WHERE status = 'done' ORDER BY created_at DESC LIMIT ?").all(limit)
      : store().prepare("SELECT id, created_at, cost_usd, result_json FROM explorations WHERE status = 'done' AND session_id = ? ORDER BY created_at DESC LIMIT ?").all(viewer.sid, limit)
  ) as { id: string; created_at: string; cost_usd: number; result_json: string | null }[];
  const E = entities();
  return rows
    .map((r) => {
      const res = r.result_json ? (JSON.parse(r.result_json) as { place?: string | null; narrative_sentences?: number }) : {};
      const ent = res.place ? E.get(res.place) : undefined;
      return { id: r.id, created_at: r.created_at, place: ent ? { id: ent.id, name: ent.name } : null, sentences: res.narrative_sentences ?? 0, cost_usd: r.cost_usd };
    })
    .filter((n) => n.place && n.sentences > 0); // a stopped exploration (unknown place) has no note
}
