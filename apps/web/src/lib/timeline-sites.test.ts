/** 13.2: the time layer works at two more sites (Ueno 根本中堂, Azuma Bridge) with per-site source times. */
import { describe, expect, it } from "vitest";
import { existenceFor, sourceRelation, sourceSaw, timelineData } from "./timeline-server";

describe("Ueno: the present Konpon Chūdō was moved here in 1879", () => {
  it("Kōun at the battle of Ueno (1868-07-04, NAOJ) and Bird (1878): not yet moved here", () => {
    expect(existenceFor("ent:konponchudo", "koun-kaiko")).toMatchObject({ value: "absent", time: { start: "1868-07-04" } });
    expect(existenceFor("ent:konponchudo", "bird-unbeaten").value).toBe("absent");
  });
  it("Kafū (1914–15): present", () => {
    expect(existenceFor("ent:konponchudo", "kafu-hiyorigeta").value).toBe("present");
  });
  it("the former hall burned on the day Kōun recalls: withheld, not absent", () => {
    expect(existenceFor("ent:konponchudo-old", "koun-kaiko")).toMatchObject({ value: "unknown", reason: "boundary" });
    expect(existenceFor("ent:konponchudo-old", "met-56689").value).toBe("present"); // 1856
  });
  it("Kōun's relation is hearsay about the former hall, and differs from his Kaminarimon one", () => {
    expect(sourceRelation("koun-kaiko", "ent:konponchudo")).toMatchObject({ kind: "eyewitness_event", entity: "ent:konponchudo-old" });
    expect(existenceFor("ent:kaminarimon", "koun-kaiko")).toMatchObject({ value: "unknown", reason: "sources_disagree", time: { start: "1866-01-30" } });
  });
});

describe("reviewed changes to Ueno and the record of who saw what", () => {
  it("the hall's life in Kawagoe does not put it at Ueno before 1879", () => {
    const data = timelineData("ent:konponchudo", undefined, (s) => s);
    expect(data.events.map((e) => e.event)).toEqual(["built_elsewhere", "moved_in"]);
    expect(data.periods[0]).toMatchObject({ state: "absent", to: ["ex:konponchudo:1879-moved_in"] });
    expect(existenceFor("ent:konponchudo", "met-56689").value).toBe("absent");
  });
  it("the day of the fire is recorded as inferred", () => {
    expect(timelineData("ent:konponchudo-old", undefined, (s) => s).events.find((e) => e.event === "destroyed")?.date_precision).toBe("inferred_day");
  });
  it("Kōun is not on record as seeing Azuma Bridge; he is as an eyewitness of the Kaminarimon fire, and Bird of the bridge", () => {
    expect(sourceSaw("koun-kaiko", "ent:azumabashi")).toBe(false);
    expect(sourceSaw("koun-kaiko", "ent:kaminarimon")).toBe(true);
    expect(sourceSaw("bird-unbeaten", "ent:azumabashi")).toBe(true);
    expect(sourceSaw("koun-kaiko", "ent:unknown")).toBeNull();
  });
});

describe("Azuma Bridge: built 1774, iron 1887, present bridge 1930/1931 (unresolved)", () => {
  it("present for Kiyonaga (ca. 1785), Hiroshige (1857), Kōun (1868), Bird (1878), Kafū (1914)", () => {
    for (const s of ["met-45257", "met-37282", "koun-kaiko", "bird-unbeaten", "kafu-hiyorigeta"]) expect(existenceFor("ent:azumabashi", s).value, s).toBe("present");
  });
  it("the 1887 print falls inside the rebuilding year: withheld", () => {
    expect(existenceFor("ent:azumabashi", "met-37387")).toMatchObject({ value: "unknown", reason: "boundary" });
  });
  it("is not marked as reviewed by the Kaminarimon review", () => {
    expect(timelineData("ent:azumabashi", undefined, (s) => s).reviewed).toBeNull();
    expect(timelineData("ent:kaminarimon", undefined, (s) => s).reviewed?.by).toContain("Shibata");
  });
});
