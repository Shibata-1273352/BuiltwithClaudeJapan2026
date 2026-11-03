/**
 * Works anywhere: a photo of a place with no sources (live, ~$0.05–0.1: the reading + guide calls).
 * The stage must say it has no sources, still give the first answer and the guide, and cite nothing.
 *   npx tsx --env-file=.env scripts/e2e-anywhere.ts <baseUrl> <image.jpg> [--lang en]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, image, ...rest] = process.argv.slice(2);
if (!base || !image) throw new Error("usage: e2e-anywhere.ts <baseUrl> <image.jpg> [--lang en]");
const lang = rest.includes("--lang") ? rest[rest.indexOf("--lang") + 1] : "ja";
const out = path.join(process.env.DATA_DIR!, "out", "screens", "anywhere");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const fails: string[] = [];
const seen: Record<string, number> = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([
    { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
    { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.getByTestId("file-input").setInputFiles(image);
  await page.getByTestId("faces").waitFor({ timeout: 60_000 });
  const t0 = Date.now();
  await page.getByTestId("send").click();
  const beats = ["stage-photo", "first-answer", "place-unknown", "guide-card", "object-lift", "narrative", "evidence-card", "note-link", "ask-panel"];
  let shots = 0;
  while (Date.now() - t0 < 90_000) {
    for (const b of beats) if (!(b in seen) && (await page.getByTestId(b).count()) > 0) seen[b] = Math.round((Date.now() - t0) / 100) / 10;
    const t = (Date.now() - t0) / 1000;
    if (shots < 3 && t >= [6, 15, 30][shots]) await page.screenshot({ path: path.join(out, `${lang}-${[6, 15, 30][shots++]}s.png`) });
    if ((await page.getByTestId("step-rail").innerText().catch(() => "")).match(/完了|Done/) && t > 8) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${lang}-end.png`) });
  for (const must of ["first-answer", "place-unknown", "guide-card"]) if (!(must in seen)) fails.push(`never shown: ${must}`);
  for (const never of ["narrative", "evidence-card", "note-link", "ask-panel"]) if (never in seen) fails.push(`must not show at an unknown place: ${never}`);
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ seen, out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
