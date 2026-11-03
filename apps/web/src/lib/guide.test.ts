import { describe, expect, it } from "vitest";
import { guideLine, type GuideState } from "./guide";

describe("guide らぶちゃん (FR-45)", () => {
  it("has a line for every phase in both languages", () => {
    for (const phase of ["idle", "sending", "exploring", "done", "failed", "no_place"] as GuideState["phase"][])
      for (const lang of ["ja", "en"] as const) expect(guideLine({ phase }, lang).length).toBeGreaterThan(5);
  });
  it("follows the state, most cautious first", () => {
    expect(guideLine({ phase: "done", conflicts: 1, absent: 2 })).toContain("食い違う");
    expect(guideLine({ phase: "done", withheld: 1, absent: 2 })).toContain("判定保留");
    expect(guideLine({ phase: "done", absent: 2 })).toContain("推定");
    expect(guideLine({ phase: "done", visual: true })).toContain("根拠ではありません");
  });
  it("never asserts: no year, no proper noun, nothing beyond what the screen shows", () => {
    const all = (["idle", "sending", "exploring", "done", "failed", "no_place"] as const).flatMap((phase) =>
      [{ phase }, { phase, conflicts: 1 }, { phase, withheld: 1 }, { phase, absent: 1 }, { phase, visual: true }, { phase, pending: 1 }, { phase, degraded: true }].map((s) => guideLine(s)),
    );
    for (const line of all) {
      expect(line).not.toMatch(/\d{3,}/);
      expect(line).not.toMatch(/雷門|浅草|広重|バード|荷風|光雲/);
    }
  });
});
