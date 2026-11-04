import { describe, expect, it } from "vitest";
import { layerOf } from "./thread-layer";

describe("the four threads", () => {
  it("colour is the question", () => {
    expect(layerOf("destroyed_in")).toBe("toki");
    expect(layerOf("rebuilt_in")).toBe("toki");
    expect(layerOf("named_as")).toBe("koto");
    expect(layerOf("depicts")).toBe("ma");
    expect(layerOf("describes")).toBe("ba");
    expect(layerOf("mentions")).toBe("ba");
    expect(layerOf("observed")).toBe("ba");
    expect(layerOf(undefined)).toBe("ba");
  });
});
