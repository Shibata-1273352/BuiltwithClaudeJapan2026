import { readFileSync } from "node:fs";
import path from "node:path";
import { periodsFrom, type ExistenceEvent } from "@tsumugi/core";
import { describe, expect, it } from "vitest";
import { labelRows, segments, yearState, type TimelineData } from "./time-river";

const tl = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../corpus/timeline.json"), "utf8"));
const events = (tl.existence_events as ExistenceEvent[]).filter((e) => e.entity === "ent:kaminarimon");
const d: TimelineData = {
  entity: "ent:kaminarimon",
  name: { ja: "雷門", en: "Kaminarimon" },
  periods: periodsFrom(events, "2026-11-03"),
  events,
  sources: [],
};

describe("time slider (FR-56, RAG-11)", () => {
  it("1856: the gate stands (thread intact)", () => {
    expect(yearState(d, 1856).state).toBe("present");
  });
  it("1878: the permanent gate is absent (thread breaks), with evidence to jump to", () => {
    const s = yearState(d, 1878);
    expect(s.state).toBe("absent");
    expect(s.label.ja).toBe("1878年：恒久的な雷門は焼失後まだ再建されていなかった");
    expect(s.evidence).toEqual(["ex:kaminarimon:1866-destroyed", "ex:kaminarimon:1960-rebuilt"]);
  });
  it("1905: still absent, and the temporary gate of that year is noted", () => {
    const s = yearState(d, 1905);
    expect(s).toMatchObject({ state: "absent", temporary: true });
    expect(s.label.ja).toContain("仮設の門");
  });
  it("1866: withheld (sources disagree on the fire date); 1960: unknown at year precision", () => {
    expect(yearState(d, 1866).state).toBe("withheld");
    expect(yearState(d, 1960).state).toBe("unknown");
  });
  it("1961 and 2026: the gate is back", () => {
    expect(yearState(d, 1961).state).toBe("present");
    expect(yearState(d, 2026).state).toBe("present");
  });
  it("1700: no data -> unknown, never absent", () => {
    expect(yearState(d, 1700)).toMatchObject({ state: "unknown" });
  });
});

describe("labelRows", () => {
  it("puts close labels on different rows and reuses rows when there is room", () => {
    expect(labelRows([100, 130, 400, 410, 800], 70)).toEqual([0, 1, 0, 1, 0]);
  });
});

describe("river segments (FR-23)", () => {
  it("covers the range with present / absent / unknown in order", () => {
    const s = segments(d, 1750, 2026);
    expect(s[0]).toMatchObject({ start: 1750, kind: "unknown" });
    expect(s.map((x) => x.kind)).toEqual(["unknown", "absent", "unknown", "present", "unknown", "absent", "unknown", "present"]);
    expect(s.at(-1)!.end).toBeCloseTo(2026, 0);
    for (let i = 1; i < s.length; i++) expect(s[i].start).toBeCloseTo(s[i - 1].end, 5);
  });
});
