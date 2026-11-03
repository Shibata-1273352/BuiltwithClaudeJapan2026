/**
 * Inference server client (REQUIREMENTS.md 4.10, 9.4.2 ASI07): localhost + shared token, responses
 * validated with zod before use. Failures degrade to the simple display (FR-34), never crash.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";

const SceneResponse = z.object({
  scene_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  elements: z.record(
    z.string(),
    z.object({ prompt: z.string(), score: z.number(), bbox: z.array(z.number()).length(4), layer: z.enum(["foreground", "midground", "background"]) }).passthrough(),
  ),
  alignment: z.object({ ok: z.boolean(), artifact: z.string().optional(), scale: z.number().optional() }).passthrough().nullable().optional(),
  timings_ms: z.record(z.string(), z.number()),
  elapsed_ms: z.number(),
});
export type SceneResponse = z.infer<typeof SceneResponse>;

export type SceneResult = { ok: true; scene: SceneResponse } | { ok: false; reason: "unavailable" | "timeout" | "invalid_response" | "error" };

const VisualResponse = z.object({
  query: z.object({ scene_id: z.string(), element: z.string(), bbox: z.array(z.number()).length(4) }),
  hits: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,64}$/),
        title: z.string().max(300),
        // used as a link in the page: https on Wikimedia Commons only (a javascript: URL passes .url())
        commons: z.string().regex(/^https:\/\/commons\.wikimedia\.org\/[^\s"'<>]+$/),
        license: z.string().max(100),
        file: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,63}\.jpg$/),
        score: z.number(),
        crop: z.string().max(16),
        box: z.array(z.number().min(0).max(1)).length(4).default([0, 0, 1, 1]),
      }),
    )
    .max(10),
  elapsed_ms: z.number(),
});
export type VisualResponse = z.infer<typeof VisualResponse>;

/** FR-58: similar prints for a scene element (e.g. the great lantern). Failure -> null (no visual layer). */
export async function requestVisual(sceneId: string, element: string, k: number, timeoutMs: number): Promise<VisualResponse | null> {
  const url = process.env.INFERENCE_URL ?? "http://127.0.0.1:8100";
  const token = process.env.INFERENCE_TOKEN;
  if (!token) return null;
  const form = new FormData();
  form.append("scene_id", sceneId);
  form.append("element", element);
  form.append("k", String(k));
  try {
    const r = await fetch(`${url}/visual-search`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const p = VisualResponse.safeParse(await r.json());
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

export async function requestScene(imagePath: string, sceneId: string, artifact: string | null, timeoutMs: number): Promise<SceneResult> {
  const url = process.env.INFERENCE_URL ?? "http://127.0.0.1:8100";
  const token = process.env.INFERENCE_TOKEN;
  if (!token) return { ok: false, reason: "unavailable" };
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(await readFile(imagePath))], { type: "image/jpeg" }), "capture.jpg");
  form.append("scene_id", sceneId);
  if (artifact) form.append("artifact", artifact);
  try {
    const r = await fetch(`${url}/scene`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { ok: false, reason: r.status >= 500 || r.status === 401 || r.status === 503 ? "unavailable" : "error" };
    const parsed = SceneResponse.safeParse(await r.json());
    return parsed.success ? { ok: true, scene: parsed.data } : { ok: false, reason: "invalid_response" };
  } catch (e) {
    const name = (e as Error).name;
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable" };
  }
}
