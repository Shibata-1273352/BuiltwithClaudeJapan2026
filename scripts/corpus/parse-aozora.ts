import type { ParsedChapter, ParsedParagraph, Ruby } from "./types";

/**
 * Aozora Bunko text (already decoded to a JS string) -> paragraphs.
 * - Header (title block and the "記号について" box) and footer (from 底本：) are kept as metadata.
 * - Ruby 《》 and ｜ are removed from the canonical text and stored separately with offsets (4.4.2).
 * - ［＃…］ input notes are removed; ※［＃…］ (外字) becomes ※ with the note kept.
 * - 見出し annotations mark section headings.
 */
export type AozoraParsed = {
  title: string;
  sections: ParsedChapter[];
  colophon: string;
};

const RUBY_EXPLICIT = /｜([^《｜\n]+)《([^》\n]+)》/g;
const RUBY_IMPLICIT = /([\p{Script=Han}々〆ヶ〇]+)《([^》\n]+)》/gu;
const HEADING = /［＃「([^」]+)」は(大|中|小)見出し］/;
const GAIJI = /※［＃([^］]*)］/g;
const NOTE = /［＃[^］]*］/g;

export function parseAozora(raw: string): AozoraParsed {
  const text = raw.replace(/\r\n/g, "\n").replace(/^﻿/, "");
  const lines = text.split("\n");
  const title = lines[0]?.trim() ?? "";

  // Header ends at the second dashed separator line if a 記号 box exists, otherwise after the first blank line.
  const dashIdx = lines.map((l, i) => (/^-{20,}$/.test(l.trim()) ? i : -1)).filter((i) => i >= 0);
  let bodyStart = dashIdx.length >= 2 ? dashIdx[1] + 1 : lines.findIndex((l) => l.trim() === "") + 1;
  const footerIdx = lines.findIndex((l, i) => i > bodyStart && /^底本：/.test(l));
  const bodyEnd = footerIdx >= 0 ? footerIdx : lines.length;
  if (bodyStart <= 0) bodyStart = 1;

  const sections: ParsedChapter[] = [{ label: title, kind: "body", paragraphs: [] }];
  for (const line of lines.slice(bodyStart, bodyEnd)) {
    const h = line.match(HEADING);
    if (h) {
      const label = h[1].trim();
      if (sections.at(-1)!.paragraphs.length || sections.length > 1) sections.push({ label, kind: "body", paragraphs: [] });
      else sections[0].label = label;
      continue;
    }
    const p = cleanLine(line);
    if (p) sections.at(-1)!.paragraphs.push(p);
  }
  return { title, sections: sections.filter((s) => s.paragraphs.length), colophon: lines.slice(bodyEnd).join("\n").trim() };
}

export function cleanLine(line: string): ParsedParagraph | null {
  const notes: string[] = [];
  let s = line.replace(GAIJI, (_m, d: string) => {
    notes.push(`※ = ${d}`);
    return "※";
  });
  s = s.replace(NOTE, "");
  // Extract ruby, computing offsets in the cleaned string.
  const ruby: Ruby[] = [];
  let out = "";
  let i = 0;
  const combined = new RegExp(`${RUBY_EXPLICIT.source}|${RUBY_IMPLICIT.source}`, "gu");
  for (const m of s.matchAll(combined)) {
    const idx = m.index!;
    out += s.slice(i, idx);
    const base = m[1] ?? m[3];
    const reading = m[2] ?? m[4];
    ruby.push({ base, reading, offset: [...out].length });
    out += base;
    i = idx + m[0].length;
  }
  out += s.slice(i);
  out = out.replace(/｜/g, "").replace(/^[\s　]+|[\s　]+$/g, "");
  if (!out) return null;
  return { text: out, ...(ruby.length ? { ruby } : {}), ...(notes.length ? { notes } : {}) };
}
