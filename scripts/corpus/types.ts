export type Ruby = { base: string; reading: string; offset: number };

export type ParsedParagraph = { text: string; ruby?: Ruby[]; notes?: string[] };

export type ParsedChapter = {
  label: string;
  /** front matter, body text, or back-of-book index (index chapters are excluded from evidence search). */
  kind: "front" | "body" | "index";
  paragraphs: ParsedParagraph[];
};

export type ParsedBook = { chapters: ParsedChapter[]; transforms: string[] };
