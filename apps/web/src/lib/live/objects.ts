/**
 * The touchable objects of the loom: SAM 3's cut-outs (lantern, gate…) matched to what Claude read
 * (see elements) by box overlap, so a guide note and its threads hang from the right object.
 * Before the cut-outs arrive, Claude's boxes stand in (no lift yet, but already touchable).
 */
export type Box01 = { x: number; y: number; w: number; h: number };
export type SceneEl = { bbox: [number, number, number, number]; png: string; layer?: string };
export type SeeEl = { label: string; box: Box01; text_original: string | null };

export type LoomObject = {
  key: string; // "lantern", "gate" … or "see:2"
  box: Box01;
  png: string | null; // the cut-out, when SAM 3 found it
  seeIndex: number | null; // Claude's element on this object
  label: string;
};

export const iou = (a: Box01, b: Box01): number => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

/** Of `b`, the share inside `a` (a small inscription inside the big lantern counts as the lantern's). */
const inside = (a: Box01, b: Box01) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return (Math.max(0, x2 - x1) * Math.max(0, y2 - y1)) / Math.max(1e-9, b.w * b.h);
};

const fromBbox = ([x1, y1, x2, y2]: [number, number, number, number]): Box01 => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

/**
 * One object per SAM 3 element (people excluded: never a touch target), each taking the see element
 * that overlaps it best (IoU, or mostly inside it). See elements left over become box-only objects.
 */
export function loomObjects(scene: Record<string, SceneEl> | null, see: SeeEl[]): LoomObject[] {
  const out: LoomObject[] = [];
  const used = new Set<number>();
  for (const [key, el] of Object.entries(scene ?? {})) {
    if (key === "people") continue;
    const box = fromBbox(el.bbox);
    let best = -1;
    let score = 0;
    see.forEach((s, i) => {
      if (used.has(i)) return;
      const v = Math.max(iou(box, s.box), inside(box, s.box) > 0.8 ? 0.5 : 0);
      if (v > score) {
        score = v;
        best = i;
      }
    });
    if (best >= 0 && score >= 0.2) used.add(best);
    out.push({ key, box, png: el.png, seeIndex: best >= 0 && score >= 0.2 ? best : null, label: best >= 0 && score >= 0.2 ? see[best].label : key });
  }
  see.forEach((s, i) => {
    if (!used.has(i)) out.push({ key: `see:${i}`, box: s.box, png: null, seeIndex: i, label: s.label });
  });
  return out;
}

export const centerOf = (b: Box01) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
