import { describe, expect, it } from "vitest";
import { splitAtName } from "./names-layer";

describe("splitAtName (FR-27 highlight)", () => {
  it("uses the code-point offset from the names stage", () => {
    expect(splitAtName("the great Asakusa temple, shrine", "Asakusa temple", 10)).toEqual(["the great ", "Asakusa temple", ", shrine"]);
  });
  it("counts code points, not UTF-16 units (Japanese and rare kanji)", () => {
    expect(splitAtName("𠮷田の浅草観音堂のほとり", "観音堂", 5)).toEqual(["𠮷田の浅草", "観音堂", "のほとり"]);
  });
  it("falls back to the first match when the offset does not fit, or leaves the sentence whole", () => {
    expect(splitAtName("雷門は既に焼失せてしまった", "雷門", 7)).toEqual(["", "雷門", "は既に焼失せてしまった"]);
    expect(splitAtName("no match here", "雷門")).toEqual(["no match here", "", ""]);
  });
});
