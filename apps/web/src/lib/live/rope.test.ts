import { describe, expect, it } from "vitest";
import { Rope } from "./rope";

const run = (r: Rope, steps: number) => {
  for (let i = 0; i < steps; i++) r.step(16);
};

describe("rope (the thread with a body)", () => {
  it("keeps its length near the rest length (6% slack) and sags under gravity", () => {
    const r = new Rope({ x: 0, y: 0 }, { x: 300, y: 0 });
    run(r, 300);
    expect(r.length()).toBeGreaterThan(300);
    expect(r.length()).toBeLessThan(300 * 1.06 * 1.03);
    expect(r.pts[7].y).toBeGreaterThan(0); // the middle hangs below the ends
  });
  it("settles and sleeps, and a pluck wakes it and decays", () => {
    const r = new Rope({ x: 0, y: 0 }, { x: 200, y: 50 });
    run(r, 600);
    expect(r.asleep).toBe(true);
    r.pluck(20);
    expect(r.asleep).toBe(false);
    r.step(16);
    const peak = Math.max(...r.pts.map((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py)));
    run(r, 400);
    const after = Math.max(...r.pts.map((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py)));
    expect(after).toBeLessThan(peak / 10);
  });
  it("cut: falls and hangs from the end still held", () => {
    const r = new Rope({ x: 0, y: 0 }, { x: 200, y: 0 });
    run(r, 100);
    r.cut();
    run(r, 800);
    const end = r.pts[r.pts.length - 1];
    expect(end).toMatchObject({ x: 200, y: 0 });
    expect(r.pts[0].y).toBeGreaterThan(150); // the loose end hangs down
    expect(Math.abs(r.pts[0].x - 200)).toBeLessThan(40);
  });
  it("follows its ends and draws a smooth path", () => {
    const r = new Rope({ x: 0, y: 0 }, { x: 100, y: 0 });
    r.setEnds({ x: 10, y: 10 }, { x: 150, y: 40 });
    run(r, 200);
    expect(r.pts[0]).toMatchObject({ x: 10, y: 10 });
    expect(r.path().startsWith("M 10.0 10.0 C")).toBe(true);
  });
});
