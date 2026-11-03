import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestScene, requestVisual } from "./inference";

const img = path.join(mkdtempSync(path.join(tmpdir(), "tsumugi-inf-")), "x.jpg");
writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestVisual (FR-58, ASI07)", () => {
  const hit = { id: "edo100-1a2b3c4d", title: "Kinryūzan Temple in Asakusa", commons: "https://commons.wikimedia.org/wiki/File:x.jpg", license: "Public domain", file: "edo100-1a2b3c4d.jpg", score: 0.8, crop: "g2r0c0" };
  it("accepts a valid response", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "t");
    vi.stubGlobal("fetch", async () => Response.json({ query: { scene_id: "cap_x", element: "lantern", bbox: [0, 0, 1, 1] }, hits: [hit], elapsed_ms: 5 }));
    expect((await requestVisual("cap_x", "lantern", 5, 1000))?.hits[0].title).toBe("Kinryūzan Temple in Asakusa");
  });
  it("rejects a path-like file name or a non-URL link (would be used in the page)", async () => {
    vi.stubEnv("INFERENCE_TOKEN", "t");
    vi.stubGlobal("fetch", async () => Response.json({ query: { scene_id: "cap_x", element: "lantern", bbox: [0, 0, 1, 1] }, hits: [{ ...hit, file: "../../.env" }], elapsed_ms: 5 }));
    expect(await requestVisual("cap_x", "lantern", 5, 1000)).toBeNull();
    vi.stubGlobal("fetch", async () => Response.json({ query: { scene_id: "cap_x", element: "lantern", bbox: [0, 0, 1, 1] }, hits: [{ ...hit, commons: "javascript:alert(1)" }], elapsed_ms: 5 }));
    expect(await requestVisual("cap_x", "lantern", 5, 1000)).toBeNull();
  });
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
