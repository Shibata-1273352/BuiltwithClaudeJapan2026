/**
 * Read cached spatial assets from DATA_DIR (outside the repo). Names are whitelisted by regex
 * and the resolved path must stay inside the cache root (no traversal).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CacheKind = "scenes" | "artifacts";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FILE_RE = /^[a-z0-9][a-z0-9_.-]{0,63}\.(png|jpg|json)$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", json: "application/json" };

export function resolveCacheFile(kind: CacheKind, id: string, file: string): string | null {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir || !ID_RE.test(id) || !FILE_RE.test(file) || file.includes("..")) return null;
  const root = path.resolve(dataDir, "cache", kind);
  const p = path.resolve(root, id, file);
  return p.startsWith(root + path.sep) ? p : null;
}

export async function readCacheFile(
  kind: CacheKind,
  id: string,
  file: string,
): Promise<{ body: Buffer; type: string } | null> {
  const p = resolveCacheFile(kind, id, file);
  if (!p) return null;
  try {
    // DATA_DIR lives outside the repo and is read at runtime on purpose; exclude it from build tracing.
    return { body: await readFile(/* turbopackIgnore: true */ p), type: TYPES[path.extname(p).slice(1)] };
  } catch {
    return null;
  }
}

export async function readCacheJson<T>(kind: CacheKind, id: string, file: string): Promise<T | null> {
  const f = await readCacheFile(kind, id, file);
  if (!f) return null;
  try {
    return JSON.parse(f.body.toString("utf8")) as T;
  } catch {
    return null;
  }
}
