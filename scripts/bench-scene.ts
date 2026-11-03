/**
 * Latency of 間 on the inference server (no Claude): /scene for one photo, timings per step.
 *   npx tsx --env-file=.env scripts/bench-scene.ts <photo.jpg> [artifact] [runs]
 */
import { requestScene } from "../apps/web/src/lib/inference";

const [file, artifact = "met-56689", runsArg] = process.argv.slice(2);
if (!file) throw new Error("usage: bench-scene.ts <photo.jpg> [artifact] [runs]");
for (let i = 0; i < Number(runsArg ?? 2); i++) {
  const t0 = Date.now();
  const r = await requestScene(file, `bench_${i}`, artifact, 60_000);
  console.log(JSON.stringify({ ms: Date.now() - t0, ok: r.ok, ...(r.ok ? { server_ms: r.scene.elapsed_ms, timings: (r.scene as { timings_ms?: unknown }).timings_ms, elements: Object.keys(r.scene.elements), aligned: Boolean(r.scene.alignment?.ok) } : { reason: r.reason }) }));
}
