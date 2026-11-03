import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { StoredEvent } from "./dag/events";
import { buildNote } from "./note";

vi.stubEnv("DATA_DIR", mkdtempSync(path.join(tmpdir(), "tsumugi-confirm-")));

describe("FR-44 あなたの確認", () => {
  let mod: typeof import("./confirmations");
  beforeAll(async () => {
    const { store } = await import("./store");
    const db = store();
    db.prepare("INSERT INTO captures (id, session_id, image_path, image_sha256, width, height, ui_lang, created_at, delete_after) VALUES (?,?,?,?,?,?,?,?,?)").run("cap_a", "s1", "/x", "h", 1, 1, "ja", "t", "t");
    db.prepare("INSERT INTO explorations (id, capture_id, session_id, status, created_at) VALUES (?,?,?,?,?)").run("exp_1", "cap_a", "s1", "done", "t");
    mod = await import("./confirmations");
  });
  it("records who/when, is idempotent, and can be undone", () => {
    mod.setConfirmation("exp_1", "th:exist:koun-kaiko", "s1", true, new Date("2026-11-03T10:00:00Z"));
    mod.setConfirmation("exp_1", "th:exist:koun-kaiko", "s1", true, new Date("2026-11-03T11:00:00Z"));
    expect(mod.confirmationsFor("exp_1").get("th:exist:koun-kaiko")).toBe("2026-11-03T10:00:00.000Z");
    mod.setConfirmation("exp_1", "th:exist:koun-kaiko", "s1", false);
    expect(mod.confirmationsFor("exp_1").size).toBe(0);
  });
  it("only accepts thread-shaped ids", () => {
    expect(mod.THREAD_ID_RE.test("th:cl:bird-unbeaten:6:2:5:r1")).toBe(true);
    expect(mod.THREAD_ID_RE.test("th:x'; DROP TABLE")).toBe(false);
  });
  it("the note shows the confirmation without changing the thread's own state", () => {
    const ev = [{ seq: 1, type: "threads", data: [{ id: "th:exist:koun-kaiko", claimId: "cl:exist:x", layer: "toki", state: "pending", label: { ja: "保留", en: "withheld" }, evidence: [] }] }] as StoredEvent[];
    const n = buildNote("exp_1", "cap_a", ev, new Map(), {}, new Map([["th:exist:koun-kaiko", "2026-11-03T10:00:00.000Z"]]));
    expect(n.threads[0]).toMatchObject({ state: "pending", confirmedAt: "2026-11-03T10:00:00.000Z" });
  });
});
