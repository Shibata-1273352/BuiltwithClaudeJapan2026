/**
 * Fetch on-device model assets into apps/web/public (not committed; served same-origin for the CSP).
 *   npm run setup:web-assets
 * - MediaPipe Face Detector WASM (copied from node_modules/@mediapipe/tasks-vision, Apache-2.0)
 * - BlazeFace short-range model (Apache-2.0 per its model card). The Tasks FaceDetector does not
 *   accept the full-range model, so distant faces are handled by tiled detection in the app.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "..", "apps", "web", "public");
const wasmSrc = path.join(here, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDst = path.join(pub, "mediapipe");
mkdirSync(wasmDst, { recursive: true });
for (const f of readdirSync(wasmSrc)) copyFileSync(path.join(wasmSrc, f), path.join(wasmDst, f));
console.log(`wasm -> ${wasmDst}`);

const MODEL = {
  url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
  file: "blaze_face_short_range.tflite",
};
const modelDir = path.join(pub, "models");
mkdirSync(modelDir, { recursive: true });
const dst = path.join(modelDir, MODEL.file);
if (!existsSync(dst)) {
  const r = await fetch(MODEL.url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`model download failed: ${r.status}`);
  writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
}
const sha = createHash("sha256").update(readFileSync(dst)).digest("hex");
console.log(`model -> ${dst} (sha256 ${sha})`);
