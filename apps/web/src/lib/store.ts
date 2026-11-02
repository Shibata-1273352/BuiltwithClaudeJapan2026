/**
 * App runtime store (captures, explorations, events, AI call log) in $DATA_DIR/tsumugi.db.
 * Separate writable connection from the read-only corpus search connection (WAL allows both).
 */
import Database from "better-sqlite3";
import path from "node:path";
import type { DB } from "./corpus/db";

let db: DB | undefined;

export function store(): DB {
  if (db) return db;
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) throw new Error("DATA_DIR not set");
  db = new Database(path.join(dataDir, "tsumugi.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");
  migrateApp(db);
  return db;
}

export function migrateApp(d: DB): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      image_path TEXT NOT NULL,
      image_sha256 TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      ui_lang TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delete_after TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS captures_session ON captures(session_id);
    CREATE TABLE IF NOT EXISTS explorations (
      id TEXT PRIMARY KEY,
      capture_id TEXT NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running','done','failed','deadline')),
      created_at TEXT NOT NULL,
      finished_at TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      result_json TEXT
    );
    CREATE INDEX IF NOT EXISTS explorations_created ON explorations(created_at);
    CREATE TABLE IF NOT EXISTS events (
      exploration_id TEXT NOT NULL REFERENCES explorations(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      ts TEXT NOT NULL,
      PRIMARY KEY (exploration_id, seq)
    );
    CREATE TABLE IF NOT EXISTS ai_calls (
      exploration_id TEXT NOT NULL REFERENCES explorations(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      record_json TEXT NOT NULL,
      cost_usd REAL NOT NULL,
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS narratives (
      exploration_id TEXT NOT NULL REFERENCES explorations(id) ON DELETE CASCADE,
      lang TEXT NOT NULL CHECK (lang IN ('ja','en')),
      json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (exploration_id, lang)
    );
  `);
}

export const CAPTURE_TTL_DAYS = 7; // FR-51
