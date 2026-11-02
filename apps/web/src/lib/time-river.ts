/**
 * Time river and time slider logic (REQUIREMENTS.md FR-23, FR-56, RAG-11). Pure; used by the UI
 * and the tests. Judgments reuse the same core functions as the server, so they cannot diverge.
 */
import { absenceReason, DISPUTED_WHAT, judgeExistence, temporaryAt, toRange, type ExistenceEvent, type Period } from "@tsumugi/core";

export type TimelineData = {
  entity: string;
  name?: { ja: string; en: string };
  periods: Period[];
  events: (Pick<ExistenceEvent, "id" | "event" | "time" | "evidence" | "disputed"> & { original?: string })[];
  sources: { source: string; title: string; time: { kind: string; start: string | null; end?: string | null } | null; relation: string | null; value: string; reason: string }[];
};

export type YearState = {
  year: number;
  /** what the thread shows: intact (present), broken (absent), faint (unknown / withheld) */
  state: "present" | "absent" | "unknown" | "withheld";
  temporary: boolean;
  label: { ja: string; en: string };
  /** evidence to jump to (RAG-06): the events bounding the period */
  evidence: string[];
};

export function yearState(d: TimelineData, year: number): YearState {
  const range = toRange({ precision: "year", start: String(year) });
  const j = judgeExistence(d.periods, range, d.events as ExistenceEvent[]);
  const tmp = temporaryAt(d.events as ExistenceEvent[], range);
  const n = d.name ?? { ja: "門", en: "the gate" };
  const evidence = j.period ? [...j.period.from, ...j.period.to] : j.disputedEvent ? [j.disputedEvent] : [];
  if (j.value === "present") {
    return { year, state: "present", temporary: false, evidence, label: { ja: `${year}年：${n.ja}はあった`, en: `${year}: ${n.en} stood` } };
  }
  if (j.value === "absent") {
    const t = tmp.value === "built_that_time";
    const ev = d.events as ExistenceEvent[];
    const permanent = ev.some((e) => e.event === "temporary");
    const why = absenceReason(
      ev.find((e) => j.period?.from.includes(e.id)),
      ev.find((e) => j.period?.to.includes(e.id)),
      n,
      permanent,
    );
    return {
      year,
      state: "absent",
      temporary: t,
      evidence,
      label: {
        ja: `${year}年：${why.ja}${t ? "（この年、仮設の門が設けられた）" : ""}`,
        en: `${year}: ${why.en}${t ? " (a temporary gate was put up this year)" : ""}`,
      },
    };
  }
  if (j.reason === "sources_disagree") {
    const what = DISPUTED_WHAT[(d.events as ExistenceEvent[]).find((e) => e.id === j.disputedEvent)?.event ?? "destroyed"] ?? DISPUTED_WHAT.destroyed;
    return {
      year,
      state: "withheld",
      temporary: false,
      evidence,
      label: { ja: `${year}年：判定保留（${what.ja}が史料間で一致しない）`, en: `${year}: withheld (sources disagree on ${what.en})` },
    };
  }
  return {
    year,
    state: "unknown",
    temporary: false,
    evidence,
    label: {
      ja: `${year}年：${j.reason === "no_data" ? "この時期の記録は登録されていない" : "この年に建造・焼失・再建・移築のいずれかがあり、年単位では確かめられない"}`,
      en: `${year}: ${j.reason === "no_data" ? "no records for this period" : "it was built, destroyed, rebuilt or moved this year; cannot be confirmed at year precision"}`,
    },
  };
}

export type Segment = { start: number; end: number; kind: "present" | "absent" | "unknown" };

/** River segments in fractional years over [from, to]: verified periods, and unknown elsewhere. */
export function segments(d: TimelineData, from: number, to: number): Segment[] {
  const y = (iso: string) => {
    const [Y, M = 1, D = 1] = iso.split("-").map(Number);
    return Y + ((M - 1) * 30.44 + (D - 1)) / 365.25;
  };
  const out: Segment[] = [];
  let cursor = from;
  for (const p of [...d.periods].sort((a, b) => a.start.localeCompare(b.start))) {
    const s = Math.max(from, y(p.start));
    const e = Math.min(to, y(p.end) + 1 / 365.25);
    if (e <= from || s >= to) continue;
    if (s > cursor) out.push({ start: cursor, end: s, kind: "unknown" });
    out.push({ start: s, end: e, kind: p.state });
    cursor = e;
  }
  if (cursor < to) out.push({ start: cursor, end: to, kind: "unknown" });
  return out;
}

/**
 * Assign labels to rows so that labels closer than `minGap` (in x units) never share a row.
 * Greedy, in x order. Returns the row index per input item.
 */
export function labelRows(xs: number[], minGap: number): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const lastX: number[] = [];
  const rows = new Array<number>(xs.length);
  for (const [x, i] of order) {
    let r = lastX.findIndex((lx) => x - lx >= minGap);
    if (r < 0) r = lastX.length;
    lastX[r] = x;
    rows[i] = r;
  }
  return rows;
}

/** Year of a source's time, for markers on the river. */
export function sourceYear(t: TimelineData["sources"][number]["time"]): number | null {
  return t?.start ? Number(t.start.slice(0, 4)) : null;
}
