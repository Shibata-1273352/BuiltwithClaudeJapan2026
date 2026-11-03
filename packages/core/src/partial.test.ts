import { describe, expect, it } from "vitest";
import { completedArrayItems } from "./partial";

describe("completedArrayItems (streamed JSON)", () => {
  it("returns only the objects that are complete", () => {
    expect(completedArrayItems('{"elements":[{"a":1},{"b":', "elements")).toEqual([{ a: 1 }]);
    expect(completedArrayItems('{"elements":[', "elements")).toEqual([]);
    expect(completedArrayItems('{"places":[]', "elements")).toEqual([]);
  });
  it("respects strings with braces, quotes and escapes", () => {
    const s = '{"elements":[{"t":"風雷神門 {x} \\"q\\"","box":{"x":0.1}},{"t":"}"}],"places":[{"z":1}]}';
    expect(completedArrayItems(s, "elements")).toEqual([{ t: '風雷神門 {x} "q"', box: { x: 0.1 } }, { t: "}" }]);
  });
  it("stops at the end of the array (does not read the next key)", () => {
    expect(completedArrayItems('{"elements":[{"a":1}],"places":[{"b":2}]}', "elements")).toEqual([{ a: 1 }]);
  });
});
