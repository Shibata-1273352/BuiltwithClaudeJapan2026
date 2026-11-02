import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCacheFile } from "./data-files";

describe("resolveCacheFile", () => {
  const prev = process.env.DATA_DIR;
  beforeEach(() => {
    process.env.DATA_DIR = "/tmp/tsumugi-test-data";
  });
  afterEach(() => {
    process.env.DATA_DIR = prev;
  });

  it("resolves whitelisted names inside the cache", () => {
    expect(resolveCacheFile("scenes", "kaminarimon_cc0", "lantern.png")).toBe(
      "/tmp/tsumugi-test-data/cache/scenes/kaminarimon_cc0/lantern.png",
    );
  });

  it.each([
    ["..", "x.png"],
    ["a/b", "x.png"],
    ["ok", "../secret.png"],
    ["ok", "x.svg"],
    ["ok", "x.png/../../.env.json"],
    ["ok", ".env"],
    ["Upper", "x.png"],
  ])("rejects id=%s file=%s", (id, file) => {
    expect(resolveCacheFile("scenes", id, file)).toBeNull();
  });

  it("fails closed without DATA_DIR", () => {
    delete process.env.DATA_DIR;
    expect(resolveCacheFile("scenes", "ok", "x.png")).toBeNull();
  });
});
