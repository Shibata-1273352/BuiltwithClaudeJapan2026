/**
 * Text utilities for ingestion and search (REQUIREMENTS.md 4.4.2).
 * The canonical text (正本) is never modified; `normalizeForSearch` builds a separate column
 * whose character positions are NOT used for quoting.
 */

/** Old / variant kanji -> common form (subset relevant to the corpus; extend as needed). */
const VARIANTS: Record<string, string> = {
  淺: "浅",
  觀: "観",
  竜: "龍",
  藏: "蔵",
  國: "国",
  寶: "宝",
  廣: "広",
  德: "徳",
  傳: "伝",
  佛: "仏",
  澤: "沢",
  邊: "辺",
  邉: "辺",
  驛: "駅",
  橫: "横",
  嶋: "島",
  嶌: "島",
  兩: "両",
  髙: "高",
  﨑: "崎",
};

const VARIANT_RE = new RegExp(`[${Object.keys(VARIANTS).join("")}]`, "g");

/**
 * Search normalization: NFKC, lowercase, strip diacritics (Kwan-non / Kwannon / Kwanon match),
 * drop hyphens / apostrophes / middle dots, unify variant kanji, collapse whitespace.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFC")
    .replace(/[-‐‑‒–—―'’`ʻ・･]/g, "")
    .replace(VARIANT_RE, (c) => VARIANTS[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

const EN_ABBREV = /\b(?:Mr|Mrs|Ms|Dr|St|Mt|No|Messrs|Rev|Capt|Col|Gen|Lt|Sr|Jr|vol|pp|cf|i\.e|e\.g|viz|etc)\.$/i;

/** Split English prose into sentences; keeps the exact source characters of each sentence. */
export function splitSentencesEn(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?]["'”’)\]_]*\s+(?=["'“‘(\[_]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].trimEnd().length;
    const candidate = text.slice(start, end);
    if (EN_ABBREV.test(candidate.trimEnd()) || /\b[A-Z]\.$/.test(candidate.trimEnd())) continue;
    out.push(candidate.trim());
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** Split Japanese prose on 。！？ (keeping a closing bracket with its sentence). */
export function splitSentencesJa(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    buf += c;
    if ("「『（(".includes(c)) depth++;
    else if ("」』）)".includes(c)) depth = Math.max(0, depth - 1);
    if ("。！？!?".includes(c) && depth === 0) {
      while (i + 1 < chars.length && "」』）)".includes(chars[i + 1])) buf += chars[++i];
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

export function splitSentences(text: string, lang: "en" | "ja"): string[] {
  return lang === "ja" ? splitSentencesJa(text) : splitSentencesEn(text);
}

/** Sentence ID format from REQUIREMENTS.md 4.4.2. */
export function sentenceId(bookId: string, chapter: number, paragraph: number, n: number): string {
  return `${bookId}:${chapter}:${paragraph}:${n}`;
}

/** Japanese short terms (<= 2 chars) are matched by full scan, not trigram FTS. */
export function needsFullScan(term: string): boolean {
  const t = normalizeForSearch(term);
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t) && [...t].length <= 2;
}
