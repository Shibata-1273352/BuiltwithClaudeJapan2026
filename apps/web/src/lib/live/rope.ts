/**
 * A thread with a body (Loom): a verlet rope between two pinned ends. It sags a little, swings
 * when plucked, settles and then sleeps (no work while still); cut, it falls from the end that is
 * still held. Pure and deterministic, so it is tested without a browser.
 */
export type Pt = { x: number; y: number };
type P = { x: number; y: number; px: number; py: number };

export class Rope {
  pts: P[];
  private seg: number;
  /** null = loose (after a cut) */
  pinA: Pt | null;
  pinB: Pt | null;
  asleep = false;
  private still = 0;

  constructor(a: Pt, b: Pt, { n = 14, slack = 1.06 }: { n?: number; slack?: number } = {}) {
    this.pinA = { ...a };
    this.pinB = { ...b };
    const len = Math.hypot(b.x - a.x, b.y - a.y) * slack;
    this.seg = len / (n - 1);
    this.pts = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      return { x, y, px: x, py: y };
    });
  }

  /** Move the ends (an object being dragged, a card being laid out); wakes the rope. */
  setEnds(a: Pt | null, b: Pt | null) {
    const moved = (p: Pt | null, q: Pt | null) => p && q && Math.hypot(p.x - q.x, p.y - q.y) > 0.5;
    if (a && moved(a, this.pinA)) this.wake();
    if (b && moved(b, this.pinB)) this.wake();
    if (a && this.pinA) this.pinA = { ...a };
    if (b && this.pinB) this.pinB = { ...b };
    // keep the rest length in step with the distance (layout changes), with the same slack
    if (this.pinA && this.pinB) {
      const want = (Math.hypot(this.pinB.x - this.pinA.x, this.pinB.y - this.pinA.y) * 1.06) / (this.pts.length - 1);
      if (Math.abs(want - this.seg) > 0.5) {
        this.seg = want;
        this.wake();
      }
    }
  }

  /** A pluck: push the middle sideways (strength in px). */
  pluck(strength = 14) {
    const n = this.pts.length;
    const a = this.pts[0];
    const b = this.pts[n - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 1; i < n - 1; i++) {
      const w = Math.sin((Math.PI * i) / (n - 1));
      this.pts[i].px -= nx * strength * w;
      this.pts[i].py -= ny * strength * w;
    }
    this.wake();
  }

  /** Cut: the end at A lets go, the rope falls and hangs from B. */
  cut() {
    this.pinA = null;
    this.wake();
  }

  wake() {
    this.asleep = false;
    this.still = 0;
  }

  /** One step (dt in ms, clamped). Returns false when asleep. */
  step(dt = 16, gravity = 0.35): boolean {
    if (this.asleep) return false;
    const k = Math.min(dt, 32) / 16;
    const damping = 0.965;
    let motion = 0;
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      if ((i === 0 && this.pinA) || (i === n - 1 && this.pinB)) continue;
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + gravity * k * k;
      motion += Math.abs(vx) + Math.abs(vy);
    }
    for (let pass = 0; pass < 4; pass++) {
      if (this.pinA) Object.assign(this.pts[0], this.pinA);
      if (this.pinB) Object.assign(this.pts[n - 1], this.pinB);
      for (let i = 0; i < n - 1; i++) {
        const a = this.pts[i];
        const b = this.pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = (d - this.seg) / d / 2;
        const fixedA = i === 0 && this.pinA;
        const fixedB = i + 1 === n - 1 && this.pinB;
        if (!fixedA) {
          a.x += dx * diff * (fixedB ? 2 : 1);
          a.y += dy * diff * (fixedB ? 2 : 1);
        }
        if (!fixedB) {
          b.x -= dx * diff * (fixedA ? 2 : 1);
          b.y -= dy * diff * (fixedA ? 2 : 1);
        }
      }
    }
    if (this.pinA) Object.assign(this.pts[0], this.pinA);
    if (this.pinB) Object.assign(this.pts[n - 1], this.pinB);
    this.still = motion < 0.02 * n ? this.still + 1 : 0;
    if (this.still > 20) this.asleep = true;
    return true;
  }

  /** Total length of the polyline (for tests and the plucked note's pitch). */
  length(): number {
    let s = 0;
    for (let i = 0; i < this.pts.length - 1; i++) s += Math.hypot(this.pts[i + 1].x - this.pts[i].x, this.pts[i + 1].y - this.pts[i].y);
    return s;
  }

  /** A smooth SVG path through the points (Catmull-Rom as cubic Béziers). */
  path(): string {
    const p = this.pts;
    let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[Math.min(p.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }
}
