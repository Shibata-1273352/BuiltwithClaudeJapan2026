import { describe, expect, it } from "vitest";
import { landingFacts } from "./landing-facts";

describe("landing facts are computed, not typed", () => {
  const f = landingFacts();
  it("carries no evaluation figures (evaluation stays out of the app)", () => {
    expect(Object.keys(f).some((k) => /eval|citation|fabricat|rejected/i.test(k))).toBe(false);
  });
  it("the places with a reviewed timeline include Kaminarimon; the corpus is bilingual", () => {
    expect(f.places.map((p) => p.ja)).toContain("浅草寺の雷門");
    expect(new Set(f.places.map((p) => p.ja)).size).toBe(f.places.length);
    expect(f.places.map((p) => p.ja)).toContain("寛永寺の根本中堂");
    expect(f.places.some((p) => p.ja.includes("旧"))).toBe(false);
    expect(f.printYear).toBe(1856);
    expect(f.places.length).toBeGreaterThanOrEqual(3);
    expect(f.languages).toBe(2);
    expect(f.sources).toBeGreaterThan(10);
  });
});
