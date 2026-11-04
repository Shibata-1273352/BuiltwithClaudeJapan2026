"use client";

/**
 * 時の川・時をめくる (FR-23, FR-56, RAG-11, 6.2 screen 5).
 * The slider re-judges the permanent gate for any year with the same pure functions as the
 * server. The thread from today's gate is intact when it stood, breaks where it was absent,
 * and fades where the evidence cannot decide.
 */
import { useMemo, useState } from "react";
import { labelRows, segments, sourceYear, yearState, type TimelineData } from "@/lib/time-river";
import { dict, useDict, useLang } from "./i18n";

const FROM = 1750;
const TO = 2030;
const W = 1000;
const X0 = 40;
const XW = 920;
const RIVER_Y = 132;
const x = (year: number) => X0 + ((year - FROM) / (TO - FROM)) * XW;

const SHORT: Record<string, { ja: string; en: string }> = {
  "met-56689": { ja: "広重", en: "Hiroshige" },
  "bird-unbeaten": { ja: "バード", en: "Bird" },
  "kafu-hiyorigeta": { ja: "荷風", en: "Kafū" },
  "koun-kaiko": { ja: "光雲", en: "Kōun" },
  "scidmore-jinrikisha": { ja: "シドモア", en: "Scidmore" },
  "met-37282": { ja: "広重", en: "Hiroshige" },
  "met-37387": { ja: "安治", en: "Yasuji" },
  "met-45257": { ja: "清長", en: "Kiyonaga" },
};
const EVENT_LABEL: Record<string, { ja: string; en: string }> = {
  destroyed: { ja: "焼失", en: " destroyed" },
  rebuilt: { ja: "再建", en: " rebuilt" },
  built: { ja: "建立", en: " built" },
  built_elsewhere: { ja: "他所で建立", en: " built elsewhere" },
  moved_in: { ja: "移築", en: " moved here" },
  temporary: { ja: "仮設", en: " temporary" },
};
const T = dict({
  ja: {
    river: "時の川",
    title: "時をめくる",
    today: (name?: string) => `いまの${name ?? "門"}`,
    slider: "年を選ぶ",
    present: "あった",
    absent: "不在",
    withheld: "判定保留",
    unknown: "確認待ち",
    evidence: (name: string, list: string) => `根拠（${name}の年表との照合）：${list}`,
  },
  en: {
    river: "River of time",
    title: "Turn the years",
    today: (name?: string) => `${name ?? "The gate"} today`,
    slider: "Choose a year",
    present: "stood",
    absent: "absent",
    withheld: "withheld",
    unknown: "pending",
    evidence: (name: string, list: string) => `Evidence (checked against the chronology of ${name}): ${list}`,
  },
});
/** The demo years of Kaminarimon (6.1); other sites get the years of their sources and events. */
const QUICK_KAMINARIMON = [1856, 1866, 1878, 1905, 1914, 1960, 2026];
function quickYears(d: TimelineData): number[] {
  if (d.entity === "ent:kaminarimon") return QUICK_KAMINARIMON;
  const ys = [
    ...d.sources.map((s) => Number(s.time?.start?.slice(0, 4))),
    ...d.events.map((e) => Number(e.time.end.slice(0, 4)) + 1),
    new Date().getFullYear(),
  ].filter((y) => y >= FROM && y <= TO);
  return [...new Set(ys)].sort((a, b) => a - b).slice(0, 9);
}
// absent is a line style (dashed) in paper, not vermilion (CLAUDE.md design 4)
const COLOR = { present: "var(--thread-toki)", absent: "color-mix(in srgb, var(--paper) 55%, transparent)", unknown: "var(--muted)", withheld: "var(--muted)" } as const;

export function TimeRiver({ data, initialYear = 1856 }: { data: TimelineData; initialYear?: number }) {
  const t = useDict(T);
  const lang = useLang();
  const [year, setYear] = useState(initialYear);
  const segs = useMemo(() => segments(data, FROM, TO), [data]);
  const s = yearState(data, year);
  const sources = data.sources
    .map((src) => ({ ...src, y: sourceYear(src.time) }))
    .filter((src): src is typeof src & { y: number } => src.y !== null);
  const eventRows = useMemo(() => labelRows(data.events.map((e) => x(Number(e.time.start.slice(0, 4)))), 62), [data.events]);
  const sourceRows = labelRows(sources.map((src) => x(src.y)), 78);
  const evidenceText = s.evidence
    .map((id) => data.events.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => e!.original ?? e!.id);

  // thread from "today's gate" (top right) to the slider point on the river
  const gx = x(2026);
  const gy = 18;
  const px = x(year);
  const midX = (gx + px) / 2;
  const r = Math.min(36, Math.max(0, gx - px));
  /** horizontal at the top from x0, a curved corner, then straight down to the year marker */
  const drop = (x0: number) => (x0 - px > r ? `M ${x0} ${gy} H ${px + r} Q ${px} ${gy} ${px} ${gy + r} V ${RIVER_Y - 14}` : `M ${px} ${gy} V ${RIVER_Y - 14}`);
  const broken = s.state === "absent";

  return (
    <section className="flex flex-col gap-3" data-testid="time-river" aria-label={t.river}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="label">{t.title}</h3>
        <p className="font-serif text-display tabular-nums" aria-live="polite" data-testid="year">
          {year}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} 230`} className="w-full" role="img" aria-label={s.label[lang]}>
        {/* river */}
        {segs.map((g, i) => (
          <line
            key={i}
            x1={x(g.start)}
            x2={x(g.end)}
            y1={RIVER_Y}
            y2={RIVER_Y}
            stroke={COLOR[g.kind]}
            strokeWidth={g.kind === "present" ? 8 : 5}
            strokeDasharray={g.kind === "absent" ? "14 10" : g.kind === "unknown" ? "2 8" : undefined}
            strokeLinecap="round"
            opacity={g.kind === "unknown" ? 0.6 : 1}
          />
        ))}
        {/* decade ticks */}
        {[1750, 1800, 1850, 1900, 1950, 2000].map((t) => (
          <text key={t} x={x(t)} y={222} textAnchor="middle" fontSize="12" fill="var(--muted)">
            {t}
          </text>
        ))}
        {/* events below the river */}
        {data.events.map((e, i) => {
          const ey = Number(e.time.start.slice(0, 4));
          return (
            <g key={e.id}>
              <line x1={x(ey)} x2={x(ey)} y1={RIVER_Y + 8} y2={RIVER_Y + 22} stroke="var(--paper)" strokeWidth={1.5} />
              <text x={x(ey)} y={RIVER_Y + 36 + eventRows[i] * 14} textAnchor="middle" fontSize="12" fill="var(--paper)">
                {ey}
                {EVENT_LABEL[e.event]?.[lang] ?? e.event}
                {e.disputed ? "※" : ""}
              </text>
            </g>
          );
        })}
        {/* sources above the river */}
        {sources.map((src, i) => (
          <g key={src.source}>
            <circle cx={x(src.y)} cy={RIVER_Y - 22} r={6} fill={src.y === year ? "var(--lantern)" : "var(--thread-koto)"} />
            <text x={x(src.y)} y={RIVER_Y - 34 - sourceRows[i] * 15} textAnchor="middle" fontSize="13" fill="var(--paper)">
              {SHORT[src.source]?.[lang] ?? src.title.slice(0, 6)} {src.y}
            </text>
          </g>
        ))}
        {/* today's gate */}
        <text x={gx} y={gy - 4} textAnchor="end" fontSize="13" fill="var(--paper)">
          {t.today(data.name?.[lang])}
        </text>
        <circle cx={gx} cy={gy} r={5} fill="var(--thread-toki)" />
        {/* the thread: from today's gate along the top, then down to the chosen year (above every label) */}
        {broken ? (
          <g className="thread-break" data-testid="thread" data-state="broken">
            <path d={`M ${gx} ${gy} H ${midX + 14}`} stroke="var(--thread-toki)" strokeWidth={3} fill="none" />
            <path d={drop(midX - 14)} stroke="var(--thread-toki)" strokeWidth={3} fill="none" strokeDasharray="6 6" />
          </g>
        ) : (
          <path
            data-testid="thread"
            data-state={s.state === "present" ? "intact" : "faint"}
            d={drop(gx)}
            stroke={COLOR[s.state]}
            strokeWidth={s.state === "present" ? 3.5 : 2}
            strokeDasharray={s.state === "present" ? undefined : "3 7"}
            fill="none"
          />
        )}
        <line x1={px} x2={px} y1={RIVER_Y - 14} y2={RIVER_Y + 14} stroke="var(--lantern)" strokeWidth={3} />
      </svg>

      <input
        type="range"
        min={FROM}
        max={2026}
        step={1}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="min-h-11 w-full accent-[var(--thread-toki)]"
        aria-label={t.slider}
        data-testid="year-slider"
      />
      <div className="flex flex-wrap gap-2">
        {quickYears(data).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setYear(q)}
            className={`min-h-11 min-w-11 border-b-2 px-1 text-small tabular-nums ${q === year ? "border-paper text-paper" : "border-transparent text-muted hover:text-paper"}`}
          >
            {q}
          </button>
        ))}
      </div>

      <p className="text-body" data-testid="year-state" data-state={s.state}>
        <span className="mr-2 rounded-sm px-2 py-0.5 text-small" style={{ border: `1px solid ${COLOR[s.state]}`, color: COLOR[s.state] }}>
          {s.state === "present" ? t.present : s.state === "absent" ? t.absent : s.state === "withheld" ? t.withheld : t.unknown}
        </span>
        {s.label[lang]}
      </p>
      {evidenceText.length > 0 && (
        <p className="text-small text-muted">
          {t.evidence(data.name?.[lang] ?? "", evidenceText.join(" ／ "))}
        </p>
      )}
    </section>
  );
}
