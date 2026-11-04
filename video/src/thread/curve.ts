export type Pt = { x: number; y: number };

/**
 * The gold thread of the concept image, traced by hand in its 1672×941 pixels: out of the phone,
 * round the father and child, across, round the traveller. The opening and the title card share
 * this one curve, so the shape seen in the dark at 0:00 is the shape that lands on the image.
 */
export const CONCEPT_SIZE = { width: 1672, height: 941 };

export const CONCEPT_THREAD: Pt[] = [
  { x: 640, y: 470 },
  { x: 760, y: 420 },
  { x: 880, y: 355 },
  { x: 1000, y: 365 },
  { x: 1110, y: 345 },
  { x: 1200, y: 280 },
  { x: 1270, y: 190 },
  { x: 1275, y: 100 },
  { x: 1200, y: 30 },
  { x: 1080, y: 5 },
  { x: 950, y: 20 },
  { x: 860, y: 85 },
  { x: 835, y: 180 },
  { x: 860, y: 270 },
  { x: 950, y: 345 },
  { x: 1050, y: 375 },
  { x: 1130, y: 420 },
  { x: 1200, y: 480 },
  { x: 1290, y: 540 },
  { x: 1400, y: 565 },
  { x: 1510, y: 555 },
  { x: 1620, y: 500 },
  { x: 1660, y: 400 },
  { x: 1640, y: 260 },
  { x: 1560, y: 200 },
  { x: 1430, y: 185 },
  { x: 1300, y: 230 },
  { x: 1215, y: 330 },
  { x: 1205, y: 400 },
];

/** Catmull-Rom through the points, resampled to equal arc length. */
export const spline = (pts: Pt[], n: number): Pt[] => {
  const at = (i: number) => pts[Math.min(pts.length - 1, Math.max(0, i))];
  const dense: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < 24; k++) {
      const u = k / 24;
      const f = (p: number, q: number, r: number, s: number) =>
        0.5 * (2 * q + (r - p) * u + (2 * p - 5 * q + 4 * r - s) * u * u + (3 * q - p - 3 * r + s) * u * u * u);
      dense.push({ x: f(a.x, b.x, c.x, d.x), y: f(a.y, b.y, c.y, d.y) });
    }
  }
  dense.push(pts[pts.length - 1]);

  const lengths = [0];
  for (let i = 1; i < dense.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const want = (total * i) / (n - 1);
    while (j < dense.length - 2 && lengths[j + 1] < want) j++;
    const u = (want - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
    out.push({ x: dense[j].x + (dense[j + 1].x - dense[j].x) * u, y: dense[j].y + (dense[j + 1].y - dense[j].y) * u });
  }
  return out;
};
