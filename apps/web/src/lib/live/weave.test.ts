import { describe, expect, it } from "vitest";
import { inFlight, leftBy, weaveOf } from "./weave";

const at = (ms: number) => new Date(1_000_000 + ms).toISOString();
const call = (ms: number, elapsedMs: number) => ({ stage: "extract", model: "m", served: "m", startedAt: at(ms), elapsedMs, costUsd: 0, seq: 1 });

describe("weaveOf", () => {
  it("counts calls in flight from their own timestamps", () => {
    const w = weaveOf({ calls: [call(0, 5000), call(1000, 2000)], started: [], stages: {} });
    expect(inFlight(w, 0.5)).toBe(1);
    expect(inFlight(w, 2)).toBe(2);
    expect(inFlight(w, 4)).toBe(1);
    expect(inFlight(w, 6)).toBe(0);
    expect(leftBy(w, 6)).toBe(2);
  });
  it("a call that has left stays open until its record arrives, and is not counted twice after", () => {
    const left = { stage: "gap", startedAt: at(1000) };
    const open = weaveOf({ calls: [call(0, 500)], started: [left], stages: {} });
    expect(inFlight(open, 90)).toBe(1);
    const closed = weaveOf({ calls: [call(0, 500), call(1000, 500)], started: [left], stages: {} });
    expect(closed.spans).toHaveLength(2);
    expect(inFlight(closed, 90)).toBe(0);
  });
  it("a recording made before calls were announced still weaves, from the records alone", () => {
    expect(weaveOf({ calls: [call(0, 1000)], started: [], stages: {} }).spans).toEqual([{ start: 0, end: 1 }]);
  });
  it("says when the spatial stage failed", () => {
    expect(weaveOf({ calls: [], started: [], stages: { space: { started: 0, done: 1, ms: 32 } }, space: { ok: false } }).space).toEqual({ end: 0.032, ok: false });
  });
});
