/**
 * The Met check (REQUIREMENTS.md 8, 14): try the endpoints named in the requirements and
 * the documented v1 path, record which respond, and save the object record as a fixture.
 *   npm run met -- 56689
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const id = Number(process.argv[2] ?? 56689);
if (!Number.isInteger(id) || id <= 0) throw new Error("usage: npm run met -- <objectID>");

const BASE = "https://collectionapi.metmuseum.org/public/collection";
const probes = {
  "v1.1/search": `${BASE}/v1.1/search?q=${encodeURIComponent("Kinryūsan Asakusa")}&hasImages=true`,
  "v1/search": `${BASE}/v1/search?q=${encodeURIComponent("Kinryūsan Asakusa")}&hasImages=true`,
  "v1.1/objects": `${BASE}/v1.1/objects/${id}`,
  "v1/objects": `${BASE}/v1/objects/${id}`,
};

async function probe(url: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "TSUMUGI/0.1" } });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: r.status, ms: Date.now() - t0, json };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, json: null, error: String(e) };
  }
}

const results: Record<string, { status: number; ms: number; summary?: unknown; error?: string }> = {};
let record: Record<string, unknown> | null = null;
for (const [name, url] of Object.entries(probes)) {
  const r = await probe(url);
  const j = r.json as Record<string, unknown> | null;
  results[name] = {
    status: r.status,
    ms: r.ms,
    ...(r.error ? { error: r.error } : {}),
    summary: name.includes("search")
      ? { total: j?.total, includes: Array.isArray(j?.objectIDs) ? (j.objectIDs as number[]).includes(id) : false }
      : j?.objectID
        ? { title: j.title, artist: j.artistDisplayName, date: j.objectDate, isPublicDomain: j.isPublicDomain }
        : undefined,
  };
  if (!record && name.includes("objects") && r.status === 200 && j?.objectID === id) record = j;
}

console.log(JSON.stringify(results, null, 2));
if (!record) throw new Error("no objects endpoint returned the record");

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "fixtures", "met");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record, null, 2) + "\n");
writeFileSync(
  path.join(dir, `${id}.probe.json`),
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + "\n",
);
console.error(`saved fixtures/met/${id}.json`);
