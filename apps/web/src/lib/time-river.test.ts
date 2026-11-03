import { readFileSync } from "node:fs";
import path from "node:path";
import { periodsFrom, type ExistenceEvent } from "@tsumugi/core";
import { describe, expect, it } from "vitest";
import { interimSince, labelRows, presentPeriodAround, segments, sinceWhen, yearState, type TimelineData } from "./time-river";

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

describe("the period a print belongs to (時をめくる shows Hiroshige only while his gate stood)", () => {
  it("1856 lies in the period that ends at the 1866 fire; 1878 lies in none", () => {
    const p = presentPeriodAround(d, 1856);
    expect(p?.to).toBe(1866);
    expect(p!.from).toBeLessThan(1856);
    expect(presentPeriodAround(d, 1878)).toBeNull();
  });
});

describe("since when? (the friend's second question, answered by code)", () => {
  it("Kaminarimon: the present gate dates from its rebuilding; the one before stood until the fire", () => {
    const w = sinceWhen(d, 2026)!;
    expect(w.since).toBe(1960);
    expect(w.how).toBe("rebuilt");
    expect(w.before).toMatchObject({ to: 1866, end: "destroyed" });
    expect(w.label.ja).toBe(`いまの雷門は1960年に再建されたもの。その前の雷門は${w.before!.from}年から1866年の焼失まで立っていた。`);
    expect(w.label.en).toContain("The present Kaminarimon dates from 1960 (rebuilt)");
  });
  it("no present period reaching today: no answer", () => {
    expect(sinceWhen({ ...d, periods: [] }, 2026)).toBeNull();
  });
});

describe("interimSince", () => {
  const ev = (id: string, event: string, start: string) => ({ id, event, time: { start, end: start }, evidence: [] }) as never;
  const d = { events: [ev("a", "built", "1795-01-01"), ev("b", "destroyed", "1866-01-28"), ev("c", "temporary", "1868-01-01"), ev("d", "temporary", "1905-01-01"), ev("e", "rebuilt", "1960-05-03")] };
  it("names the first temporary structure after the loss", () => {
    expect(interimSince(d, 1878)).toBe(1868);
    expect(interimSince(d, 1910)).toBe(1868);
  });
  it("is null before any temporary structure, or with no loss", () => {
    expect(interimSince(d, 1867)).toBeNull();
    expect(interimSince({ events: [ev("a", "built", "1795-01-01")] }, 1878)).toBeNull();
  });
});
