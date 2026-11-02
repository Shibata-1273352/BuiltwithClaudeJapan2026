import { readFileSync } from "node:fs";
import path from "node:path";
import { Entities, EntityDictionary } from "@tsumugi/core";
import { describe, expect, it } from "vitest";
import { existenceThreads, type ExistenceRow } from "./threads";

const E = new Entities(
  EntityDictionary.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../../corpus/entities.json"), "utf8"))),
);
const row = (over: Partial<ExistenceRow>): ExistenceRow => ({
  source: "s",
  sourceTitle: "Book",
  time: { kind: "written_at", start: "1878" },
  value: "absent",
  reason: "inside_absent",
  timeEvidence: ["s:0:0"],
  relation: { kind: "written_period", entity: "ent:kaminarimon", evidence: [] },
  ...over,
});

describe("existence thread wording (4.5.2) follows the chronology's events", () => {
  it("Kaminarimon: permanent gate not yet rebuilt after the fire (temporary gates existed)", () => {
    const events = [
      { id: "ex:k:1866", event: "destroyed", time: { start: "1866-01-28" } },
      { id: "ex:k:1868t", event: "temporary", time: { start: "1868-01-01" } },
      { id: "ex:k:1960", event: "rebuilt", time: { start: "1960-05-01" } },
    ];
    const [t] = existenceThreads([row({ period: { state: "absent", start: "1866-01-31", end: "1960-04-30", from: ["ex:k:1866"], to: ["ex:k:1960"] } })], E, "ent:kaminarimon", events);
    expect(t.label.ja).toContain("恒久的な雷門は焼失後まだ再建されていなかった");
    expect(t.label.ja).toContain("雷門の年表との照合");
    expect(t.state).toBe("absent");
  });
  it("a structure moved here later: not yet moved here, no 'permanent', no 'fire'", () => {
    const events = [{ id: "ex:h:1879", event: "moved_in", time: { start: "1879-01-01" } }];
    const [t] = existenceThreads([row({ period: { state: "absent", start: "0001-01-01", end: "1878-12-31", from: [], to: ["ex:h:1879"] } })], E, "ent:kaminarimon", events);
    expect(t.label.ja).toContain("まだここに移されていなかった（1879年に移築）");
    expect(t.label.en).toContain("had not yet been moved here");
    expect(t.label.ja).not.toMatch(/恒久的|焼失/);
  });
  it("before the first construction: not yet built", () => {
    const events = [{ id: "ex:b:1774", event: "built", time: { start: "1774-01-01" } }];
    const [t] = existenceThreads([row({ time: { kind: "written_at", start: "1700" }, period: { state: "absent", start: "0001-01-01", end: "1773-12-31", from: [], to: ["ex:b:1774"] } })], E, "ent:kaminarimon", events);
    expect(t.label.ja).toContain("まだ建てられていなかった（1774年に建造）");
  });
  it("an observed neighbouring site is named as such", () => {
    const [t] = existenceThreads([row({ value: "present", reason: "inside_present", relation: { kind: "observed_site", entity: "ent:sensoji", evidence: [] } })], E, "ent:kaminarimon");
    expect(t.label.ja).toContain("書き手が観察したのは浅草寺（雷門ではない）");
  });
});
