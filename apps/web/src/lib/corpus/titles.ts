import type { SourceMeta } from "../note";
import { openDb } from "./db";

let meta: Map<string, SourceMeta> | undefined;

/** Source id -> bibliographic metadata for the 切符 (read-only, cached per process). */
export function sourceMeta(): Map<string, SourceMeta> {
  if (meta) return meta;
  const db = openDb({ readonly: true });
  try {
    const rows = db.prepare("SELECT id, type, lang, title, author, first_published, edition, url, provider, license FROM sources").all() as SourceMeta[];
    meta = new Map(rows.map((r) => [r.id, r]));
    return meta;
  } finally {
    db.close();
  }
}

let cached: Map<string, string> | undefined;

/** Source id -> title (read-only, cached per process). */
export function sourceTitles(): Map<string, string> {
  if (cached) return cached;
  const db = openDb({ readonly: true });
  try {
    cached = new Map((db.prepare("SELECT id, title FROM sources").all() as { id: string; title: string }[]).map((r) => [r.id, r.title]));
    return cached;
  } finally {
    db.close();
  }
}
