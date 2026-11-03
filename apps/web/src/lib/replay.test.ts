import { describe, expect, it } from "vitest";
import { replaySchedule } from "./replay";

const ev = (seq: number, ts: string) => ({ seq, ts });

describe("replaySchedule (FR-47)", () => {
  const events = [ev(1, "2026-11-03T10:00:00.000Z"), ev(2, "2026-11-03T10:00:00.500Z"), ev(3, "2026-11-03T10:00:15.500Z"), ev(4, "2026-11-03T10:00:16.000Z")];
  it("keeps the original gaps, shortening long waits", () => {
    expect(replaySchedule(events).map((s) => s.at)).toEqual([0, 500, 4500, 5000]);
  });
  it("speed scales the gaps; order and events are unchanged", () => {
    const s = replaySchedule(events, { speed: 2 });
    expect(s.map((x) => x.at)).toEqual([0, 250, 2250, 2500]);
    expect(s.map((x) => x.event.seq)).toEqual([1, 2, 3, 4]);
  });
  it("never goes backwards on clock skew", () => {
    expect(replaySchedule([ev(1, "2026-11-03T10:00:01Z"), ev(2, "2026-11-03T10:00:00Z")]).map((s) => s.at)).toEqual([0, 0]);
  });
});
