import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// an isolated store for this test (never the real $DATA_DIR)
vi.stubEnv("DATA_DIR", mkdtempSync(path.join(tmpdir(), "tsumugi-notes-")));

describe("notesFor (FR-43)", () => {
  let notesFor: typeof import("./notes-list").notesFor;
  beforeAll(async () => {
    const { store } = await import("./store");
    const db = store();
    const cap = (id: string, sid: string) =>
      db
        .prepare("INSERT INTO captures (id, session_id, image_path, image_sha256, width, height, ui_lang, created_at, delete_after) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(id, sid, "/x", "h", 1, 1, "ja", "2026-11-03T00:00:00Z", "2026-11-10T00:00:00Z");
    const exp = (id: string, capId: string, sid: string, result: object, at: string) =>
      db.prepare("INSERT INTO explorations (id, capture_id, session_id, status, created_at, cost_usd, result_json) VALUES (?,?,?,?,?,?,?)").run(id, capId, sid, "done", at, 0.1, JSON.stringify(result));
    cap("cap_a", "s1");
    cap("cap_b", "s2");
    exp("exp_1", "cap_a", "s1", { place: "ent:kaminarimon", narrative_sentences: 6 }, "2026-11-03T01:00:00Z");
    exp("exp_2", "cap_a", "s1", { place: null }, "2026-11-03T02:00:00Z"); // stopped: no note
    exp("exp_3", "cap_a", "s1", { place: "ent:azumabashi", narrative_sentences: 7 }, "2026-11-03T03:00:00Z");
    exp("exp_4", "cap_b", "s2", { place: "ent:konponchudo", narrative_sentences: 5 }, "2026-11-03T04:00:00Z");
    ({ notesFor } = await import("./notes-list"));
  });
  it("lists only the viewer's notes with a story, newest first", () => {
    expect(notesFor({ sid: "s1", presenter: false }).map((n) => [n.id, n.place?.name.ja])).toEqual([
      ["exp_3", "吾妻橋"],
      ["exp_1", "雷門"],
    ]);
  });
  it("shows nothing without a session; the read-only presenter sees all", () => {
    expect(notesFor({ sid: null, presenter: false })).toEqual([]);
    expect(notesFor({ sid: null, presenter: true }).map((n) => n.id)).toEqual(["exp_4", "exp_3", "exp_1"]);
  });
});
