/** Pure helpers for on-device preprocessing (FR-02, FR-03). Unit-tested. */

export const MAX_LONG_SIDE = 2048;

export type Box = { x: number; y: number; w: number; h: number }; // pixels

export function fitWithin(w: number, h: number, max = MAX_LONG_SIDE): { w: number; h: number; scale: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale), scale };
}

/** Grow a face box (detectors are tight around the face; hair/ears also identify people) and clamp to the image. */
export function expandBox(b: Box, imgW: number, imgH: number, factor = 1.5): Box {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const w = b.w * factor;
  const h = b.h * factor;
  const x = Math.max(0, cx - w / 2);
  const y = Math.max(0, cy - h / 2);
  return { x, y, w: Math.min(imgW - x, w), h: Math.min(imgH - y, h) };
}

/** Manual blur box centered on a tap, sized relative to the image. */
export function boxAround(px: number, py: number, imgW: number, imgH: number, frac = 0.12): Box {
  const s = Math.max(imgW, imgH) * frac;
  return expandBox({ x: px - s / 2, y: py - s / 2, w: s, h: s }, imgW, imgH, 1);
}

/**
 * Overlapping tiles for detection: the full image plus an n×n grid with `overlap` fraction.
 * The short-range detector sees a 128×128 input, so tiling raises effective resolution for
 * small (distant) faces.
 */
export function tiles(imgW: number, imgH: number, sizes: number[] = [768, 384], overlap = 0.25): Box[] {
  const out: Box[] = [{ x: 0, y: 0, w: imgW, h: imgH }];
  for (const s of sizes) {
    if (s >= Math.max(imgW, imgH)) continue;
    const step = s * (1 - overlap);
    const nx = Math.max(1, Math.ceil((imgW - s) / step) + 1);
    const ny = Math.max(1, Math.ceil((imgH - s) / step) + 1);
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const x = Math.min(Math.round(c * step), Math.max(0, imgW - s));
        const y = Math.min(Math.round(r * step), Math.max(0, imgH - s));
        out.push({ x, y, w: Math.min(s, imgW), h: Math.min(s, imgH) });
      }
    }
  }
  return out;
}

function intersection(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

export function iou(a: Box, b: Box): number {
  const inter = intersection(a, b);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Non-maximum suppression; also drops a box that lies mostly (>70%) inside a kept one. */
export function nms(boxes: (Box & { score: number })[], thresh = 0.3): (Box & { score: number })[] {
  const keep: (Box & { score: number })[] = [];
  for (const b of [...boxes].sort((a, c) => c.score - a.score)) {
    const covered = keep.some((k) => iou(k, b) > thresh || intersection(k, b) / (b.w * b.h) > 0.7);
    if (!covered) keep.push(b);
  }
  return keep;
}

export const TILE_SIZES = [768, 384, 256];

export type RawDetection = Box & { score: number; tile: number; full: boolean };

/** Thresholds chosen on the Nakamise test photo (see docs/verification/day2.md). */
export const FACE_RULES = {
  minScore: 0.6, // on the test photo every detection >= 0.63 was a face; signs/lanterns scored 0.53–0.59
  minScoreFull: 0.7, // the full-image pass produced large false positives on signboards
  maxSizeOfTile: 0.6, // a "face" filling most of a tile is usually a sign or lantern
  aspect: [0.6, 1.7] as const,
};

/**
 * Keep plausible faces: per-scale score threshold, size relative to the tile, aspect ratio, then NMS.
 * Privacy errs toward blurring; these rules only remove boxes that are implausible as faces, and the
 * user can always add blur manually.
 */
export function selectFaces(raw: RawDetection[], rules = FACE_RULES): (Box & { score: number })[] {
  const ok = raw.filter((d) => {
    const ar = d.w / d.h;
    return (
      d.score >= (d.full ? rules.minScoreFull : rules.minScore) &&
      Math.max(d.w, d.h) <= rules.maxSizeOfTile * d.tile &&
      ar >= rules.aspect[0] &&
      ar <= rules.aspect[1]
    );
  });
  return nms(ok);
}

/** Mosaic cell size: coarse enough that a face is unrecognizable at any box size. */
export function mosaicCell(b: Box): number {
  return Math.max(8, Math.round(Math.max(b.w, b.h) / 6));
}
