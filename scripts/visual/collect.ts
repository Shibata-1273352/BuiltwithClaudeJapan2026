/**
 * FR-58 gallery: Hiroshige's One Hundred Famous Views of Edo from Wikimedia Commons (one public-
 * domain scan per print; Brooklyn Museum scans preferred). The Met API was rate-limited for this
 * job, so Commons is the source. Writes corpus/visual-gallery.json (titles, Commons file pages,
 * licenses) and 800px thumbnails to $DATA_DIR/cache/visual/images/.
 *   npx tsx --env-file=.env scripts/visual/collect.ts
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "TSUMUGI-hackathon/0.1 (FR-58 gallery; contact via GitHub Shibata-1273352)";
const ROOT_CAT = "Category:One Hundred Famous Views of Edo";
const dir = path.join(process.env.DATA_DIR!, "cache", "visual", "images");
mkdirSync(dir, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** polite: 1 request/s, and on 429 wait as long as Retry-After asks (at most 5 tries) */
async function politeFetch(u: string): Promise<Response> {
  for (let i = 0; ; i++) {
    const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
    await sleep(1000);
    if (r.status !== 429 || i >= 4) return r;
    const wait = Number(r.headers.get("retry-after") ?? 30) * 1000;
    console.log(`429, waiting ${wait / 1000}s`);
    await sleep(wait);
  }
}
async function api(params: Record<string, string>) {
  const u = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const r = await politeFetch(u);
  if (!r.ok) throw new Error(`${u}: ${r.status}`);
  return r.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const members = async (cat: string, type: "subcat" | "file") =>
  ((await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: type, cmlimit: "200" })).query.categorymembers as { title: string }[]).map((m) => m.title);

const subcats = (await members(ROOT_CAT, "subcat")).filter((c) => /\(One Hundred Famous Views of Edo\)|Plum Garden in Kameido/.test(c));
const items: { id: string; title: string; commons: string; license: string; thumb: string; file: string }[] = [];
for (const cat of subcats) {
  const files = (await members(cat, "file")).filter((f) => /\.(jpe?g|png|tif)$/i.test(f));
  const pick = files.find((f) => /Brooklyn/i.test(f)) ?? files[0];
  if (!pick) continue;
  const info = await api({ action: "query", titles: pick, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "800", iiextmetadatafilter: "LicenseShortName" });
  const ii = (Object.values(info.query.pages)[0] as { imageinfo?: { thumburl: string; descriptionurl: string; extmetadata: { LicenseShortName?: { value: string } } }[] }).imageinfo?.[0];
  const license = ii?.extmetadata.LicenseShortName?.value ?? "";
  if (!ii || !/public domain|PD|CC0/i.test(license)) continue;
  const title = cat.replace(/^Category:/, "").replace(/ \(One Hundred Famous Views of Edo\)$/, "");
  const id = `edo100-${createHash("sha1").update(title).digest("hex").slice(0, 8)}`;
  const file = `${id}.jpg`;
  if (!existsSync(path.join(dir, file))) {
    const r = await politeFetch(ii.thumburl);
    if (!r.ok) continue;
    writeFileSync(path.join(dir, file), Buffer.from(await r.arrayBuffer()));
  }
  items.push({ id, title, commons: ii.descriptionurl, license, thumb: ii.thumburl, file });
}
writeFileSync(
  path.join(import.meta.dirname, "..", "..", "corpus", "visual-gallery.json"),
  JSON.stringify(
    { version: 1, source: "Wikimedia Commons, Category:One Hundred Famous Views of Edo (one public-domain scan per print)", retrieved_at: new Date().toISOString().slice(0, 10), items },
    null,
    1,
  ) + "\n",
);
console.log(`${items.length} prints from ${subcats.length} categories`);
