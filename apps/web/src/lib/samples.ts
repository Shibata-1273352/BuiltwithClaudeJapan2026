/**
 * "例で試す": the allowlisted public-domain / CC0 sample photos (corpus/samples.json) that may start
 * an exploration without an upload, or be shown on the stage. Only names in this list are served.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../../../../corpus/samples.json";

/** Photos that may start a live run (faces already masked in the CC0 original). */
export const TRY_SAMPLES = new Set(["kaminarimon_cc0.jpg"]);
const KNOWN = new Set((manifest as { items: { file: string }[] }).items.map((i) => i.file));

export function isServableSample(name: string): boolean {
  return /^[a-z0-9_]+\.jpg$/.test(name) && KNOWN.has(name);
}

export async function readSample(name: string): Promise<Buffer | null> {
  if (!isServableSample(name)) return null;
  try {
    const p = path.join(process.env.DATA_DIR ?? "", "samples", name);
    return await readFile(/* turbopackIgnore: true */ p);
  } catch {
    return null;
  }
}
