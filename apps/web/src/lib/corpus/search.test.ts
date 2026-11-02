import { normalizeForSearch } from "@tsumugi/core";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate, type DB } from "./db";
import { rrf, searchEntities, searchRelation } from "./search";
import Database from "better-sqlite3";

let db: DB;

function add(id: string, lang: "en" | "ja", text: string, kind = "body") {
  const [src, ch, para] = id.split(":");
  db.prepare("INSERT OR IGNORE INTO sources (id,type,lang,title,retrieved_at,version_hash) VALUES (?,?,?,?,?,?)").run(
    src, "book", lang, src, "2026-11-02", "h");
  db.prepare("INSERT OR IGNORE INTO chapters (source_id, idx, label, kind) VALUES (?,?,?,?)").run(src, Number(ch), `ch${ch}`, kind);
  const norm = normalizeForSearch(text);
  db.prepare("INSERT INTO passages (id,source_id,chapter,para,lang,kind,text,norm,hash) VALUES (?,?,?,?,?,?,?,?,?)").run(
    id, src, Number(ch), Number(para), lang, kind, text, norm, "h");
  if (kind !== "index") db.prepare(`INSERT INTO fts_${lang} (passage_id, norm, header) VALUES (?,?,?)`).run(id, norm, "");
}

beforeAll(() => {
  db = new Database(":memory:");
  migrate(db);
  add("bird:5:1", "en", "The popular temple of Asakusa is dedicated to the thousand-armed Kwan-non.");
  add("bird:5:2", "en", "The Ni-ô stand under the great red gate.");
  add("bird:9:1", "en", "We left Asakusa and rode to Nikko.");
  add("bird:46:1", "en", "Asakusa, 33; Kwan-non, 34", "index");
  add("kafu:2:1", "ja", "浅草の観音堂について論ずれば雷門は既に焼失せてしまった。");
  add("koun:20:1", "ja", "浅草始まっての大火で雷門もこの時に焼けてしまったのです。");
  add("koun:21:1", "ja", "上野の山に登った。");
});

describe("searchEntities (A)", () => {
  it("matches spelling variants via the normalized column and skips the index", () => {
    const r = searchEntities(db, ["Kwannon"], "en");
    expect(r.map((c) => c.passageId)).toEqual(["bird:5:1"]);
  });
  it("uses full scan for 2-char Japanese terms", () => {
    const r = searchEntities(db, ["雷門"], "ja");
    expect(r.map((c) => c.passageId).sort()).toEqual(["kafu:2:1", "koun:20:1"]);
  });
  it("uses trigram FTS for 3+ chars", () => {
    expect(searchEntities(db, ["観音堂"], "ja").map((c) => c.passageId)).toEqual(["kafu:2:1"]);
  });
  it("treats FTS syntax in terms as literal text", () => {
    expect(() => searchEntities(db, ['asakusa" OR "nikko'], "en")).not.toThrow();
    expect(searchEntities(db, ["NEAR(asakusa nikko)"], "en")).toEqual([]);
  });
  it("enforces argument limits (SEC-04)", () => {
    expect(() => searchEntities(db, Array(13).fill("x"), "en")).toThrow();
    expect(() => searchEntities(db, ["x".repeat(41)], "en")).toThrow();
  });
});

describe("context headers (FR-54, RAG-12)", () => {
  it("finds a passage via its header only when headers are enabled", () => {
    db.prepare("UPDATE passages SET header = ? WHERE id = ?").run("Letter V / Yedo: the Ni-ô gate at Asakusa", "bird:5:2");
    db.prepare("UPDATE fts_en SET header = ? WHERE passage_id = ?").run(normalizeForSearch("Letter V / Yedo: the Ni-ô gate at Asakusa"), "bird:5:2");
    expect(searchEntities(db, ["Yedo"], "en").map((c) => c.passageId)).toEqual(["bird:5:2"]);
    expect(searchEntities(db, ["Yedo"], "en", { useHeader: false })).toEqual([]);
  });
});

describe("searchRelation (B)", () => {
  it("finds co-occurrence in one passage", () => {
    const r = searchRelation(db, ["浅草"], ["観音", "雷門"], "ja");
    expect(r[0].passageId).toBe("kafu:2:1");
    expect(r.map((c) => c.passageId)).toContain("koun:20:1");
    expect(r.map((c) => c.passageId)).not.toContain("koun:21:1");
  });
});

describe("rrf", () => {
  it("rewards passages found by several channels", () => {
    const a = searchEntities(db, ["Asakusa"], "en");
    const b = searchRelation(db, ["Asakusa"], ["temple"], "en");
    const fused = rrf([a, b]);
    expect(fused[0].passageId).toBe("bird:5:1");
    expect(fused[0].channels.sort()).toEqual(["A", "B"]);
  });
});
