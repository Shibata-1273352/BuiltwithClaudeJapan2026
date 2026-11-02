import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Entities, EntityDictionary, normalizeForSearch } from "@tsumugi/core";
import { describe, expect, it } from "vitest";
import { migrate } from "./corpus/db";
import type { Retrieved } from "./dag/retrieve";
import { buildExtract, EXTRACT_SYSTEM } from "./extract";

const E = new Entities(EntityDictionary.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../corpus/entities.json"), "utf8"))));
const db = new Database(":memory:");
migrate(db);
db.prepare("INSERT INTO sources (id,type,lang,title,retrieved_at,version_hash) VALUES (?,?,?,?,?,?)").run("bird-unbeaten", "book", "en", "Unbeaten", "x", "h");
db.prepare("INSERT INTO chapters (source_id, idx, label, kind) VALUES (?,?,?,?)").run("bird-unbeaten", 6, "ch6", "body");
const text = "It is dedicated to Kwan-non.";
db.prepare("INSERT INTO passages (id,source_id,chapter,para,lang,kind,text,norm,hash) VALUES (?,?,?,?,?,?,?,?,?)").run("bird-unbeaten:6:2", "bird-unbeaten", 6, 2, "en", "body", text, normalizeForSearch(text), "h");
db.prepare("INSERT INTO sentences (id, passage_id, n, text) VALUES (?,?,?,?)").run("bird-unbeaten:6:2:0", "bird-unbeaten:6:2", 0, text);
const cand = { passageId: "bird-unbeaten:6:2", sourceId: "bird-unbeaten", sourceType: "book", sourceTitle: "Unbeaten", lang: "en", chapterLabel: "ch6", text, facet: "naming", target_entity: "ent:kaminarimon", matched_entity: "ent:kannon", relation: "related", scope: "", channels: ["A"], matched: [], rrf: 0.1 } as Retrieved;

describe("buildExtract (the same request for live runs and the evaluation)", () => {
  it("gives Claude the passage with sentence ids and its 1-hop relations (FR-57)", () => {
    const r = buildExtract(db, E, "ent:kaminarimon", [cand]);
    expect(r.system).toBe(EXTRACT_SYSTEM);
    expect(r.user).toContain("Photo subject: ent:kaminarimon");
    expect(r.user).toContain("relations: matched: ent:kannon (related to the photo's subject ent:kaminarimon)");
    expect(r.user).toContain("[bird-unbeaten:6:2:0] It is dedicated to Kwan-non.");
  });
  it("drops only the relation line in the 10.3 ablation", () => {
    const a = buildExtract(db, E, "ent:kaminarimon", [cand]).user;
    const b = buildExtract(db, E, "ent:kaminarimon", [cand], { relations: false }).user;
    expect(b).not.toContain("relations:");
    expect(a.replace(/relations: .*\n/, "")).toBe(b);
  });
  it("checks proposals in code: a valid named_as is accepted, a made-up sentence id is not", () => {
    const r = buildExtract(db, E, "ent:kaminarimon", [cand]);
    const base = { passage_id: "bird-unbeaten:6:2", object: null, relation: "supports", negated: false, rationale: "" };
    const out = r.finish(
      JSON.stringify({
        claims: [
          { ...base, sentence_ids: ["bird-unbeaten:6:2:0"], subject: "ent:kannon", predicate: "named_as", value: "Kwan-non" },
          { ...base, sentence_ids: ["bird-unbeaten:6:2:9"], subject: "ent:kannon", predicate: "mentions", value: null },
        ],
      }),
      "end_turn",
    );
    expect(out.map((c) => c.status)).toEqual(["accepted", "rejected"]);
  });
});
