/**
 * Retrievers A (named entities) and B (relation vocabulary) + RRF fusion (REQUIREMENTS.md 4.4.5).
 * All SQL is static and parameterized; terms are bound values, never query text (ASI02).
 * Short Japanese terms (<= 2 chars) use a full scan because trigram FTS cannot match them.
 */
import { needsFullScan, normalizeForSearch } from "@tsumugi/core";
import type { DB } from "./db";

export type Lang = "en" | "ja";
export type Channel = "A" | "B";

export type Candidate = {
  passageId: string;
  sourceId: string;
  lang: Lang;
  chapterLabel: string;
  text: string;
  channel: Channel;
  rank: number;
  score: number;
  matched: string[];
};

export const LIMITS = { termsPerQuery: 12, termLength: 40, perChannel: 50 } as const;

function checkTerms(terms: string[]): string[] {
  if (terms.length > LIMITS.termsPerQuery) throw new Error(`too many terms (max ${LIMITS.termsPerQuery})`);
  return terms.map((t) => {
    const n = normalizeForSearch(t);
    if (!n || n.length > LIMITS.termLength) throw new Error("invalid term");
    return n;
  });
}

/** FTS5 phrase literal: the whole term is one quoted phrase; embedded quotes are doubled. */
function phrase(t: string): string {
  return `"${t.replace(/"/g, '""')}"`;
}

type Row = { passage_id: string; source_id: string; lang: Lang; label: string; text: string; score: number };

const BASE_SELECT = `SELECT p.id AS passage_id, p.source_id, p.lang, c.label, p.text`;
const JOIN = `JOIN chapters c ON c.source_id = p.source_id AND c.idx = p.chapter`;

/** A: passages containing any of the entity names (each name searched separately, scores summed). */
export function searchEntities(
  db: DB,
  terms: string[],
  lang: Lang,
  { limit = LIMITS.perChannel, useHeader = true }: { limit?: number; useHeader?: boolean } = {},
): Candidate[] {
  const norms = checkTerms(terms);
  const acc = new Map<string, { row: Row; score: number; matched: Set<string> }>();
  const ftsStmt = db.prepare(
    `${BASE_SELECT}, -bm25(fts_${lang}) AS score FROM fts_${lang} JOIN passages p ON p.id = fts_${lang}.passage_id ${JOIN}
     WHERE fts_${lang} MATCH ? AND p.kind != 'index' ORDER BY score DESC LIMIT ?`,
  );
  // Context headers (FR-54) are searchable but weigh less than the passage itself; RAG-12 turns them off.
  const hay = useHeader ? "(p.norm || ' ' || coalesce(p.header, ''))" : "p.norm";
  const scanStmt = db.prepare(
    `${BASE_SELECT}, (length(p.norm) - length(replace(p.norm, ?, ''))) * 1.0 / length(?) + (instr(${hay}, ?) > 0) * 0.1 AS score
     FROM passages p ${JOIN}
     WHERE p.lang = ? AND p.kind != 'index' AND instr(${hay}, ?) > 0 ORDER BY score DESC LIMIT ?`,
  );
  const cols = useHeader ? "{norm header}" : "norm";
  norms.forEach((t, i) => {
    const rows = (
      lang === "ja" && needsFullScan(t)
        ? scanStmt.all(t, t, t, lang, t, limit)
        : ftsStmt.all(`${cols} : ${phrase(t)}`, limit)
    ) as Row[];
    for (const r of rows) {
      const e = acc.get(r.passage_id) ?? { row: r, score: 0, matched: new Set<string>() };
      e.score += r.score;
      e.matched.add(terms[i]);
      acc.set(r.passage_id, e);
    }
  });
  return rank(acc, "A", limit);
}

/**
 * B: co-occurrence of two vocabularies in one passage (e.g. Asakusa × temple, 浅草 × 観音).
 * Co-occurrence is a candidate signal only, not evidence of a relation (4.4.5).
 */
export function searchRelation(db: DB, left: string[], right: string[], lang: Lang, limit: number = LIMITS.perChannel): Candidate[] {
  const L = checkTerms(left);
  const R = checkTerms(right);
  const stmt = db.prepare(
    `${BASE_SELECT}, p.norm AS norm FROM passages p ${JOIN}
     WHERE p.lang = ? AND p.kind != 'index' AND instr(p.norm, ?) > 0`,
  );
  const acc = new Map<string, { row: Row; score: number; matched: Set<string> }>();
  L.forEach((l, li) => {
    for (const r of stmt.all(lang, l) as (Row & { norm: string })[]) {
      const hits = R.map((x, ri) => [x, right[ri]] as const).filter(([x]) => r.norm.includes(x));
      if (!hits.length) continue;
      const near = Math.min(...hits.map(([x]) => distance(r.norm, l, x)));
      const e = acc.get(r.passage_id) ?? { row: { ...r, score: 0 }, score: 0, matched: new Set<string>() };
      e.score = Math.max(e.score, 1 / (1 + near / 40) + hits.length * 0.1);
      e.matched.add(left[li]);
      hits.forEach(([, orig]) => e.matched.add(orig));
      acc.set(r.passage_id, e);
    }
  });
  return rank(acc, "B", limit);
}

function distance(s: string, a: string, b: string): number {
  const ia: number[] = [];
  const ib: number[] = [];
  for (let i = s.indexOf(a); i >= 0; i = s.indexOf(a, i + 1)) ia.push(i);
  for (let i = s.indexOf(b); i >= 0; i = s.indexOf(b, i + 1)) ib.push(i);
  let best = Infinity;
  for (const x of ia) for (const y of ib) best = Math.min(best, Math.abs(x - y));
  return best;
}

function rank(acc: Map<string, { row: Row; score: number; matched: Set<string> }>, channel: Channel, limit: number): Candidate[] {
  return [...acc.values()]
    .sort((a, b) => b.score - a.score || a.row.passage_id.localeCompare(b.row.passage_id))
    .slice(0, limit)
    .map((e, i) => ({
      passageId: e.row.passage_id,
      sourceId: e.row.source_id,
      lang: e.row.lang,
      chapterLabel: e.row.label,
      text: e.row.text,
      channel,
      rank: i + 1,
      score: Math.round(e.score * 1000) / 1000,
      matched: [...e.matched],
    }));
}

/** Reciprocal Rank Fusion over channel result lists. */
export function rrf(lists: Candidate[][], k = 60): (Candidate & { rrf: number; channels: Channel[] })[] {
  const m = new Map<string, { c: Candidate; rrf: number; channels: Set<Channel>; matched: Set<string> }>();
  for (const list of lists) {
    for (const c of list) {
      const e = m.get(c.passageId) ?? { c, rrf: 0, channels: new Set<Channel>(), matched: new Set<string>() };
      e.rrf += 1 / (k + c.rank);
      e.channels.add(c.channel);
      c.matched.forEach((x) => e.matched.add(x));
      m.set(c.passageId, e);
    }
  }
  return [...m.values()]
    .sort((a, b) => b.rrf - a.rrf || a.c.passageId.localeCompare(b.c.passageId))
    .map((e) => ({ ...e.c, matched: [...e.matched], rrf: Math.round(e.rrf * 1e5) / 1e5, channels: [...e.channels] }));
}
