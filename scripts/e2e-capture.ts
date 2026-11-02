/**
 * E2E check of on-device preprocessing (FR-02, FR-03) in headless Chromium.
 *   npx tsx --env-file=.env scripts/e2e-capture.ts http://127.0.0.1:3100 <image.jpg>
 * Verifies: output long side <= 2048, no EXIF/GPS in the output JPEG, faces detected, send enabled.
 * Saves the processed JPEG to $DATA_DIR/out/capture/ for visual inspection.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, image] = process.argv.slice(2);
if (!base || !image) throw new Error("usage: e2e-capture.ts <baseUrl> <image>");
const token = process.env.ACCESS_TOKEN!;
const outDir = path.join(process.env.DATA_DIR!, "out", "capture");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
await ctx.addCookies([{ name: "tsumugi_token", value: token, domain: new URL(base).hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
// MediaPipe logs "INFO: Created TensorFlow Lite XNNPACK delegate" at console.error level; ignore INFO lines.
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errors.push(m.text()));

await page.goto(base + "/?debug=1", { waitUntil: "networkidle" });
const t0 = Date.now();
await page.getByTestId("file-input").setInputFiles(image);
try {
  await page.getByTestId("faces").waitFor({ timeout: 60_000 });
} catch (e) {
  await page.screenshot({ path: path.join(outDir, "failure.png") });
  console.log(JSON.stringify({ failed: String(e).split("\n")[0], errors, text: (await page.textContent("main"))?.slice(0, 400) }, null, 2));
  await browser.close();
  process.exit(1);
}
await page.getByTestId("jpeg-link").waitFor({ state: "attached", timeout: 30_000 });
const ms = Date.now() - t0;
const facesText = await page.getByTestId("faces").textContent();
const rawJson = await page.getByTestId("faces").getAttribute("data-raw");
if (rawJson) writeFileSync(path.join(outDir, path.basename(image).replace(/\.\w+$/, "") + "_raw.json"), rawJson);
// The CSP (connect-src 'self') blocks fetch(blob:), so take the exact upload bytes via a download.
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByTestId("jpeg-link").evaluate((a) => (a as HTMLAnchorElement).click()),
]);
const out = path.join(outDir, path.basename(image).replace(/\.\w+$/, "") + "_processed.jpg");
await download.saveAs(out);
const jpeg = readFileSync(out);
await page.screenshot({ path: path.join(outDir, "preview.png") });

// Parse JPEG markers: APP1 "Exif" must be absent; read SOF for dimensions.
let hasExif = false;
let w = 0;
let h = 0;
for (let i = 2; i < jpeg.length; ) {
  if (jpeg[i] !== 0xff) break;
  const marker = jpeg[i + 1];
  const len = jpeg.readUInt16BE(i + 2);
  if (marker === 0xe1 && jpeg.subarray(i + 4, i + 8).toString("latin1") === "Exif") hasExif = true;
  if (marker >= 0xc0 && marker <= 0xc2) {
    h = jpeg.readUInt16BE(i + 5);
    w = jpeg.readUInt16BE(i + 7);
  }
  if (marker === 0xda) break;
  i += 2 + len;
}
const sendEnabled = await page.getByTestId("send").isEnabled();
const result = { ms, facesText, size: [w, h], bytes: jpeg.length, hasExif, sendEnabled, errors, saved: out };
console.log(JSON.stringify(result, null, 2));
await browser.close();
const ok = !hasExif && Math.max(w, h) <= 2048 && sendEnabled && !errors.length;
process.exitCode = ok ? 0 : 1;
