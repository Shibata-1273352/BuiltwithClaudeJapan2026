/**
 * FR-25: the threads across space — for each source of a run, where it comes from (where the object
 * is held, where its writer was born, who publishes it), with the distance to the photo's site.
 * Pure: the data is corpus/places.json; distances are computed (great circle), never typed.
 */
export type Bi = { ja: string; en: string };
export type SourcePlace = { role: "held" | "origin" | "publisher"; name: Bi; lat: number; lon: number; basis: string };
export type WorldPoint = SourcePlace & { sourceId: string; km: number };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Points for these sources: far places first (they are the story), at most one per place and role. */
export function worldPoints(sourceIds: string[], places: Record<string, SourcePlace[]>, site: { lat: number; lon: number }): WorldPoint[] {
  const out: WorldPoint[] = [];
  const seen = new Set<string>();
  for (const id of sourceIds)
    for (const p of places[id] ?? []) {
      const key = `${p.role}:${p.lat.toFixed(2)},${p.lon.toFixed(2)}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...p, sourceId: id, km: Math.round(km(site, p)) });
    }
  return out.sort((a, b) => b.km - a.km);
}

/**
 * Equirectangular, centered on the Pacific so Japan sits left of center, the Americas to the right
 * and Europe at the left edge: x in [0, w], y in [0, h].
 */
export function project(p: { lat: number; lon: number }, w: number, h: number, center = 160): { x: number; y: number } {
  const lon = ((((p.lon - center + 540) % 360) + 360) % 360) - 180;
  return { x: ((lon + 180) / 360) * w, y: ((90 - p.lat) / 180) * h };
}
