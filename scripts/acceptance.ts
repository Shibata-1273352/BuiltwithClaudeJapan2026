/**
 * The acceptance battery: every screen script against one server, one line per check (pass/fail),
 * written to $DATA_DIR/out/acceptance.json. Live Claude calls only where noted (cost printed by the
 * scripts themselves): the question in loom-check, the unknown place, the live sample.
 *   npx tsx --env-file=.env scripts/acceptance.ts <baseUrl> <replay id> <scene id> [--live]
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const [base, replay, scene, ...rest] = process.argv.slice(2);
if (!base || !replay || !scene) throw new Error("usage: acceptance.ts <baseUrl> <replay id> <scene id> [--live]");
const live = rest.includes("--live");
const env = { ...process.env, DEMO_REPLAY_ID: replay };
const sample = path.join(process.env.DATA_DIR!, "samples", "offtarget_kinkakuji_cc0.jpg");

const checks: { name: string; covers: string; args: string[]; live?: boolean }[] = [
  { name: "e2e-demo", covers: "FR-47 the public recording from a fresh session", args: ["scripts/e2e-demo.ts", base] },
  { name: "e2e-replay", covers: "FR-47, FR-27 list view and name compare", args: ["scripts/e2e-replay.ts", base, replay] },
  { name: "rehearse", covers: "6.5 the demo flow in presenter mode", args: ["scripts/rehearse.ts", base] },
  { name: "loom-check ja", covers: "touch, open, drag, the years (FR-56), FR-60 a question, FR-25 map, graph", args: ["scripts/loom-check.ts", base, replay], live: true },
  { name: "loom-check en", covers: "FR-40 English", args: ["scripts/loom-check.ts", base, replay, "--lang", "en", "--no-ask"] },
  { name: "time-shot", covers: "FR-23, FR-56, FR-16 the disagreeing sources", args: ["scripts/time-shot.ts", base, replay] },
  { name: "names-shot", covers: "FR-24 names on the print", args: ["scripts/names-shot.ts", base, replay] },
  { name: "space-shot", covers: "FR-32, FR-33 into the print, FR-37 fallback", args: ["scripts/space-shot.ts", base, scene, "--auto"] },
  { name: "camera-check", covers: "FR-01, FR-02, FR-03 camera and on-device preprocessing", args: ["scripts/camera-check.ts", base] },
  { name: "notes-shot", covers: "FR-42, FR-43 notes, trip weave, postcard", args: ["scripts/notes-shot.ts", base] },
  { name: "e2e-anywhere", covers: "FR-19 a place without sources: reading and guide, nothing cited", args: ["scripts/e2e-anywhere.ts", base, sample], live: true },
  { name: "e2e-sample", covers: "the live run end to end (beats, timings)", args: ["scripts/e2e-sample.ts", base], live: true },
];

const results: { name: string; covers: string; ok: boolean; ms: number; tail: string }[] = [];
for (const c of checks) {
  if (c.live && !live) {
    results.push({ name: c.name, covers: c.covers, ok: true, ms: 0, tail: "skipped (needs --live)" });
    continue;
  }
  const t0 = Date.now();
  const r = spawnSync("npx", ["tsx", "--env-file=.env", ...c.args], { env, encoding: "utf8", timeout: 400_000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ok = r.status === 0 && !/"fails": \[\s*"/.test(out);
  results.push({ name: c.name, covers: c.covers, ok, ms: Date.now() - t0, tail: out.trim().split("\n").slice(-6).join("\n") });
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  (${((Date.now() - t0) / 1000).toFixed(0)} s)  ${c.covers}`);
}
writeFileSync(path.join(process.env.DATA_DIR!, "out", "acceptance.json"), JSON.stringify({ at: new Date().toISOString(), base, replay, results }, null, 1));
process.exit(results.every((r) => r.ok) ? 0 : 1);
