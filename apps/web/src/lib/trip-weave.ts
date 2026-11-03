/**
 * The trip weave (step 8): the places of one trip, joined by the sources they share — Bird's letter
 * reaches both Asakusa and Ueno, so a thread runs between them. Pure; the server collects, per note,
 * the sources of its accepted claims.
 */
export type Bi = { ja: string; en: string };
export type WeavePlace = { id: string; name: Bi; lat: number; lon: number; noteId: string; sources: string[] };
export type WeaveThread = { a: string; b: string; sources: string[] };

/** One node per place (the newest note wins), one thread per pair of places with shared sources. */
export function tripWeave(notes: WeavePlace[]): { places: WeavePlace[]; threads: WeaveThread[] } {
  const byPlace = new Map<string, WeavePlace>();
  for (const n of notes) {
    const cur = byPlace.get(n.id);
    // keep the first note seen (notes come newest first) but gather every source of the place
    if (!cur) byPlace.set(n.id, { ...n, sources: [...new Set(n.sources)] });
    else cur.sources = [...new Set([...cur.sources, ...n.sources])];
  }
  const places = [...byPlace.values()];
  const threads: WeaveThread[] = [];
  for (let i = 0; i < places.length; i++)
    for (let j = i + 1; j < places.length; j++) {
      const shared = places[i].sources.filter((s) => places[j].sources.includes(s)).sort();
      if (shared.length) threads.push({ a: places[i].id, b: places[j].id, sources: shared });
    }
  return { places, threads: threads.sort((x, y) => y.sources.length - x.sources.length) };
}

/**
 * A schematic, not a survey: nudge points apart until no two are closer than `min` (places a few
 * hundred metres apart would otherwise sit on one another). Geography is kept roughly; inside the box.
 */
export function spread(pts: { x: number; y: number }[], w: number, h: number, min = 90, pad = 50): { x: number; y: number }[] {
  const p = pts.map((q) => ({ ...q }));
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].x - p[i].x;
        let dy = p[j].y - p[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-6) [dx, dy, d] = [Math.cos(i + j), Math.sin(i + j), 1];
        const push = (min - d) / 2;
        p[i].x -= (dx / d) * push;
        p[i].y -= (dy / d) * push;
        p[j].x += (dx / d) * push;
        p[j].y += (dy / d) * push;
        moved = true;
      }
    for (const q of p) {
      q.x = Math.min(w - pad, Math.max(pad, q.x));
      q.y = Math.min(h - pad, Math.max(pad, q.y));
    }
    if (!moved) break;
  }
  return p;
}

/** Fit the places in a w×h box (equirectangular is fine at city scale), with padding. */
export function fitPlaces(places: { lat: number; lon: number }[], w: number, h: number, pad = 60): (p: { lat: number; lon: number }) => { x: number; y: number } {
  const lats = places.map((p) => p.lat);
  const lons = places.map((p) => p.lon);
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const k = Math.cos(((la0 + la1) / 2) * (Math.PI / 180)); // shrink longitude at this latitude
  const spanX = Math.max(1e-4, (lo1 - lo0) * k);
  const spanY = Math.max(1e-4, la1 - la0);
  const s = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const ox = (w - spanX * s) / 2;
  const oy = (h - spanY * s) / 2;
  return (p) => ({ x: ox + (p.lon - lo0) * k * s, y: oy + (la1 - p.lat) * s });
}
