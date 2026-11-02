/**
 * SQLite store for canonical text, normalized search columns and FTS5 indexes (REQUIREMENTS.md 4.4.8).
 * Location: $DATA_DIR/tsumugi.db (outside the repo).
 */
import Database from "better-sqlite3";
import path from "node:path";

export type DB = Database.Database;

/** Writable by default (ingestion). The app opens it read-only: search tools never write (ASI02). */
export function openDb(opts: { file?: string; readonly?: boolean } = {}): DB {
  const dataDir = process.env.DATA_DIR;
  const p = opts.file ?? (dataDir ? path.join(dataDir, "tsumugi.db") : null);
  if (!p) throw new Error("DATA_DIR is not set");
  const db = new Database(p, { readonly: Boolean(opts.readonly), fileMustExist: Boolean(opts.readonly) });
  if (!opts.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

export function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('book','museum_record','official_record')),
      lang TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      first_published INTEGER,
      edition TEXT,
      edition_year TEXT,
      url TEXT,
      provider TEXT,
      license TEXT,
      retrieved_at TEXT NOT NULL,
      version_hash TEXT NOT NULL,
      meta_json TEXT
    );
    CREATE TABLE IF NOT EXISTS chapters (
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('front','body','index')),
      PRIMARY KEY (source_id, idx)
    );
    CREATE TABLE IF NOT EXISTS passages (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      chapter INTEGER NOT NULL,
      para INTEGER NOT NULL,
      lang TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      norm TEXT NOT NULL,
      ruby_json TEXT,
      notes_json TEXT,
      header TEXT,
      header_json TEXT,
      hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS passages_source ON passages(source_id, chapter, para);
    CREATE TABLE IF NOT EXISTS sentences (
      id TEXT PRIMARY KEY,
      passage_id TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
      n INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sentences_passage ON sentences(passage_id, n);
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_en USING fts5(passage_id UNINDEXED, norm, header, tokenize = 'unicode61 remove_diacritics 2');
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_ja USING fts5(passage_id UNINDEXED, norm, header, tokenize = 'trigram');
  `);
}

export function deleteSource(db: DB, id: string): void {
  const ids = db.prepare("SELECT id FROM passages WHERE source_id = ?").all(id) as { id: string }[];
  const delEn = db.prepare("DELETE FROM fts_en WHERE passage_id = ?");
  const delJa = db.prepare("DELETE FROM fts_ja WHERE passage_id = ?");
  for (const { id: pid } of ids) {
    delEn.run(pid);
    delJa.run(pid);
  }
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}
