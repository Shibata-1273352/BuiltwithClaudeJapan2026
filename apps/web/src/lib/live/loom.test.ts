import { describe, expect, it } from "vitest";
import { pitchFor, pluckSamples } from "./feel";
import { iou, loomObjects } from "./objects";

describe("loom objects (SAM 3 cut-outs ↔ what Claude read)", () => {
  const scene = {
    lantern: { bbox: [0.12, 0.3, 0.7, 0.83] as [number, number, number, number], png: "lantern.png" },
    gate: { bbox: [0, 0, 1, 1] as [number, number, number, number], png: "gate.png" },
    people: { bbox: [0, 0.8, 1, 1] as [number, number, number, number], png: "people.png" },
  };
  const see = [
    { label: "giant red paper lantern", box: { x: 0.12, y: 0.29, w: 0.59, h: 0.48 }, text_original: "風雷神門" },
    { label: "lantern date inscription", box: { x: 0.3, y: 0.31, w: 0.08, h: 0.32 }, text_original: "平成二十五年" },
  ];
  const objs = loomObjects(scene, see);
  it("matches by overlap, never offers people, keeps the rest as box objects, small ones on top", () => {
    expect(objs.at(-1)?.seeIndex).toBe(1);
    expect(objs.find((o) => o.key === "lantern")?.seeIndex).toBe(0);
    expect(objs.some((o) => o.key === "people")).toBe(false);
    expect(objs.filter((o) => o.seeIndex === 1)).toHaveLength(1);
  });
  it("works before the cut-outs arrive", () => {
    expect(loomObjects(null, see).map((o) => o.key)).toEqual(["see:0", "see:1"]); // larger first (drawn behind)
  });
  it("iou", () => {
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(1);
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 })).toBe(0);
  });
});

describe("feel: the plucked string", () => {
  it("a longer thread sounds lower, within a pleasant range", () => {
    expect(pitchFor(800)).toBeLessThan(pitchFor(200));
    expect(pitchFor(5)).toBeLessThanOrEqual(620);
    expect(pitchFor(5000)).toBeGreaterThanOrEqual(180);
  });
  it("the note decays (a string, not a beep) and is deterministic", () => {
    const a = pluckSamples(330, 44100, 1);
    const head = Math.max(...a.slice(0, 2000).map(Math.abs));
    const tail = Math.max(...a.slice(-2000).map(Math.abs));
    expect(tail).toBeLessThan(head / 3);
    expect(pluckSamples(330, 44100, 0.1)).toEqual(pluckSamples(330, 44100, 0.1));
  });
});
