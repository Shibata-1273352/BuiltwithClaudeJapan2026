/**
 * The words behind each event of the reviewed timeline (pure; the server resolves the sentences):
 * at a stop of 時をめくる, the event's own evidence is shown verbatim, in its source's language. When the
 * same event is backed by a Japanese AND an English source, the two lines tie into one knot (結び) —
 * crossing the language barrier is then a fact of the record, not a translation.
 */
export type Quote = { text: string; source: string; title: string; lang: "ja" | "en" };
export type EventQuotes = Record<string, Quote[]>;

/** At most one line per language: the longest (it usually carries the who and the what), kept short. */
export function pickQuotes(qs: Quote[], max = 170): Quote[] {
  const best = new Map<string, Quote>();
  for (const q of qs) {
    if (q.text.length > max) continue;
    const cur = best.get(q.lang);
    if (!cur || q.text.length > cur.text.length) best.set(q.lang, q);
  }
  return ["ja", "en"].map((l) => best.get(l)).filter((q): q is Quote => Boolean(q));
}

/** The knot: a Japanese and an English source, from different sources, back the same event. */
export function knotOf(qs: Quote[]): { ja: Quote; en: Quote } | null {
  const picked = pickQuotes(qs);
  const ja = picked.find((q) => q.lang === "ja");
  const en = picked.find((q) => q.lang === "en");
  return ja && en && ja.source !== en.source ? { ja, en } : null;
}

/**
 * Claude's readings of the photo that lie on a cut-out: at least 40% of the reading's box overlaps the
 * cut-out's bbox (Claude's boxes run a little larger than SAM 3's masks), or its centre lies within
 * NEAR of it (small boxes can sit just off the mask). Both are 0..1 of the photo.
 */
const NEAR = 0.07;

export function readingsInside<T extends { box: { x: number; y: number; w: number; h: number }; text_original: string | null }>(
  readings: T[],
  bbox: [number, number, number, number],
  minShare = 0.4,
): T[] {
  const [x1, y1, x2, y2] = bbox;
  return readings.filter((r) => {
    if (!r.text_original || r.box.w <= 0 || r.box.h <= 0) return false;
    const ix = Math.max(0, Math.min(x2, r.box.x + r.box.w) - Math.max(x1, r.box.x));
    const iy = Math.max(0, Math.min(y2, r.box.y + r.box.h) - Math.max(y1, r.box.y));
    const cx = r.box.x + r.box.w / 2;
    const cy = r.box.y + r.box.h / 2;
    const near = cx > x1 - NEAR && cx < x2 + NEAR && cy > y1 - NEAR && cy < y2 + NEAR;
    return (ix * iy) / (r.box.w * r.box.h) >= minShare || near;
  });
}
