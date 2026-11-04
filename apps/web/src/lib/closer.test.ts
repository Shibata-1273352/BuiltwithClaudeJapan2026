import { describe, expect, it } from "vitest";
import { closerTargets, cropOf, extends_ } from "./closer";

const el = (text: string | null, w: number, h: number) => ({ label: "x", box: { x: 0, y: 0, w, h }, text_original: text, reading: null, meaning: { en: "", ja: "" }, confidence: 1 });

describe("寄って読む", () => {
  it("looks only at small characters, smallest first, two at most", () => {
    expect(closerTargets({ elements: [el("風雷神門", 0.6, 0.5), el(null, 0.05, 0.05), el("松下幸之助", 0.11, 0.04), el("根本中堂", 0.05, 0.05), el("松下幸之助", 0.29, 0.1)] })).toEqual([3, 2]);
  });
  it("crops round the box and stays inside the photo", () => {
    expect(cropOf({ x: 0.37, y: 0.77, w: 0.11, h: 0.04 }, 1600, 2156)).toEqual({ left: 360, top: 1423, width: 640, height: 561 });
    const edge = cropOf({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 1000, 1000);
    expect(edge.left + edge.width).toBeLessThanOrEqual(1000);
    expect(edge.top + edge.height).toBeLessThanOrEqual(1000);
  });
  it("keeps a new reading only if it extends the old one", () => {
    expect(extends_("松下幸之助", "松下電器産業株式会社 松下幸之助")).toBe(true);
    expect(extends_("松下幸之助", "松下幸之助")).toBe(false);
    expect(extends_("松下幸之助", "松下電器産業株式会社")).toBe(false);
  });
});
