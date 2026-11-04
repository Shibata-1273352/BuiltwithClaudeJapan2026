/**
 * The screen takes of the demo video, driven by Playwright. Frames come from Chrome's own screencast
 * (JPEG, full size), because Playwright's recordVideo is fixed at VP8 1 Mbit/s. Frames arrive at an
 * uneven rate, so each keeps its timestamp and ffmpeg lays them onto a constant 30 fps.
 *
 *   npx tsx --env-file=.env scripts/record-takes.ts <baseUrl> <take> [--scene id]
 * takes: live (one real run, costs a Claude run), read, years, space, close
 * Output: video/out/takes/<take>.mp4
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type CDPSession, type Page } from "playwright";

const [base, take, ...rest] = process.argv.slice(2);
if (!base || !take) throw new Error("usage: record-takes.ts <baseUrl> <take> [--scene id]");
const scene = rest.includes("--scene") ? rest[rest.indexOf("--scene") + 1] : "";
const replay = process.env.DEMO_REPLAY_ID!;
const R = `${base}/replay/${replay}`;
const out = path.resolve("video/out/takes");
const dir = path.join(out, `${take}.frames`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
  { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const vis = (p: Page, id: string) => p.getByTestId(id).filter({ visible: true }).first();
const beats: { label: string; at: number }[] = [];

const frames: { file: string; t: number }[] = [];
let cdp: CDPSession;
async function roll() {
  cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    const file = `f${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 96, everyNthFrame: 1 });
}
const beat = (label: string) => {
  beats.push({ label, at: frames.length ? frames[frames.length - 1].t - frames[0].t : 0 });
  console.log(`${beats[beats.length - 1].at.toFixed(1)}s ${label}`);
};
const hold = (ms: number) => page.waitForTimeout(ms);

const takes: Record<string, () => Promise<void>> = {
  /** The real thing: the sample photo goes in and Claude works, live. */
  async live() {
    await page.goto(`${base}/?present=1`, { waitUntil: "networkidle" });
    await hold(800);
    await roll();
    await hold(1500);
    beat("press try");
    await vis(page, "try-sample").click();
    await page.waitForURL(/\/live/, { timeout: 15_000 });
    beat("stage open");
    await vis(page, "note-link").waitFor({ timeout: 150_000 });
    beat("run done");
    await hold(6000);
  },
  /** Claude reads, from the recording, at half speed. */
  async read() {
    await page.goto(`${R}?present=1&hold=broken&speed=0.5`, { waitUntil: "domcontentloaded" });
    await roll();
    await vis(page, "note-link").waitFor({ timeout: 120_000 });
    beat("done");
    await hold(5000);
  },
  /** The years: 1878 snaps, then 1866, then the flow up to the rebuild and the knot. */
  async years() {
    await page.goto(`${R}?present=1&hold=broken&at=end`, { waitUntil: "domcontentloaded" });
    await vis(page, "note-link").waitFor({ timeout: 60_000 });
    await hold(1500);
    await roll();
    await hold(2000);
    beat("turn to 1878");
    const handle = vis(page, "time-handle");
    await handle.focus();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Shift+ArrowUp");
      await hold(70);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("ArrowUp");
      await hold(90);
    }
    beat("1878 reached");
    await hold(6000);
    beat("open time panel");
    await vis(page, "time-toggle").click();
    await hold(1500);
    const panel = page.getByTestId("time-panel");
    await panel.getByRole("slider").fill("1866");
    beat("1866");
    await hold(5500);
    beat("flow");
    await panel.getByRole("button", { name: "時を流す" }).click();
    await panel.getByTestId("time-knot").waitFor({ timeout: 60_000 });
    beat("knot");
    await hold(9000);
  },
  /** One check in 舞台裏. */
  async check() {
    await page.goto(`${R}?present=1&at=end`, { waitUntil: "domcontentloaded" });
    await vis(page, "note-link").waitFor({ timeout: 60_000 });
    await hold(1000);
    await roll();
    await hold(1200);
    await vis(page, "backstage-toggle").click();
    beat("backstage");
    await hold(7000);
  },
  /** Into the print: nothing touches the pointer, the sway carries it. */
  async space() {
    await page.goto(`${base}/space/${scene}?enter=1&present=1&3d=1`, { waitUntil: "domcontentloaded" });
    await roll();
    await hold(11_000);
  },
  /** The postcard. */
  async close() {
    await page.goto(`${base}/api/explorations/${replay}/postcard?lang=ja`, { waitUntil: "load" });
    await hold(500);
    await roll();
    await hold(6000);
  },
};

if (!takes[take]) throw new Error(`no take ${take}`);
await takes[take]();
await cdp!.send("Page.stopScreencast");
await browser.close();

const list = frames
  .map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.033) - f.t).toFixed(4)}`)
  .join("\n");
writeFileSync(path.join(dir, "list.txt"), `${list}\nfile '${frames[frames.length - 1].file}'\n`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,scale=1920:1080", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", path.join(out, `${take}.mp4`)]);
const seconds = frames[frames.length - 1].t - frames[0].t;
writeFileSync(path.join(out, `${take}.json`), JSON.stringify({ seconds, frames: frames.length, beats }, null, 1));
console.log(`${take}: ${frames.length} frames in ${seconds.toFixed(1)}s (${(frames.length / seconds).toFixed(1)}/s) -> video/out/takes/${take}.mp4`);
process.exit(0);
