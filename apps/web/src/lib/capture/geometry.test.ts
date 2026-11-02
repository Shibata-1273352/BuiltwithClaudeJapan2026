import { describe, expect, it } from "vitest";
import { boxAround, expandBox, fitWithin, iou, mosaicCell, nms, selectFaces, tiles } from "./geometry";

describe("tiles", () => {
  it("covers the image at every scale with overlap", () => {
    const W = 2048;
    const H = 1536;
    const t = tiles(W, H, [384]);
    expect(t[0]).toEqual({ x: 0, y: 0, w: W, h: H });
    const grid = t.slice(1);
    // every pixel row/column edge is covered
    expect(Math.max(...grid.map((b) => b.x + b.w))).toBe(W);
    expect(Math.max(...grid.map((b) => b.y + b.h))).toBe(H);
    expect(grid.every((b) => b.w === 384 && b.h === 384)).toBe(true);
    expect(grid[0].x + grid[0].w).toBeGreaterThan(grid[1].x); // overlap
  });
  it("skips scales larger than the image", () => {
    expect(tiles(300, 200, [384])).toHaveLength(1);
  });
});

describe("selectFaces (detections recorded from the Nakamise test photo)", () => {
  const d = (score: number, tile: number, x: number, y: number, w: number, full = false) => ({ score, tile, x, y, w, h: w, full });
  const raw = [
    d(0.94, 384, 341, 763, 75), // face
    d(0.93, 256, 346, 768, 68), // same face, other scale
    d(0.6, 256, 1332, 716, 42), // small face in the crowd
    d(0.59, 256, 353, 448, 107), // signboard しみずや
    d(0.59, 384, 669, 623, 57), // lantern
    d(0.52, 384, 1411, 1237, 59), // hand on a cane
    d(0.65, 2048, 0, 0, 1300, true), // implausible full-image box
  ];
  it("keeps faces, drops signs/lanterns/hands and oversized boxes, merges duplicates", () => {
    const kept = selectFaces(raw).map((b) => [b.x, b.y]);
    expect(kept).toEqual([
      [341, 763],
      [1332, 716],
    ]);
  });
});

describe("nms", () => {
  it("drops a large low-score box (Kaminarimon street, 0.51 of a 768 tile at 0.63) but keeps the face", () => {
    const kept = selectFaces([
      { x: 1127, y: 1311, w: 394, h: 394, score: 0.627, tile: 768, full: false },
      { x: 111, y: 1872, w: 97, h: 97, score: 0.68, tile: 384, full: false },
      { x: 119, y: 1872, w: 100, h: 100, score: 0.638, tile: 256, full: false },
    ]);
    expect(kept.map((b) => [b.x, b.y])).toEqual([[111, 1872]]);
  });
  it("merges duplicates from overlapping tiles", () => {
    const a = { x: 100, y: 100, w: 50, h: 50, score: 0.9 };
    const b = { x: 104, y: 102, w: 48, h: 50, score: 0.7 };
    const c = { x: 400, y: 100, w: 50, h: 50, score: 0.8 };
    expect(nms([b, a, c]).map((x) => x.score)).toEqual([0.9, 0.8]);
    expect(iou(a, a)).toBe(1);
  });
  it("drops a box contained in a bigger one", () => {
    const big = { x: 0, y: 0, w: 100, h: 100, score: 0.9 };
    const inner = { x: 30, y: 30, w: 30, h: 30, score: 0.8 };
    expect(nms([big, inner])).toHaveLength(1);
  });
});

describe("fitWithin", () => {
  it("downscales the long side to 2048", () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 2048, h: 1536, scale: 2048 / 4032 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600, scale: 1 });
  });
});

describe("expandBox", () => {
  it("grows around the center", () => {
    expect(expandBox({ x: 100, y: 100, w: 40, h: 40 }, 1000, 1000)).toEqual({ x: 90, y: 90, w: 60, h: 60 });
  });
  it("clamps to the image", () => {
    const b = expandBox({ x: 0, y: 980, w: 40, h: 40 }, 1000, 1000);
    expect(b.x).toBe(0);
    expect(b.y + b.h).toBeLessThanOrEqual(1000);
  });
});

describe("manual blur", () => {
  it("centers a box on the tap", () => {
    const b = boxAround(500, 500, 1000, 800);
    expect(b.x + b.w / 2).toBeCloseTo(500);
    expect(b.w).toBeCloseTo(120);
  });
  it("uses a coarse mosaic", () => {
    expect(mosaicCell({ x: 0, y: 0, w: 60, h: 60 })).toBe(10);
    expect(mosaicCell({ x: 0, y: 0, w: 10, h: 10 })).toBe(8);
  });
});
