"use client";

/**
 * 時をめくる (FR-23, FR-56) as a window, not a chart: the photo with the gate's SAM 3 cut-outs.
 * Turn the river and the gate burns away at its fire, stands as a dashed outline while only a
 * temporary gate stood, rises again when it was rebuilt; before the fire Hiroshige's print fills
 * the window. The writer who came in that year speaks in their own words (the passage of the
 * evidence card), with what code judged. 「時を流す」 plays the years, stopping at each event and
 * each writer. Every year and word comes from the reviewed timeline and the sources — none typed,
 * none written by Claude. The river is a native range input (keyboard, screen readers, scripts).
 */
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pluck } from "@/lib/live/feel";
import type { SourceCard } from "@/lib/live/state";
import { presentPeriodAround, segments, sourceYear, yearState, type TimelineData } from "@/lib/time-river";
import { dict, useDict, useLang } from "../i18n";
import { Button } from "../ui/button";

const FROM = 1750;
const TO = 2026;
const GATE = ["gate", "lantern", "lantern_base"];

type Scene = { size: [number, number]; elements: Record<string, { bbox: [number, number, number, number]; png: string }>; alignment?: { ok?: boolean; overlay?: string; artifact?: string } };

const EVENT: Record<string, { ja: string; en: string }> = {
  destroyed: { ja: "焼失", en: "burned" },
  rebuilt: { ja: "再建", en: "rebuilt" },
  built: { ja: "建立", en: "built" },
  moved_in: { ja: "移築", en: "moved here" },
  temporary: { ja: "仮設の門", en: "a temporary gate" },
};

const L = dict({
  ja: {
    play: "時を流す",
    stop: "止める",
    river: "時の川（つまんで動かす）",
    now: "いま",
    came: (y: number) => `${y}年、この場所を書いた人`,
    judged: { present: "その年、門はあった", absent: "その年、門はなかった", unknown: "判定保留" } as Record<string, string>,
    byCode: "判定は年表との照合（コード）。原文は資料のまま。",
    temporary: "仮設の門",
    print: "広重がこの年に見た門",
    events: "この門の出来事",
  },
  en: {
    play: "Let the years flow",
    stop: "Stop",
    river: "River of time (drag it)",
    now: "now",
    came: (y: number) => `${y}: someone who wrote about this place`,
    judged: { present: "that year, the gate stood", absent: "that year, the gate was gone", unknown: "held" } as Record<string, string>,
    byCode: "Judged against the timeline by code. The words are the source's own.",
    temporary: "a temporary gate",
    print: "the gate as Hiroshige saw it",
    events: "What happened to this gate",
  },
});

export function TimeTurn({ data, sceneId, scene, photo, cards }: { data: TimelineData; sceneId: string | null; scene: Scene | null; photo: string | null; cards: SourceCard[] }) {
  const l = useDict(L);
  const lang = useLang();
  const [year, setYear] = useState(TO);
  const [playing, setPlaying] = useState(false);
  const ys = yearState(data, year);
  const segs = useMemo(() => segments(data, FROM, TO), [data]);
  const events = useMemo(
    () => data.events.map((e) => ({ ...e, year: Number((e.time.start ?? "").slice(0, 4)) })).filter((e) => e.year >= FROM && e.year <= TO).sort((a, b) => a.year - b.year),
    [data],
  );
  const writers = useMemo(
    () =>
      data.sources
        .map((s) => ({ ...s, year: sourceYear(s.time) }))
        .filter((s): s is typeof s & { year: number } => s.year !== null && s.year >= FROM && s.year <= TO)
        .sort((a, b) => a.year - b.year),
    [data],
  );
  const stops = useMemo(() => [...new Set([...events.map((e) => e.year), ...writers.map((w) => w.year)])].sort((a, b) => a - b), [events, writers]);
  const writer = writers.filter((w) => Math.abs(w.year - year) <= 3).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0] ?? null;
  const card = writer ? cards.find((c) => c.sourceId === writer.source) : undefined;
  const lastEvent = [...events].reverse().find((e) => e.year <= year) ?? null;

  // the gate's state, and how we got here (a fire burns it away; a rebuild raises it)
  const stood = ys.state === "present";
  const prevStood = useRef(stood);
  const [change, setChange] = useState<"burn" | "rise" | null>(null);
  useEffect(() => {
    if (prevStood.current === stood) return;
    const c = stood ? "rise" : "burn";
    prevStood.current = stood;
    const t0 = setTimeout(() => setChange(c), 0);
    pluck(stood ? 260 : 900); // a high note when it rises, a low one when it burns
    const t1 = setTimeout(() => setChange(null), 900);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [stood]);

  // 「時を流す」: 1750 → now, holding at each event and writer
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let y = year >= TO - 1 ? FROM : year;
    let hold = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (hold > 0) hold -= dt;
      else {
        const next = stops.find((s) => s > y + 0.01);
        const speed = reduced ? Infinity : 26; // years per second
        const ny = Math.min(next ?? TO, y + (speed * dt) / 1000);
        if (next !== undefined && ny >= next) {
          y = next;
          hold = 1300;
        } else y = ny;
        setYear(Math.round(y));
        if (y >= TO) {
          setPlaying(false);
          return;
        }
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start from the year shown when play is pressed
  }, [playing, stops]);

  // the print the gate was painted in: shown while the same gate stood as in the print's own year
  const printYear = scene?.alignment?.artifact ? (writers.find((w) => w.source === scene.alignment!.artifact)?.year ?? null) : null;
  const printPeriod = printYear ? presentPeriodAround(data, printYear) : null;
  const before = Boolean(stood && printPeriod && year >= printPeriod.from && year <= printPeriod.to && scene?.alignment?.ok && scene.alignment.artifact && sceneId);
  const pos = (y: number) => `${((y - FROM) / (TO - FROM)) * 100}%`;
  const aspect = scene ? scene.size[0] / scene.size[1] : 3 / 4;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]" data-testid="time-turn">
      {/* the window */}
      <div className="relative mx-auto h-[min(50vh,32rem)] max-w-full overflow-hidden rounded-md bg-ink" style={{ aspectRatio: aspect }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- the visitor's (face-blurred) photo
          <img src={photo} alt="" className={`absolute inset-0 size-full object-cover transition-[filter] duration-700 ${stood ? "" : "brightness-[0.28] grayscale"}`} />
        )}
        {scene &&
          sceneId &&
          GATE.filter((k) => scene.elements[k]).map((k) => {
            const [x1, y1, x2, y2] = scene.elements[k].bbox;
            return (
              <m.div
                key={k}
                className="absolute"
                style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
                initial={false}
                animate={{ clipPath: stood ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" }}
                transition={{ duration: 0.7, ease: stood ? "easeOut" : "easeIn" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- SAM 3 cut-out */}
                <img src={`/api/cache/scenes/${sceneId}/${scene.elements[k].png}`} alt="" className="size-full" />
              </m.div>
            );
          })}
        {/* the burn line climbs as the gate goes; a paper line as it rises again */}
        <AnimatePresence>
          {change && scene?.elements.gate && (
            <m.div
              key={change}
              className={`pointer-events-none absolute right-0 left-0 h-[3px] ${change === "burn" ? "bg-lantern" : "bg-paper"}`}
              style={{ left: `${scene.elements.gate.bbox[0] * 100}%`, right: `${(1 - scene.elements.gate.bbox[2]) * 100}%` }}
              initial={{ top: change === "burn" ? `${scene.elements.gate.bbox[3] * 100}%` : `${scene.elements.gate.bbox[3] * 100}%`, opacity: 1 }}
              animate={{ top: `${scene.elements.gate.bbox[1] * 100}%`, opacity: change === "burn" ? [1, 1, 0] : [0.8, 0.8, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "linear" }}
            />
          )}
        </AnimatePresence>
        {/* only a temporary gate stood: its place, dashed */}
        {ys.temporary && scene?.elements.gate && (
          <div
            className="pointer-events-none absolute border border-dashed border-paper/60"
            style={{ left: `${scene.elements.gate.bbox[0] * 100}%`, top: `${scene.elements.gate.bbox[1] * 100}%`, width: `${(scene.elements.gate.bbox[2] - scene.elements.gate.bbox[0]) * 100}%`, height: `${(scene.elements.gate.bbox[3] - scene.elements.gate.bbox[1]) * 100}%` }}
          >
            <span className="absolute -top-6 left-0 text-caption text-paper/80">{l.temporary}</span>
          </div>
        )}
        {/* before the fire: the print the gate was painted in */}
        <AnimatePresence>
          {before && (
            <m.div key="print" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 0.92 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- public-domain print aligned to the photo */}
              <img src={`/api/cache/artifacts/${scene!.alignment!.artifact}/image.jpg`} alt="" className="size-full bg-ink object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/90 to-transparent px-4 pt-8 pb-3 text-caption text-paper/85">{l.print}</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* the year, what it means, who came */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <m.p key={year < TO ? "y" : "now"} className={`font-serif text-hero leading-none tabular-nums ${stood ? "text-paper" : "text-toki"}`} data-testid="time-year">
            {year}
          </m.p>
          <Button variant={playing ? "secondary" : "primary"} onClick={() => setPlaying((p) => !p)} data-testid="time-play">
            {playing ? l.stop : l.play}
          </Button>
        </div>
        <p className="font-serif text-title leading-snug" data-testid="time-label">
          {ys.label[lang]}
        </p>
        <AnimatePresence mode="wait">
          {writer && (
            <m.figure key={writer.source} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-l-2 border-rule-strong pl-4" data-testid="time-writer">
              <figcaption className="label">{l.came(writer.year)}</figcaption>
              <p className="mt-1 font-serif text-lead">{writer.title}</p>
              {card?.excerpt && !/^Title:/.test(card.excerpt) && (
                <blockquote className="mt-2 line-clamp-4 font-serif text-body text-paper/85" lang={card.lang}>
                  {card.excerpt}
                </blockquote>
              )}
              <p className={`mt-2 text-small ${writer.value === "absent" ? "text-toki" : "text-paper/80"}`}>{l.judged[writer.value] ?? writer.value}</p>
            </m.figure>
          )}
        </AnimatePresence>
        <div>
          <p className="label">{l.events}</p>
          <ol className="mt-2 flex flex-col gap-1 text-small">
            {events.map((e) => (
              <li key={e.id} className={`flex gap-3 tabular-nums transition-colors ${lastEvent?.id === e.id ? "text-paper" : "text-muted"}`}>
                <span className="w-12">{e.year}</span>
                <span>
                  {EVENT[e.event]?.[lang] ?? e.event}
                  {e.disputed ? " ※" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-caption text-muted">{l.byCode}</p>
      </div>

      {/* the river: drag it (a native range input over the drawing) */}
      <div className="relative h-20 lg:col-span-2">
        <div className="absolute inset-x-0 top-8 h-1.5">
          {segs.map((sg, i) => (
            <span
              key={i}
              className={`absolute inset-y-0 rounded-sm ${sg.kind === "present" ? "bg-toki/85" : sg.kind === "absent" ? "border-y border-dashed border-paper/35" : "bg-muted/25"}`}
              style={{ left: pos(sg.start), width: `calc(${pos(sg.end)} - ${pos(sg.start)})` }}
            />
          ))}
        </div>
        {events.filter((e, i) => i === 0 || e.year - events[i - 1].year >= 8).map((e) => (
          <span key={e.id} className="absolute top-11 -translate-x-1/2 text-caption whitespace-nowrap text-muted tabular-nums" style={{ left: pos(e.year) }}>
            {e.year}
          </span>
        ))}
        {writers.map((w) => (
          <span key={w.source} className="absolute top-5 size-2 -translate-x-1/2 rounded-sm bg-koto" style={{ left: pos(w.year) }} title={`${w.title} ${w.year}`} />
        ))}
        <span className="pointer-events-none absolute top-3 h-11 w-[3px] -translate-x-1/2 rounded-sm bg-lantern" style={{ left: pos(year) }} />
        <span className="absolute top-0 right-0 text-caption text-muted">{l.now}</span>
        <input
          type="range"
          min={FROM}
          max={TO}
          value={year}
          onChange={(e) => {
            setPlaying(false);
            setYear(Number(e.target.value));
          }}
          aria-label={l.river}
          aria-valuetext={`${year} ${ys.label[lang]}`}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
          data-testid="time-river-input"
        />
      </div>
    </div>
  );
}
