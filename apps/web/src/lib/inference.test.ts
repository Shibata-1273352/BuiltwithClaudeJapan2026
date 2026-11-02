import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestScene } from "./inference";

const img = path.join(mkdtempSync(path.join(tmpdir(), "tsumugi-inf-")), "x.jpg");
writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestScene (FR-34 fallback, ASI07)", () => {
  it("is unavailable without a token", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "");
    expect(await requestScene(img, "cap_x", null, 1000)).toEqual({ ok: false, reason: "unavailable" });
  });
  it("rejects a malformed response", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "t");
    vi.stubGlobal("fetch", async () => Response.json({ scene_id: "../etc", elements: {}, timings_ms: {}, elapsed_ms: 1 }));
    expect(await requestScene(img, "cap_x", null, 1000)).toEqual({ ok: false, reason: "invalid_response" });
  });
  it("reports a timeout", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "t");
    vi.stubGlobal("fetch", async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    });
    expect(await requestScene(img, "cap_x", null, 1000)).toEqual({ ok: false, reason: "timeout" });
  });
  it("accepts a valid scene", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "t");
    vi.stubGlobal("fetch", async () =>
      Response.json({
        scene_id: "cap_x",
        elements: { lantern: { prompt: "lantern", score: 0.9, bbox: [0, 0, 1, 1], layer: "foreground" } },
        alignment: { ok: true, artifact: "met-56689", scale: 2 },
        timings_ms: { depth: 1 },
        elapsed_ms: 10,
      }),
    );
    const r = await requestScene(img, "cap_x", "met-56689", 1000);
    expect(r.ok && r.scene.alignment?.ok).toBe(true);
  });
});
