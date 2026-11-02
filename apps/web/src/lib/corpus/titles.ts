import { openDb } from "./db";

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
