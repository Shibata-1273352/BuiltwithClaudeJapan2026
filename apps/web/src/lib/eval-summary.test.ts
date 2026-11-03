import { describe, expect, it } from "vitest";
import { evalSummary } from "./eval-summary";

describe("eval summary (same figures as evaluation/results/2026-11-03.md)", () => {
  const e = evalSummary();
  it("time ablation: 100% / 0 with the time range, 41% / 6 by publication date", () => {
    expect(e.existence.n).toBe(17);
    expect(e.existence.withTime).toBe(1);
    expect(e.existence.misbindWith).toBe(0);
    expect(Math.round(e.existence.byPublication * 100)).toBe(41);
    expect(e.existence.misbindPublication).toBe(6);
  });
  it("citations, generation, batch", () => {
    expect(e.citation).toMatchObject({ n: 44, exact: 1, fabricated: 4, rejected: 4 });
    expect(e.generation).toEqual({ sentences: 20, caught: 1, shown: 0 });
    expect(e.batch.requests).toBe(23);
  });
});
