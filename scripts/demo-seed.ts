/**
 * See the app without any keys: loads a recorded run into a fresh DATA_DIR, so /replay/<id> plays it
 * with no Claude call, no Neo4j and no inference server.
 *
 *   npm run demo:seed                  load fixtures/demo/recording.json
 *   npm run demo:seed -- export <id>   write a stored run to that file (text only, no photo)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { store } from "../apps/web/src/lib/store";

const FILE = "fixtures/demo/recording.json";
const SAMPLE = "kaminarimon_cc0.jpg";
const dataDir = process.env.DATA_DIR;
if (!dataDir) throw new Error("DATA_DIR is not set");
const db = store();

type Recording = {
  capture: { id: string; image_sha256: string; width: number; height: number; ui_lang: string; created_at: string; delete_after: string };
  exploration: { id: string; status: string; created_at: string; finished_at: string; cost_usd: number; result_json: string };
  events: { seq: number; type: string; data_json: string; ts: string }[];
};

function exportRun(id: string) {
  const exploration = db.prepare("SELECT id, status, created_at, finished_at, cost_usd, result_json, capture_id FROM explorations WHERE id = ?").get(id) as Recording["exploration"] & { capture_id: string };
  const capture = db.prepare("SELECT id, image_sha256, width, height, ui_lang, created_at, delete_after FROM captures WHERE id = ?").get(exploration.capture_id) as Recording["capture"];
  const events = db.prepare("SELECT seq, type, data_json, ts FROM events WHERE exploration_id = ? ORDER BY seq").all(id) as Recording["events"];
  const { capture_id: _, ...rest } = exploration;
  writeFileSync(FILE, `${JSON.stringify({ capture, exploration: rest, events })}\n`);
  console.log(`${FILE}: ${events.length} events`);
}

function seed() {
  const { capture, exploration, events } = JSON.parse(readFileSync(FILE, "utf8")) as Recording;
  const sample = join(dataDir!, "samples", SAMPLE);
  if (!existsSync(sample)) throw new Error(`${sample} is missing: run npm run setup:samples`);
  const scene = join(dataDir!, "cache", "scenes", capture.id);
  mkdirSync(scene, { recursive: true });
  copyFileSync(sample, join(scene, "photo.jpg"));
  db.transaction(() => {
    db.prepare("INSERT OR REPLACE INTO captures (id, session_id, image_path, image_sha256, width, height, ui_lang, created_at, delete_after) VALUES (?, 'demo', ?, ?, ?, ?, ?, ?, '2099-01-01T00:00:00.000Z')").run(capture.id, sample, capture.image_sha256, capture.width, capture.height, capture.ui_lang, capture.created_at);
    db.prepare("INSERT OR REPLACE INTO explorations (id, capture_id, session_id, status, created_at, finished_at, cost_usd, result_json) VALUES (?, ?, 'demo', ?, ?, ?, ?, ?)").run(exploration.id, capture.id, exploration.status, exploration.created_at, exploration.finished_at, exploration.cost_usd, exploration.result_json);
    const add = db.prepare("INSERT OR REPLACE INTO events (exploration_id, seq, type, data_json, ts) VALUES (?, ?, ?, ?, ?)");
    for (const e of events) add.run(exploration.id, e.seq, e.type, e.data_json, e.ts);
  })();
  console.log(`Loaded ${events.length} events. Add to .env:\nDEMO_REPLAY_ID=${exploration.id}\nThen open /replay/${exploration.id}`);
}

const [command, id] = process.argv.slice(2);
if (command === "export" && id) exportRun(id);
else seed();
