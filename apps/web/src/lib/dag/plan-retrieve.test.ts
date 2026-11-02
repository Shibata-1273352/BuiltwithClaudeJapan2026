import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Entities, EntityDictionary, normalizeForSearch } from "@tsumugi/core";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate, type DB } from "../corpus/db";
import { buildPlan } from "./plan";
import { retrieveFacet } from "./retrieve";

const E = new Entities(
  EntityDictionary.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../../corpus/entities.json"), "utf8"))),
);
let db: DB;

function add(id: string, type: string, lang: "en" | "ja", text: string) {
  const [src, ch, para] = id.split(":");
  db.prepare("INSERT OR IGNORE INTO sources (id,type,lang,title,retrieved_at,version_hash) VALUES (?,?,?,?,?,?)").run(src, type, lang, src, "x", "h");
  db.prepare("INSERT OR IGNORE INTO chapters (source_id, idx, label, kind) VALUES (?,?,?,?)").run(src, Number(ch), `ch${ch}`, "body");
  const norm = normalizeForSearch(text);
  db.prepare("INSERT INTO passages (id,source_id,chapter,para,lang,kind,text,norm,hash) VALUES (?,?,?,?,?,?,?,?,?)").run(
    id, src, Number(ch), Number(para), lang, "body", text, norm, "h");
  db.prepare(`INSERT INTO fts_${lang} (passage_id, norm, header) VALUES (?,?,?)`).run(id, norm, "");
}

beforeAll(() => {
  db = new Database(":memory:");
  migrate(db);
  add("bird:6:2", "book", "en", "The popular temple of Asakusa is dedicated to the thousand-armed Kwan-non.");
  add("bird:6:5", "book", "en", "A broad avenue leads to the grand entrance, a colossal red gate; under it stand the Ni-ô.");
  add("koun:10:0", "book", "ja", "浅草始まっての大火で雷門もこの時に焼けてしまったのです。");
  add("kafu:5:8", "book", "ja", "浅草の観音堂について論ずれば雷門は既に焼失せてしまった。");
  add("sensoji:1:0", "official_record", "ja", "しかし、幕末の慶応元年（1865）、浅草田原町からの失火により雷門まで延焼してしまう。");
  add("met:1:0", "museum_record", "en", 'Title: Kinryūsan Temple at Asakusa, from the series "One Hundred Famous Views of Edo"');
});

describe("buildPlan (FR-08)", () => {
  it("targets Kaminarimon and lists ancestor scopes and the related deity", () => {
    const p = buildPlan(E, "ent:kaminarimon");
    const desc = p.find((f) => f.facet === "place_description")!;
    expect(desc.scopes.map((s) => [s.entity, s.relation])).toEqual([
      ["ent:kaminarimon", "same"],
      ["ent:sensoji", "ancestor_place"],
      ["ent:asakusa", "ancestor_place"],
      ["ent:kannon", "related"],
    ]);
    expect(p.find((f) => f.facet === "existence_timeline")!.scopes.some((s) => s.relation === "related")).toBe(false);
  });
});

describe("retrieveFacet (FR-08..10, RAG-02)", () => {
  it("English: no passage names Kaminarimon, so it widens and labels Asakusa/temple passages as ancestor_place", () => {
    const f = buildPlan(E, "ent:kaminarimon").find((x) => x.facet === "place_description")!;
    const r = retrieveFacet(db, E, f, "en");
    expect(r.widened).toContain("ent:sensoji");
    const bird = r.candidates.find((c) => c.passageId === "bird:6:2")!;
    expect(bird.target_entity).toBe("ent:kaminarimon");
    expect(bird.relation).not.toBe("same"); // never "about Kaminarimon itself"
    expect(r.candidates.every((c) => c.relation !== "same")).toBe(true);
  });

  it("Bird's Ni-ô gate is matched to the Niōmon, not to Kaminarimon", () => {
    const f = buildPlan(E, "ent:kaminarimon").find((x) => x.facet === "place_description")!;
    const gate = retrieveFacet(db, E, f, "en").candidates.find((c) => c.passageId === "bird:6:5");
    if (gate) expect(gate.matched_entity).not.toBe("ent:kaminarimon");
  });

  it("Japanese: passages naming 雷門 are 'same'", () => {
    const f = buildPlan(E, "ent:kaminarimon").find((x) => x.facet === "place_description")!;
    const r = retrieveFacet(db, E, f, "ja");
    const koun = r.candidates.find((c) => c.passageId === "koun:10:0")!;
    expect(koun.relation).toBe("same");
    expect(koun.matched_entity).toBe("ent:kaminarimon");
  });

  it("existence facet reaches the official record; artifacts facet reaches the museum record (FR-10)", () => {
    const plan = buildPlan(E, "ent:kaminarimon");
    const ex = retrieveFacet(db, E, plan.find((x) => x.facet === "existence_timeline")!, "ja");
    expect(ex.candidates.some((c) => c.sourceType === "official_record")).toBe(true);
    const art = retrieveFacet(db, E, plan.find((x) => x.facet === "historical_artifacts")!, "en");
    expect(art.candidates.map((c) => c.sourceType)).toEqual(["museum_record"]);
  });
});
