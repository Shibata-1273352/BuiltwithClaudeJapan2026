/**
 * E2E: photo → on-device preprocessing → upload → exploration → SSE until done (headless Chromium).
 *   npx tsx --env-file=.env scripts/e2e-explore.ts <baseUrl> <image.jpg>
 * Makes one real Claude call (~$0.05). Saves a screenshot to $DATA_DIR/out/explore/.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, image] = process.argv.slice(2);
if (!base || !image) throw new Error("usage: e2e-explore.ts <baseUrl> <image>");
const outDir = path.join(process.env.DATA_DIR!, "out", "explore");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1000, height: 2400 },
  ignoreHTTPSErrors: true,
});
const u = new URL(base);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on(
  "console",
  (m) =>
    m.type() === "error" &&
    !m.text().startsWith("INFO:") &&
    errors.push(m.text()),
);

// First visit with the token (cookie is set by the proxy). Over plain http the Secure cookie
// would be dropped, so for local http runs we set the cookies directly instead.
if (u.protocol === "https:") {
  await page.goto(
    `${base}/?token=${encodeURIComponent(process.env.ACCESS_TOKEN!)}`,
    { waitUntil: "networkidle" },
  );
} else {
  await ctx.addCookies([
    {
      name: "tsumugi_token",
      value: process.env.ACCESS_TOKEN!,
      domain: u.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
    {
      name: "tsumugi_sid",
      value: crypto.randomUUID(),
      domain: u.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto(base + "/?view=list&motion=0", { waitUntil: "networkidle" });
}

const t0 = Date.now();
await page.getByTestId("file-input").setInputFiles(image);
await page.getByTestId("faces").waitFor({ timeout: 60_000 });
await page.getByTestId("send").click();
const status = page.getByTestId("exploration-status");
await page.waitForFunction(
  () =>
    /完了|失敗|できません/.test(
      document.querySelector('[data-testid="exploration-status"]')
        ?.textContent ?? "",
    ),
  null,
  { timeout: 120_000 },
);
const ms = Date.now() - t0;
await page.screenshot({
  path: path.join(outDir, "explore.png"),
  fullPage: true,
});
const narrativeJa = await page
  .getByTestId("narrative")
  .innerText()
  .catch(() => null);
const slider: Record<
  string,
  { state: string | null; thread: string | null; text: string | null }
> = {};
if (await page.getByTestId("time-river").count()) {
  for (const y of [1856, 1878, 1905, 2026]) {
    await page.getByTestId("year-slider").fill(String(y));
    await page.waitForTimeout(700);
    await page
      .getByTestId("time-river")
      .screenshot({ path: path.join(outDir, `river-${y}.png`) });
    slider[y] = {
      state: await page.getByTestId("year-state").getAttribute("data-state"),
      thread: await page
        .getByTestId("thread")
        .first()
        .getAttribute("data-state"),
      text: await page.getByTestId("year-state").innerText(),
    };
  }
}
let narrativeEn: string | null = null;
let langMs: number | null = null;
if (await page.getByTestId("lang-en").count()) {
  const t1 = Date.now();
  await page.getByTestId("lang-en").click();
  await page
    .waitForFunction(
      () =>
        /[A-Za-z]{4,}.*[A-Za-z]{4,}/.test(
          document
            .querySelector('[data-testid="narrative"]')
            ?.textContent?.slice(0, 80) ?? "",
        ),
      null,
      {
        timeout: 60_000,
      },
    )
    .catch(() => undefined);
  langMs = Date.now() - t1;
  narrativeEn = await page
    .getByTestId("narrative")
    .innerText()
    .catch(() => null);
}
const text = (await page.getByTestId("exploration").textContent()) ?? "";

const summary = {
  ms,
  status: await status.textContent(),
  place: await page
    .getByTestId("place")
    .textContent()
    .catch(() => null),
  excerpt: text.slice(0, 300),
  existence: await page
    .getByTestId("existence")
    .innerText()
    .catch(() => null),
  slider,
  narrative: narrativeJa,
  narrativeEn,
  langMs,
  names: await page
    .getByTestId("names")
    .innerText()
    .catch(() => null),
  gap: await page
    .getByTestId("gap")
    .innerText()
    .catch(() => null),
  claims: await page
    .getByTestId("claims")
    .innerText()
    .catch(() => null),
  threads: await page
    .getByTestId("threads")
    .innerText()
    .catch(() => null),
};
// 旅ノート (FR-42): open from the link, select the Bird sentence, wait for the reference translation
let note: Record<string, unknown> | null = null;
if (await page.getByTestId("note-link").count()) {
  await page.getByTestId("note-link").click();
  await page.getByTestId("travel-note").waitFor({ timeout: 30_000 });
  await page.getByTestId("note-lang-ja").click();
  const sentences = page.getByTestId("note-sentences").locator("button");
  const n = await sentences.count();
  for (let i = 0; i < n; i++) {
    if (/バード|Bird/.test((await sentences.nth(i).textContent()) ?? "")) {
      await sentences.nth(i).click();
      break;
    }
  }
  const t2 = Date.now();
  await page
    .waitForFunction(
      () =>
        !/参考訳を作っています/.test(
          document.querySelector('[data-testid="note-evidence"]')
            ?.textContent ?? "",
        ),
      null,
      { timeout: 60_000 },
    )
    .catch(() => undefined);
  note = {
    sentences: n,
    evidence: (await page.getByTestId("note-evidence").innerText()).slice(
      0,
      700,
    ),
    translateMs: Date.now() - t2,
    tickets: (
      await page.getByTestId("note-tickets").locator("li").allInnerTexts()
    ).map((s) => s.split("\n")[0]),
  };
  await page.screenshot({
    path: path.join(outDir, "note.png"),
    fullPage: true,
  });
}
console.log(JSON.stringify({ ...summary, note, errors }, null, 2));
await browser.close();
