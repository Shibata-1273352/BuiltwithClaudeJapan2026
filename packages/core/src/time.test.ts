import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expand, judgeExistence, periodsFrom, timeKeys, toRange, type ExistenceEvent } from "./time";

const timeline = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "..", "corpus", "timeline.json"), "utf8"));
const events: ExistenceEvent[] = timeline.existence_events;
const periods = periodsFrom(events, "2026-11-02");
const at = (start: string, precision: "day" | "month" | "year" | "range" = "day", end?: string) =>
  judgeExistence(periods, toRange({ precision, start, end }));

describe("ranges", () => {
  it("expands partial dates by precision", () => {
    expect(expand("1878", "start")).toBe("1878-01-01");
    expect(expand("1878", "end")).toBe("1878-12-31");
    expect(expand("1896-02", "end")).toBe("1896-02-29");
    expect(toRange({ precision: "unknown", start: null })).toBeNull();
  });
});

describe("Kaminarimon existence (FR-15, RAG-05, RAG-11)", () => {
  it("is present in 1856 (Hiroshige)", () => {
    expect(at("1856", "year").value).toBe("present");
  });
  it("is absent when Bird wrote (1878-06-09)", () => {
    const j = at("1878-06-09");
    expect(j.value).toBe("absent");
    expect(j.period?.from).toEqual(["ex:kaminarimon:1866-destroyed"]); // RAG-06: go to evidence
    expect(j.period?.to).toEqual(["ex:kaminarimon:1960-rebuilt"]);
  });
  it("is absent when Kafū wrote (1914–15) — matches his 「雷門は既に焼失」", () => {
    expect(at("1914-05", "range", "1915-12").value).toBe("absent");
  });
  it("is present in 2026", () => {
    expect(at("2026-11-02").value).toBe("present");
  });
  it("is unknown on the day of the fire, where sources disagree (boundary)", () => {
    expect(at("1866-01-28")).toMatchObject({ value: "unknown", reason: "boundary" });
  });
  it("is unknown for coarse years that straddle an event", () => {
    expect(at("1866", "year").value).toBe("unknown");
    expect(at("1960", "year").value).toBe("unknown");
  });
  it("is unknown (not absent) where there is no data", () => {
    expect(at("1700", "year")).toMatchObject({ value: "unknown", reason: "no_data" });
  });
  it("temporary gates do not make the permanent gate present", () => {
    expect(at("1905", "year").value).toBe("absent");
  });
  it("is unknown without a time", () => {
    expect(judgeExistence(periods, null)).toMatchObject({ value: "unknown", reason: "no_time" });
  });
});

describe("time hierarchy keys (FR-55)", () => {
  it("maps dates to year, decade and era", () => {
    expect(timeKeys("1878-06-09")).toEqual({ year: 1878, decade: "1870s", era: "明治" });
    expect(timeKeys("1856-06-01").era).toBe("江戸");
    expect(timeKeys("1960-05-01").era).toBe("昭和");
  });
});
