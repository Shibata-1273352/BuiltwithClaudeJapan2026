import { describe, expect, it } from "vitest";
import { fitPlaces, spread, tripWeave, type WeavePlace } from "./trip-weave";

const n = (id: string, noteId: string, sources: string[], lat: number, lon: number): WeavePlace => ({ id, noteId, sources, lat, lon, name: { ja: id, en: id } });

describe("trip weave: places joined by the sources they share", () => {
  const w = tripWeave([n("asakusa", "e3", ["bird", "kafu"], 35.711, 139.796), n("ueno", "e2", ["bird", "kaneiji"], 35.722, 139.775), n("asakusa", "e1", ["koun"], 35.711, 139.796), n("azuma", "e0", ["met"], 35.71, 139.8)]);
  it("one node per place, newest note, all its sources", () => {
    expect(w.places.map((p) => p.id)).toEqual(["asakusa", "ueno", "azuma"]);
    expect(w.places[0].noteId).toBe("e3");
    expect(w.places[0].sources.sort()).toEqual(["bird", "kafu", "koun"]);
  });
  it("a thread only where a source is shared", () => {
    expect(w.threads).toEqual([{ a: "asakusa", b: "ueno", sources: ["bird"] }]);
  });
  it("fits the places inside the box", () => {
    const f = fitPlaces(w.places, 600, 300);
    for (const p of w.places) {
      const { x, y } = f(p);
      expect(x).toBeGreaterThanOrEqual(59);
      expect(x).toBeLessThanOrEqual(541);
      expect(y).toBeGreaterThanOrEqual(59);
      expect(y).toBeLessThanOrEqual(241);
    }
    const s = spread([{ x: 300, y: 150 }, { x: 301, y: 150 }, { x: 300, y: 151 }], 600, 300);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].y - s[j].y)).toBeGreaterThan(85);
    expect(f({ lat: 35.722, lon: 139.775 }).y).toBeLessThan(f({ lat: 35.711, lon: 139.796 }).y); // north is up
  });
});
