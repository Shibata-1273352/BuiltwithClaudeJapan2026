/**
 * Corpus ingestion CLI (FR-48).
 *   npm run corpus:ingest                 # all sources in corpus/sources.json
 *   npm run corpus:ingest -- bird-unbeaten # one source
 *   npm run corpus:ingest -- --refresh     # re-download raw files
 * Raw downloads are cached in $DATA_DIR/corpus/raw/<id>/ with their sha256.
 * After ingestion, prints term counts per site (corpus/sites.json) so weak books can be replaced.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { normalizeForSearch, sentenceId, splitSentences } from "../../packages/core/src/text";
import { deleteSource, openDb, type DB } from "../../apps/web/src/lib/corpus/db";
import { parseAozora } from "./parse-aozora";
import { parseGutenberg } from "./parse-gutenberg";
import type { ParsedChapter } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..", "..");
const manifest = JSON.parse(readFileSync(path.join(repo, "corpus", "sources.json"), "utf8"));
const sites = JSON.parse(readFileSync(path.join(repo, "corpus", "sites.json"), "utf8"));
const dataDir = process.env.DATA_DIR;
if (!dataDir) throw new Error("DATA_DIR is not set");

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const only = args.filter((a) => !a.startsWith("--"));
const UA = "TSUMUGI-hackathon/0.1 (corpus ingestion; contact via GitHub Shibata-1273352)";

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

async function fetchCached(id: string, name: string, url: string): Promise<Buffer> {
  const dir = path.join(dataDir!, "corpus", "raw", id);
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  if (!refresh && existsSync(p)) return readFileSync(p);
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(p, buf);
  await new Promise((res) => setTimeout(res, 300)); // be polite to small archives
  return buf;
}

type Insert = { chapters: ParsedChapter[]; raw: Buffer[]; meta: Record<string, unknown> };

function store(db: DB, src: Record<string, any>, ins: Insert): { passages: number; sentences: number } {
  const lang = src.lang as "en" | "ja";
  const version = sha256(Buffer.concat(ins.raw));
  let passages = 0;
  let sentences = 0;
  db.transaction(() => {
    deleteSource(db, src.id);
    db.prepare(
      `INSERT INTO sources (id,type,lang,title,author,first_published,edition,edition_year,url,provider,license,retrieved_at,version_hash,meta_json)
       VALUES (@id,@type,@lang,@title,@author,@first_published,@edition,@edition_year,@url,@provider,@license,@retrieved_at,@version_hash,@meta_json)`,
    ).run({
      id: src.id,
      type: src.type,
      lang,
      title: src.title,
      author: src.author ?? null,
      first_published: src.first_published ?? null,
      edition: src.edition ?? null,
      edition_year: src.edition_year != null ? String(src.edition_year) : null,
      url: src.url ?? src.parts?.[0]?.card_url ?? null,
      provider: src.provider ?? null,
      license: src.license ?? null,
      retrieved_at: new Date().toISOString(),
      version_hash: version,
      meta_json: JSON.stringify(ins.meta),
    });
    const insCh = db.prepare("INSERT INTO chapters (source_id, idx, label, kind) VALUES (?,?,?,?)");
    const insP = db.prepare(
      `INSERT INTO passages (id,source_id,chapter,para,lang,kind,text,norm,ruby_json,notes_json,hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const insS = db.prepare("INSERT INTO sentences (id, passage_id, n, text) VALUES (?,?,?,?)");
    const insF = db.prepare(`INSERT INTO fts_${lang} (passage_id, norm, header) VALUES (?,?,?)`);
    ins.chapters.forEach((ch, ci) => {
      insCh.run(src.id, ci, ch.label, ch.kind);
      ch.paragraphs.forEach((p, pi) => {
        const pid = `${src.id}:${ci}:${pi}`;
        const norm = normalizeForSearch(p.text);
        insP.run(pid, src.id, ci, pi, lang, ch.kind, p.text, norm,
          p.ruby ? JSON.stringify(p.ruby) : null, p.notes ? JSON.stringify(p.notes) : null, sha256(p.text));
        splitSentences(p.text, lang).forEach((s, si) => {
          insS.run(sentenceId(src.id, ci, pi, si), pid, si, s);
          sentences++;
        });
        if (ch.kind !== "index") insF.run(pid, norm, "");
        passages++;
      });
    });
  })();
  return { passages, sentences };
}

async function ingestGutenberg(src: any): Promise<Insert> {
  const raw = await fetchCached(src.id, "book.txt", src.url);
  const parsed = parseGutenberg(raw.toString("utf8"), new RegExp(src.chapter_pattern));
  return { chapters: parsed.chapters, raw: [raw], meta: { transforms: parsed.transforms, license_text_sha256: sha256(parsed.license) } };
}

async function ingestAozora(src: any): Promise<Insert> {
  const chapters: ParsedChapter[] = [];
  const raws: Buffer[] = [];
  const colophons: string[] = [];
  const multi = src.parts.length > 1;
  for (const part of src.parts) {
    const zip = await fetchCached(src.id, `${part.aozora_id}.zip`, part.zip_url);
    raws.push(zip);
    const files = unzipSync(new Uint8Array(zip));
    const txtName = Object.keys(files).find((n) => n.endsWith(".txt"));
    if (!txtName) throw new Error(`${part.zip_url}: no .txt in zip`);
    const text = new TextDecoder("shift_jis").decode(files[txtName]);
    const a = parseAozora(text);
    colophons.push(a.colophon);
    if (multi) {
      // One Aozora work = one chapter of the book; internal headings become paragraph breaks only.
      chapters.push({ label: part.title, kind: "body", paragraphs: a.sections.flatMap((s) => s.paragraphs) });
    } else {
      chapters.push(...a.sections);
    }
  }
  return {
    chapters,
    raw: raws,
    meta: {
      transforms: ["Aozora header/colophon separated", "ruby moved to ruby_json", "［＃］ notes removed", "外字 → ※ (note kept)"],
      parts: src.parts.map((p: any) => ({ aozora_id: p.aozora_id, card_url: p.card_url, input_by: p.input_by, proofread_by: p.proofread_by })),
      colophon_first: colophons[0],
    },
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ");
}

async function ingestWebExcerpt(src: any): Promise<Insert> {
  const raw = await fetchCached(src.id, "page.html", src.url);
  const page = htmlToText(raw.toString("utf8"));
  const squash = (s: string) => s.replace(/\s+/g, "");
  const missing = src.excerpts.filter((e: string) => !squash(page).includes(squash(e)));
  if (missing.length) throw new Error(`${src.id}: excerpts not found on page: ${missing.join(" | ")}`);
  return {
    chapters: [{ label: src.title, kind: "body", paragraphs: src.excerpts.map((t: string) => ({ text: t })) }],
    raw: [raw],
    meta: { excerpt_verified_against_page: true, excerpt_count: src.excerpts.length },
  };
}

function siteCounts(db: DB) {
  const rows: Record<string, Record<string, number>> = {};
  for (const [site, def] of Object.entries<any>(sites)) {
    for (const src of db.prepare("SELECT id, lang FROM sources").all() as { id: string; lang: "en" | "ja" }[]) {
      const terms: string[] = def.terms[src.lang] ?? [];
      const norms = (db.prepare("SELECT norm FROM passages WHERE source_id = ? AND kind != 'index'").all(src.id) as { norm: string }[]).map(
        (r) => r.norm,
      );
      for (const term of terms) {
        const t = normalizeForSearch(term);
        // English: whole words only ("nio" must not match "union"); Japanese: substring.
        const re = src.lang === "en" ? new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g") : null;
        const n = norms.reduce((acc, s) => acc + (re ? (s.match(re)?.length ?? 0) : s.split(t).length - 1), 0);
        (rows[`${site} / ${src.id}`] ??= {})[term] = n;
      }
    }
  }
  return rows;
}

const db = openDb();
for (const src of manifest.sources) {
  if (only.length && !only.includes(src.id)) continue;
  const t0 = Date.now();
  const ins =
    src.format === "gutenberg" ? await ingestGutenberg(src) : src.format === "aozora" ? await ingestAozora(src) : await ingestWebExcerpt(src);
  const r = store(db, src, ins);
  console.log(`${src.id}: ${ins.chapters.length} chapters, ${r.passages} passages, ${r.sentences} sentences (${Date.now() - t0} ms)`);
}
console.log("\nTerm counts (index chapters excluded):");
console.table(siteCounts(db));
db.close();
