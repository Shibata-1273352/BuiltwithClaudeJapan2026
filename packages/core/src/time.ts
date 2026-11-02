/**
 * Time and existence (REQUIREMENTS.md 4.5). Pure functions, unit-tested.
 *
 * - Every time is a closed Gregorian date range [start, end] (ISO yyyy-mm-dd) derived from its
 *   precision. Lunisolar dates are converted when the data is written and keep their original text.
 * - Existence is judged against verified event dates only. An event's own uncertainty (e.g. sources
 *   disagreeing on the day) is a boundary zone where the answer is "unknown".
 * - Gaps without data are never "absent".
 */

export type Precision = "day" | "month" | "year" | "range" | "unknown";
export type TimeValueKind = "observed_at" | "written_at" | "first_published_at" | "edition_published_at" | "depicted_at" | "event_at";

export type TimeValue = {
  kind: TimeValueKind;
  precision: Precision;
  start: string | null; // "1878", "1878-06", "1878-06-09"
  end?: string | null; // for range precision
  original?: string; // e.g. "慶応元年（1865）12月12日"
  calendar?: "gregorian" | "japanese_lunisolar";
  evidence: string[]; // passage ids
  basis?: "stated" | "derived" | "estimated";
};

export type DateRange = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Expand a partial date to the first or last day it covers. */
export function expand(partial: string, side: "start" | "end"): string {
  const [y, m, d] = partial.split("-").map(Number);
  if (d) return `${y}-${pad(m)}-${pad(d)}`;
  if (m) return side === "start" ? `${y}-${pad(m)}-01` : `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
  return side === "start" ? `${y}-01-01` : `${y}-12-31`;
}

export function toRange(t: Pick<TimeValue, "precision" | "start" | "end">): DateRange | null {
  if (t.precision === "unknown" || !t.start) return null;
  return { start: expand(t.start, "start"), end: expand(t.end ?? t.start, "end") };
}

/** moved_in: the structure was moved to this site (it existed elsewhere before, e.g. 根本中堂 from 喜多院). */
export type ExistenceEventKind = "built" | "rebuilt" | "destroyed" | "moved_in" | "temporary";

export type ExistenceEvent = {
  id: string;
  entity: string;
  event: ExistenceEventKind;
  /** All verified sources for this event; their union is the event's uncertainty zone. */
  time: DateRange;
  evidence: string[];
  note?: string;
  /** sources disagree on this event (kept unresolved, both sides stored as a Conflict) */
  disputed?: boolean;
};

export type Period = { state: "present" | "absent"; start: string; end: string; from: string[]; to: string[] };

/**
 * Turn events into verified present/absent periods. Between an event's start and end (the zone
 * where sources disagree or precision is coarse) nothing is asserted. Temporary structures do
 * not make the permanent structure "present" (4.5.2: 恒久的な雷門).
 */
export function periodsFrom(events: ExistenceEvent[], now = new Date().toISOString().slice(0, 10)): Period[] {
  const ev = events.filter((e) => e.event !== "temporary").sort((a, b) => a.time.start.localeCompare(b.time.start));
  const out: Period[] = [];
  // Before it was first built (or moved here) the structure was not at this site.
  if (ev[0] && (ev[0].event === "built" || ev[0].event === "moved_in"))
    out.push({ state: "absent", start: "0001-01-01", end: dayBefore(ev[0].time.start), from: [], to: [ev[0].id] });
  for (let i = 0; i < ev.length; i++) {
    const cur = ev[i];
    const next = ev[i + 1];
    const state = cur.event === "destroyed" ? "absent" : "present";
    // A period starts after the event zone and ends before the next event zone.
    const start = dayAfter(cur.time.end);
    // the open-ended last period runs through the end of the current year (a year-precision
    // question about "this year" must be answerable)
    const end = next ? dayBefore(next.time.start) : `${now.slice(0, 4)}-12-31`;
    if (start <= end) out.push({ state, start, end, from: [cur.id], to: next ? [next.id] : [] });
  }
  return out;
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dayAfter = (iso: string) => shift(iso, 1);
const dayBefore = (iso: string) => shift(iso, -1);

export type ExistenceValue = "present" | "absent" | "unknown";

export type ExistenceJudgment = {
  value: ExistenceValue;
  /** The period the time falls in (present/absent), for "go to the evidence" (RAG-06). */
  period?: Period;
  reason: "inside_present" | "inside_absent" | "boundary" | "sources_disagree" | "no_data" | "no_time";
  /** the disputed event whose uncertainty zone the time falls into */
  disputedEvent?: string;
};

/**
 * Judge whether the (permanent) structure existed during `range` (a source's time).
 * Pass `events` to tell a disputed event ("sources disagree on the date") from an ordinary boundary.
 */
export function judgeExistence(periods: Period[], range: DateRange | null, events: ExistenceEvent[] = []): ExistenceJudgment {
  if (!range) return { value: "unknown", reason: "no_time" };
  const disputed = events.find((e) => e.disputed && e.event !== "temporary" && range.start <= e.time.end && range.end >= e.time.start);
  if (disputed) return { value: "unknown", reason: "sources_disagree", disputedEvent: disputed.id };
  for (const p of periods) {
    if (range.start >= p.start && range.end <= p.end) {
      return { value: p.state, period: p, reason: p.state === "present" ? "inside_present" : "inside_absent" };
    }
  }
  // Inside the known history but not inside one period: it touches an event's uncertainty zone.
  const first = periods.reduce((m, p) => (p.start < m ? p.start : m), "9999-12-31");
  const last = periods.reduce((m, p) => (p.end > m ? p.end : m), "0000-01-01");
  const overlaps = periods.some((p) => range.start <= p.end && range.end >= p.start);
  const withinHistory = range.end >= first && range.start <= last;
  return { value: "unknown", reason: overlaps || withinHistory ? "boundary" : "no_data" };
}

/**
 * Temporary structures are tracked as individual events, never as a continuous period: a source
 * only says a temporary gate was put up in a given year, not that one stood throughout.
 * Returns the temporary events whose dates overlap the range; otherwise "unknown" (not "absent").
 */
export function temporaryAt(events: ExistenceEvent[], range: DateRange | null): { value: "built_that_time" | "unknown"; events: string[] } {
  if (!range) return { value: "unknown", events: [] };
  const hit = events.filter((e) => e.event === "temporary" && range.start <= e.time.end && range.end >= e.time.start).map((e) => e.id);
  return hit.length ? { value: "built_that_time", events: hit } : { value: "unknown", events: [] };
}

/** Time hierarchy keys (4.4.8): year, decade, and Japanese era for a date. */
export function timeKeys(iso: string): { year: number; decade: string; era: string } {
  const y = Number(iso.slice(0, 4));
  const md = iso.slice(5);
  const eras: [string, string, string][] = [
    ["令和", "2019-05-01", "9999-12-31"],
    ["平成", "1989-01-08", "2019-04-30"],
    ["昭和", "1926-12-25", "1989-01-07"],
    ["大正", "1912-07-30", "1926-12-24"],
    ["明治", "1868-01-25", "1912-07-29"], // 明治元年1月1日 = 1868-01-25 (gregorian)
    ["江戸", "1603-03-24", "1868-01-24"],
  ];
  const era = eras.find(([, s, e]) => iso >= s && iso <= e)?.[0] ?? "不明";
  void md;
  return { year: y, decade: `${Math.floor(y / 10) * 10}s`, era };
}
