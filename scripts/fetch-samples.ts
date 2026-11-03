/**
 * Download the test photos and prints listed in corpus/samples.json into $DATA_DIR/samples
 * (public domain / CC0 only), politely and only if missing. Writes PROVENANCE.json next to them.
 *   npm run setup:samples
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const manifest = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "corpus", "samples.json"), "utf8")) as {
  items: { file: string; url: string; page: string; license: string; use: string }[];
};
const dir = path.join(process.env.DATA_DIR!, "samples");
mkdirSync(dir, { recursive: true });
const UA = "TSUMUGI-hackathon/0.1 (sample download; https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026)";
const provPath = path.join(dir, "PROVENANCE.json");
const prov: Record<string, unknown> = existsSync(provPath) ? JSON.parse(readFileSync(provPath, "utf8")) : {};

for (const it of manifest.items) {
  if (!/^[a-z0-9_]+\.jpg$/.test(it.file)) throw new Error(`bad file name ${it.file}`);
  const out = path.join(dir, it.file);
  if (!existsSync(out)) {
    const r = await fetch(it.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) throw new Error(`${it.file}: ${r.status} ${type}`);
    writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    console.log(`downloaded ${it.file}`);
    await new Promise((res) => setTimeout(res, 1000));
  } else console.log(`have ${it.file}`);
  prov[it.file] = { ...(prov[it.file] as object), source: it.page, license: it.license, note: it.use };
}
writeFileSync(provPath, JSON.stringify(prov, null, 1));
