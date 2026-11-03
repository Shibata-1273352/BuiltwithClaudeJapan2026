/**
 * FR-43: the viewer's travel notes. Notes are rebuilt from the stored exploration events, so they
 * survive reloads; captures (and with them their explorations) are deleted after 7 days (FR-51).
 */
import { sourceTitles } from "./corpus/titles";
import { entities } from "./entities-server";
import { store } from "./store";
import type { WeavePlace } from "./trip-weave";

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

/**
 * The trip weave's input: per note, the place's coordinates and the sources of its accepted claims.
 * Notes whose place has no coordinates are left out of the weave (the list still shows them).
 */
export function weaveInput(notes: NoteSummary[]): { places: WeavePlace[]; titles: Record<string, string> } {
  const E = entities();
  const q = store().prepare("SELECT data_json FROM events WHERE exploration_id = ? AND type = 'claims'");
  const titles = sourceTitles();
  const places: WeavePlace[] = [];
  const used = new Set<string>();
  for (const n of notes) {
    if (!n.place) continue;
    const c = E.ancestors(n.place.id).find((e) => e.coords)?.coords;
    if (!c) continue;
    const sources = (q.all(n.id) as { data_json: string }[])
      .flatMap((r) => (JSON.parse(r.data_json) as { claims?: { source_id?: string; status: string }[] }).claims ?? [])
      .filter((x) => x.status === "accepted" && x.source_id)
      .map((x) => x.source_id!);
    sources.forEach((s) => used.add(s));
    places.push({ id: n.place.id, name: n.place.name, lat: c.lat, lon: c.lon, noteId: n.id, sources: [...new Set(sources)] });
  }
  return { places, titles: Object.fromEntries([...used].map((s) => [s, titles.get(s) ?? s])) };
}
