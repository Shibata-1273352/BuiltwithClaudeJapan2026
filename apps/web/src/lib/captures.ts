/**
 * Capture storage (FR-01..05, FR-51). Images live outside the repo under $DATA_DIR/captures,
 * named by server-issued IDs (never the uploaded file name).
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkAndStripJpeg } from "./jpeg";
import { CAPTURE_TTL_DAYS, store } from "./store";

export type CaptureRow = {
  id: string;
  session_id: string;
  image_path: string;
  width: number;
  height: number;
  lat: number | null;
  lon: number | null;
  ui_lang: string;
  created_at: string;
};

function capturesDir(): string {
  const d = process.env.DATA_DIR;
  if (!d) throw new Error("DATA_DIR not set");
  return path.join(d, "captures");
}

export function parseLocation(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  if (lat == null || lon == null || lat === "" || lon === "") return null;
  const a = Number(lat);
  const o = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(o) || Math.abs(a) > 90 || Math.abs(o) > 180) return null;
  // ~11 m precision is enough to choose a place; do not keep more.
  return { lat: Math.round(a * 1e4) / 1e4, lon: Math.round(o * 1e4) / 1e4 };
}

export async function saveCapture(input: {
  bytes: Uint8Array;
  sessionId: string;
  lat?: unknown;
  lon?: unknown;
  uiLang?: unknown;
}): Promise<CaptureRow> {
  const jpeg = checkAndStripJpeg(input.bytes);
  const id = `cap_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const dir = capturesDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.jpg`);
  await writeFile(file, jpeg.bytes, { mode: 0o600 });
  const now = new Date();
  const loc = parseLocation(input.lat, input.lon);
  const row: CaptureRow = {
    id,
    session_id: input.sessionId,
    image_path: file,
    width: jpeg.width,
    height: jpeg.height,
    lat: loc?.lat ?? null,
    lon: loc?.lon ?? null,
    ui_lang: input.uiLang === "en" ? "en" : "ja",
    created_at: now.toISOString(),
  };
  store()
    .prepare(
      `INSERT INTO captures (id, session_id, image_path, image_sha256, width, height, lat, lon, ui_lang, created_at, delete_after)
       VALUES (@id, @session_id, @image_path, @sha, @width, @height, @lat, @lon, @ui_lang, @created_at, @delete_after)`,
    )
    .run({
      ...row,
      sha: createHash("sha256").update(jpeg.bytes).digest("hex"),
      delete_after: new Date(now.getTime() + CAPTURE_TTL_DAYS * 86400_000).toISOString(),
    });
  return row;
}

export function getCapture(id: string, sessionId: string): CaptureRow | null {
  const r = store().prepare("SELECT * FROM captures WHERE id = ? AND session_id = ?").get(id, sessionId) as CaptureRow | undefined;
  return r ?? null;
}

/** FR-51: delete expired captures (rows and files). Returns the number removed. */
export async function purgeExpired(now = new Date()): Promise<number> {
  const db = store();
  const rows = db.prepare("SELECT id, image_path FROM captures WHERE delete_after <= ?").all(now.toISOString()) as {
    id: string;
    image_path: string;
  }[];
  for (const r of rows) {
    await rm(r.image_path, { force: true });
    db.prepare("DELETE FROM captures WHERE id = ?").run(r.id);
  }
  // Orphan files (e.g. a crash between write and insert) older than the TTL.
  const dir = capturesDir();
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    const p = path.join(dir, f);
    const s = await stat(p).catch(() => null);
    const known = db.prepare("SELECT 1 FROM captures WHERE image_path = ?").get(p);
    if (s && !known && now.getTime() - s.mtimeMs > CAPTURE_TTL_DAYS * 86400_000) await rm(p, { force: true });
  }
  return rows.length;
}
