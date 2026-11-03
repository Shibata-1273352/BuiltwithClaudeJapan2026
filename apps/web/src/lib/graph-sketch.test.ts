import { describe, expect, it } from "vitest";
import { graphSketch, loomLayout } from "./graph-sketch";

const params = {
  capture: { target: "ent:kaminarimon" },
  sources: [
    { id: "bird", title: "Unbeaten Tracks" },
    { id: "kafu", title: "日和下駄" },
    { id: "unused", title: "x" },
  ],
  evidence: [
    { id: "ev:1", source: "bird" },
    { id: "ev:2", source: "kafu" },
  ],
  claims: [
    { id: "c1", predicate: "described_as", status: "accepted" },
    { id: "c2", predicate: "existence_absent", status: "accepted" },
  ],
  supports: [
    { ev: "ev:1", claim: "c1", rel: "supports" },
    { ev: "ev:2", claim: "c2", rel: "context_only" },
  ],
  times: [{ id: "t:1878", level: "year", value: "1878" }],
  atTime: [{ claim: "c2", time: "t:1878" }],
  conflicts: [],
};

describe("the Evidence Graph sketch (what this run wrote)", () => {
  const s = graphSketch(params);
  it("keeps only what the claims reach, with counted totals", () => {
    expect(s.nodes.some((n) => n.id === "unused")).toBe(false);
    expect(s.counts).toMatchObject({ source: 2, evidence: 2, claim: 2, time: 1, entity: 1 });
    expect(s.edges.find((e) => e.from === "ev:2")?.kind).toBe("context");
    expect(s.counts.edges).toBe(s.edges.length);
  });
  it("lays it out in four columns, source to time, inside the box", () => {
    const L = loomLayout(s, 800, 400);
    expect(L.get("bird")!.x).toBeLessThan(L.get("ev:1")!.x);
    expect(L.get("ev:1")!.x).toBeLessThan(L.get("c1")!.x);
    expect(L.get("c1")!.x).toBeLessThan(L.get("t:1878")!.x);
    for (const p of L.values()) expect(p.y).toBeGreaterThanOrEqual(0);
    // the two chains do not cross: bird's evidence sits on the same side as bird
    expect(Math.sign(L.get("bird")!.y - L.get("kafu")!.y)).toBe(Math.sign(L.get("ev:1")!.y - L.get("ev:2")!.y));
  });
});
