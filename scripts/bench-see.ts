/**
 * Latency of the see call (real Claude, ~$0.05 per run): total time, output tokens, time to the
 * first thinking summary and to the first completed element, and what was read.
 *   SEE_EFFORT=low CLAUDE_FAST=0 npx tsx --env-file=.env scripts/bench-see.ts <photo.jpg> [runs]
 */
import { readFileSync } from "node:fs";
import { seePhoto } from "../apps/web/src/lib/see";

const [file, runsArg] = process.argv.slice(2);
if (!file) throw new Error("usage: bench-see.ts <photo.jpg> [runs]");
const runs = Number(runsArg ?? 1);
const base64 = readFileSync(file).toString("base64");
for (let i = 0; i < runs; i++) {
  const t0 = Date.now();
  let firstThinking = 0;
  let firstElement = 0;
  const r = await seePhoto({ base64, mediaType: "image/jpeg" }, (p) => {
    if (!firstThinking && p.thinking) firstThinking = Date.now() - t0;
    if (!firstElement && p.elements.length) firstElement = Date.now() - t0;
  });
  const v = r.validation;
  console.log(
    JSON.stringify({
      effort: process.env.SEE_EFFORT ?? "medium",
      fast: process.env.CLAUDE_FAST === "1",
      ms: r.record.elapsedMs,
      firstThinkingMs: firstThinking,
      firstElementMs: firstElement,
      out: r.record.usage.output,
      cost: r.record.costUsd,
      ok: v.ok,
      place: v.ok ? v.value.places[0]?.hierarchy.map((h) => h.name_ja).join(" > ") : v.errors,
      texts: v.ok ? v.value.elements.filter((e) => e.text_original).map((e) => e.text_original) : [],
    }),
  );
}
