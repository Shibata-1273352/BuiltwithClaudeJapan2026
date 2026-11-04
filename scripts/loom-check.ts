/**
 * The loom by hand (no Claude: a replay): touch the main object, tap it open (kanji, questions),
 * drag it and let go, turn the years to 1878 / 1856 / 1960, switch the language — a screenshot
 * at each step, and the checks that each step changed what it should.
 *   npx tsx --env-file=.env scripts/loom-check.ts http://127.0.0.1:3100 <exploration id> [--lang en]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, id, ...rest] = process.argv.slice(2);
if (!base || !id) throw new Error("usage: loom-check.ts <baseUrl> <exploration id> [--lang en]");
const lang = rest.includes("--lang") ? rest[rest.indexOf("--lang") + 1] : "ja";
const out = path.join(process.env.DATA_DIR!, "out", "screens", "loom");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const fails: string[] = [];
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
  await page.goto(`${base}/replay/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("note-link").waitFor({ timeout: 120_000 });
  // the print may still be over the photo (it holds ~5 s after the visual match): let it step back
  await page.getByTestId("stage-overlay").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
    await page.getByTestId("stage-split").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const shot = (n: string) => page.screenshot({ path: path.join(out, `${lang}-${n}.png`) });
  await shot("1-done");
  const obj = page.locator('[data-object="lantern"]').or(page.locator('[data-testid="object-lift"]').last()).first();
  if (!(await obj.count())) fails.push("no touchable object");
  const box = await obj.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.75);
    await page.waitForTimeout(250);
    await shot("2-touch");
    // smaller objects (an inscription) sit on top of the lantern: touch the lantern where it is alone
    await obj.click({ position: { x: box.width * 0.85, y: box.height * 0.75 } });
    await page.waitForTimeout(700);
    await shot("3-open");
    if (!(await page.getByTestId("kanji-parts").count())) fails.push("tap did not open the kanji parts");
    // drag and let go: the object follows and springs back
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.75);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85 + 120, box.y + box.height * 0.75 + 60, { steps: 8 });
    await page.waitForTimeout(150);
    await shot("4-drag");
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
  // turn the years with the keyboard (the same handle a finger drags)
  const handle = page.getByTestId("time-handle");
  if (!(await handle.count())) fails.push("no time handle");
  else {
    await handle.focus();
    const to = async (y: number) => {
      const now = Number(await handle.getAttribute("aria-valuenow"));
      const diff = y - now;
      for (let i = 0; i < Math.abs(Math.trunc(diff / 10)); i++) await page.keyboard.press(diff < 0 ? "Shift+ArrowUp" : "Shift+ArrowDown");
      for (let i = 0; i < Math.abs(diff % 10); i++) await page.keyboard.press(diff < 0 ? "ArrowUp" : "ArrowDown");
      await page.waitForTimeout(900);
    };
    await to(1878);
    await shot("5-1878");
    if ((await page.getByTestId("stage-plate").getAttribute("data-absent")) !== "1" || !(await page.getByTestId("absent-line").count())) fails.push("1878: the gate should be shown as absent");
    await to(1856);
    await shot("6-1856");
    if (!(await page.getByTestId("stage-overlay").count())) fails.push("1856: Hiroshige's print should be over the photo");
    await to(1960);
    await shot("7-1960");
    await to(2026);
  }
  // pull the thread (a Claude call, ~$0.01): skip with --no-ask
  if (!rest.includes("--no-ask")) {
    const input = page.getByTestId("ask-input");
    if (!(await input.count())) fails.push("no ask panel");
    else {
      await input.fill(lang === "en" ? "Why was the gate missing in 1878?" : "1878年に雷門がなかったのはなぜ？");
      await page.getByTestId("ask-submit").click();
      await page.locator('[data-testid="ask-answer"] sup, [data-testid="ask-not-found"]').first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await shot("8-ask");
      if (!(await page.locator('[data-testid="ask-answer"] sup').count())) fails.push("the answer cites nothing");
    }
  }
  // the world map, then 舞台裏 with the Evidence Graph as written
  const world = page.getByTestId("world-card");
  if (await world.count()) await world.screenshot({ path: path.join(out, `${lang}-9-world.png`) });
  else fails.push("no world card");
  await page.getByTestId("backstage-toggle").click();
  const graph = page.getByTestId("graph-diagram");
  await graph.waitFor({ timeout: 10_000 }).catch(() => fails.push("no graph diagram in backstage"));
  if (!(await page.getByTestId("associations").count())) fails.push("no associations in backstage");
  if (await graph.count()) {
    await graph.scrollIntoViewIfNeeded();
    await graph.screenshot({ path: path.join(out, `${lang}-10-graph.png`) });
  }
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
