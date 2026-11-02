import type { ParsedBook, ParsedChapter } from "./types";

/**
 * Gutenberg plain text -> chapters/paragraphs.
 * - The license header/footer outside the START/END markers is separated and not ingested (4.4.2).
 * - Line wraps inside a paragraph become single spaces; `_italic_` markers are removed.
 * - `chapterPattern` lines start a new chapter; a line "INDEX" starts the back-of-book index.
 */
export function parseGutenberg(raw: string, chapterPattern: RegExp): ParsedBook & { license: string } {
  const text = raw.replace(/\r\n/g, "\n");
  const start = text.search(/^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m);
  const end = text.search(/^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m);
  if (start < 0 || end < 0) throw new Error("Gutenberg START/END markers not found");
  const bodyStart = text.indexOf("\n", start) + 1;
  const body = text.slice(bodyStart, end);
  const license = text.slice(0, bodyStart) + text.slice(end);

  const chapters: ParsedChapter[] = [{ label: "front matter", kind: "front", paragraphs: [] }];
  const blocks = body.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];
    if (/^INDEX\.?$/.test(first)) {
      chapters.push({ label: "INDEX", kind: "index", paragraphs: [] });
      if (lines.length > 1) chapters.at(-1)!.paragraphs.push({ text: clean(lines.slice(1).join(" ")) });
      continue;
    }
    if (chapterPattern.test(first)) {
      chapters.push({ label: first, kind: "body", paragraphs: [] });
      if (lines.length > 1) chapters.at(-1)!.paragraphs.push({ text: clean(lines.slice(1).join(" ")) });
      continue;
    }
    const t = clean(lines.join(" "));
    if (t) chapters.at(-1)!.paragraphs.push({ text: t });
  }
  return {
    chapters,
    license,
    transforms: ["Gutenberg header/footer separated", "line wraps joined with a space", "_italic_ markers removed"],
  };
}

function clean(s: string): string {
  return s.replace(/_([^_]+)_/g, "$1").replace(/[ \t]+/g, (m) => (m.length > 1 ? "  " : " ")).trim();
}
