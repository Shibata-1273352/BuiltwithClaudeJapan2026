import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const corpus = (f: string) => JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../corpus", f), "utf8"));
const regions = corpus("print-regions.json").prints as Record<string, { regions: Record<string, { boxes: number[][]; where: { ja: string; en: string } }> }>;
const entities = new Set((corpus("entities.json").entities as { id: string }[]).map((e) => e.id));
const sources = new Set((corpus("sources.json").sources as { id: string }[]).map((s) => s.id));

describe("print regions (言の地層: names land on what they name)", () => {
  it("every print is a source, every region an entity of the dictionary, every box inside the image", () => {
    for (const [print, p] of Object.entries(regions)) {
      expect(sources.has(print), print).toBe(true);
      for (const [ent, r] of Object.entries(p.regions)) {
        expect(entities.has(ent), ent).toBe(true);
        expect(r.where.ja && r.where.en).toBeTruthy();
        for (const [x1, y1, x2, y2] of r.boxes) {
          expect(0 <= x1 && x1 < x2 && x2 <= 1 && 0 <= y1 && y1 < y2 && y2 <= 1).toBe(true);
        }
      }
    }
  });
  it("Bird's gate is not Kaminarimon: the two are different regions of the print", () => {
    const r = regions["met-56689"].regions;
    expect(r["ent:hozomon"].boxes[0]).not.toEqual(r["ent:kaminarimon"].boxes[0]);
    expect(r["ent:hozomon"].boxes[0][1]).toBeGreaterThan(r["ent:kaminarimon"].boxes[0][3]); // deeper in the picture
  });
});
