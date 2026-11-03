import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { km, project, worldPoints, type SourcePlace } from "./world";

const corpus = (f: string) => JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../corpus", f), "utf8"));
const places = corpus("places.json").places as Record<string, SourcePlace[]>;
const sources = corpus("sources.json").sources as { id: string }[];

describe("world (FR-25): where the threads come from", () => {
  it("every source has a place, with a basis and valid coordinates", () => {
    for (const s of sources) {
      expect(places[s.id], s.id).toBeDefined();
      for (const p of places[s.id]) {
        expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
        expect(p.basis.length).toBeGreaterThan(5);
        expect(["held", "origin", "publisher"]).toContain(p.role);
      }
    }
    expect(Object.keys(places).filter((id) => !sources.some((s) => s.id === id))).toEqual([]);
  });
  it("distance is a great circle (Tokyo–New York ≈ 10,850 km)", () => {
    expect(km({ lat: 35.71, lon: 139.8 }, { lat: 40.78, lon: -73.96 })).toBeGreaterThan(10_700);
    expect(km({ lat: 35.71, lon: 139.8 }, { lat: 40.78, lon: -73.96 })).toBeLessThan(11_000);
  });
  it("far places first; the Pacific in the middle", () => {
    const pts = worldPoints(["kafu-hiyorigeta", "bird-unbeaten", "met-56689"], places, { lat: 35.7111, lon: 139.7963 });
    expect(pts[0].sourceId).toBe("met-56689");
    expect(pts.at(-1)?.km).toBeLessThan(20);
    const tokyo = project({ lat: 35.7, lon: 139.8 }, 360, 180).x;
    const ny = project({ lat: 40.8, lon: -74 }, 360, 180).x;
    const uk = project({ lat: 54, lon: -1.4 }, 360, 180).x;
    expect(uk).toBeLessThan(tokyo);
    expect(tokyo).toBeLessThan(ny);
  });
});
