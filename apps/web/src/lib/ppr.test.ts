import { describe, expect, it } from "vitest";
import { personalizedPageRank, shortestPath, type Edge } from "./ppr";

// seed — a — b — c (chain) and seed — d (leaf); x is disconnected
const E: Edge[] = [
  { a: "seed", b: "a", w: 1 },
  { a: "a", b: "b", w: 1 },
  { a: "b", b: "c", w: 1 },
  { a: "seed", b: "d", w: 1 },
  { a: "x", b: "y", w: 1 },
];

describe("personalized PageRank", () => {
  const { rank, iterations } = personalizedPageRank(E, "seed");
  it("sums to 1 and converges", () => {
    const sum = [...rank.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(iterations).toBeLessThanOrEqual(50);
  });
  it("ranks nearer nodes higher; unreachable nodes get nothing", () => {
    expect(rank.get("a")!).toBeGreaterThan(rank.get("b")!);
    expect(rank.get("b")!).toBeGreaterThan(rank.get("c")!);
    expect(rank.get("x") ?? 0).toBe(0);
  });
  it("edge weight matters", () => {
    const r = personalizedPageRank([...E, { a: "seed", b: "c", w: 5 }], "seed").rank;
    expect(r.get("c")!).toBeGreaterThan(r.get("b")!);
  });
  it("a seed outside the graph keeps all the mass", () => {
    expect(personalizedPageRank(E, "nowhere").rank.get("nowhere")).toBe(1);
  });
});

describe("shortest path", () => {
  it("rebuilds the hops from the seed", () => {
    expect(shortestPath(E, "seed", "c")).toEqual(["seed", "a", "b", "c"]);
    expect(shortestPath(E, "seed", "x")).toBeNull();
  });
});
