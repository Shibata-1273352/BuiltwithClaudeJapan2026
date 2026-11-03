"use client";

/**
 * 言の地層 (FR-24, FR-27) on Hiroshige's print: the names each source used, stacked as strata from
 * the near to the far, and each one, touched, lands on what it names in the 1856 picture — the
 * lantern you stand under, the red gate deep in the snow, the great roof beyond. Bird's "Ni-ô"
 * lands on the far gate, not on Kaminarimon. Which entity a name means comes from the reviewed
 * dictionary (the names event); where that entity is in the print is a hand annotation
 * (corpus/print-regions.json), said as such. The quote is the source's own sentence.
 */
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { pluck } from "@/lib/live/feel";
import printRegions from "../../../../../corpus/print-regions.json";
import { dict, useDict, useLang } from "../i18n";
import { splitAtName, type NamesData, type NameUsage } from "../names-layer";
import { Button } from "../ui/button";

type Region = { boxes: number[][]; where: { ja: string; en: string } };
type Print = { title: { ja: string; en: string }; annotated_by: string; regions: Record<string, Region> };
const PRINTS = (printRegions as unknown as { prints: Record<string, Print> }).prints;
/** A print with annotated regions (else the plain list is shown). */
export const hasPrintRegions = (id: string | undefined | null): id is string => Boolean(id && PRINTS[id]);
/** near → far, the order a visitor walks into the picture */
const DEPTH = ["ent:kaminarimon", "ent:nakamise", "ent:hozomon", "ent:sensoji", "ent:kannon", "ent:asakusa"];

const L = dict({
  ja: {
    tour: "名をたどる",
    stop: "止める",
    hint: "呼び名に触れると、それが指すものが絵の中で光ります。",
    absent: "この絵には描かれていない",
    names: (n: number) => `${n} の呼び名`,
    means: (name: string) => `→ ${name}`,
    note: (by: string) => `絵の中の位置は手で囲んだ注記（${by}）。どの呼び名が何を指すかは辞書。`,
    ambiguous: "曖昧",
  },
  en: {
    tour: "Follow the names",
    stop: "Stop",
    hint: "Touch a name and what it names lights up in the picture.",
    absent: "not in this picture",
    names: (n: number) => `${n} name${n === 1 ? "" : "s"}`,
    means: (name: string) => `→ ${name}`,
    note: (by: string) => `Places in the picture are hand annotations (${by}); which name means what comes from the dictionary.`,
    ambiguous: "ambiguous",
  },
});

type Hot = { ent: string; i: number };

export function NamesLoom({ names, artifact }: { names: NamesData; artifact: string }) {
  const l = useDict(L);
  const lang = useLang();
  const print = PRINTS[artifact];
  const [hot, setHot] = useState<Hot | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pic = useRef<HTMLDivElement>(null);
  const chips = useRef(new Map<string, HTMLElement>());

  const strata = Object.entries(names)
    .filter(([, g]) => g.usages.length > 0)
    .sort(([a], [b]) => {
      const ia = DEPTH.indexOf(a);
      const ib = DEPTH.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  /** light a name: its region in the print, and a thread from the chip to it (measured now, in the handler) */
  const light = (h: Hot | null, sound = true) => {
    setHot(h);
    const reg = h ? print?.regions[h.ent] : undefined;
    const chip = h ? chips.current.get(`${h.ent}:${h.i}`) : undefined;
    if (!h || !reg || !chip || !wrap.current || !pic.current) return setLine(null);
    const o = wrap.current.getBoundingClientRect();
    const p = pic.current.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const [x1, y1, x2, y2] = reg.boxes[0];
    const bx = p.left - o.left + ((x1 + x2) / 2) * p.width;
    const by = p.top - o.top + ((y1 + y2) / 2) * p.height;
    const cx = c.left - o.left;
    const cy = c.top - o.top + c.height / 2;
    const mx = (bx + cx) / 2;
    setLine(`M ${cx} ${cy} C ${mx} ${cy} ${mx} ${by} ${bx} ${by}`);
    if (sound) pluck(220 + DEPTH.indexOf(h.ent) * 90);
  };

  // 「名をたどる」: near to far, one name each
  useEffect(() => {
    if (!touring) return;
    const stops = strata.filter(([id]) => print?.regions[id]).map(([id]) => id);
    let k = 0;
    const next = () => {
      light({ ent: stops[k % stops.length], i: 0 });
      k++;
      if (k > stops.length) {
        setTouring(false);
        light(null, false);
      }
    };
    next();
    const t = setInterval(next, 2400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the tour runs over the strata as shown when it starts
  }, [touring]);

  const g = hot ? names[hot.ent] : undefined;
  const u: NameUsage | undefined = hot && g ? g.usages[hot.i] : undefined;
  const reg = hot ? print?.regions[hot.ent] : undefined;
  if (!print) return null;

  return (
    <div ref={wrap} className="relative grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" data-testid="names-loom">
      {/* the print, the regions */}
      <div className="flex flex-col gap-3">
        <div ref={pic} className="relative mx-auto h-[min(48vh,30rem)] max-w-full lg:h-[min(60vh,40rem)] overflow-hidden rounded-md" style={{ aspectRatio: "1399 / 2048" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- public-domain print */}
          <img src={`/api/cache/artifacts/${artifact}/image.jpg`} alt={print.title[lang]} className="size-full" />
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <defs>
              <mask id="names-dim">
                <rect width="1" height="1" fill="white" />
                {reg?.boxes.map(([x1, y1, x2, y2], i) => <rect key={i} x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="black" />)}
              </mask>
            </defs>
            <rect width="1" height="1" fill="var(--ai-night)" opacity={reg ? 0.62 : 0} mask="url(#names-dim)" style={{ transition: "opacity 400ms" }} />
            {reg?.boxes.map(([x1, y1, x2, y2], i) => (
              <rect key={i} x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke="var(--thread-koto)" strokeWidth={0.004} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>
        <AnimatePresence mode="wait">
          {u && g ? (
            <m.figure key={`${hot!.ent}:${hot!.i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-l-2 border-koto pl-4" data-testid="names-landing">
              <p className="font-serif text-lead">
                <span lang={u.lang}>「{u.text}」</span>
                <span className="ml-2 text-small text-muted">
                  {u.sourceTitle}
                  {u.time ? ` ${u.time.slice(0, 4)}` : ""}
                </span>
              </p>
              <p className="mt-1 text-small">
                {l.means(g.name?.[lang] ?? hot!.ent)} <span className="text-muted">— {reg ? reg.where[lang] : l.absent}</span>
              </p>
              <blockquote className="mt-2 line-clamp-3 font-serif text-small text-paper/80" lang={u.lang}>
                {(() => {
                  const [a, b, c] = splitAtName(u.sentence, u.text, u.start);
                  return (
                    <>
                      {a}
                      <mark className="bg-transparent text-koto">{b}</mark>
                      {c}
                    </>
                  );
                })()}
              </blockquote>
            </m.figure>
          ) : (
            <p className="text-caption text-muted">{l.hint}</p>
          )}
        </AnimatePresence>
      </div>

      {/* the strata of names */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="label">{print.title[lang]}</p>
          <Button variant={touring ? "secondary" : "primary"} onClick={() => setTouring((t) => !t)} data-testid="names-tour">
            {touring ? l.stop : l.tour}
          </Button>
        </div>
        <ol className="flex flex-col">
          {strata.map(([id, grp]) => {
            const r = print.regions[id];
            return (
              <li key={id} className={`border-t border-rule py-3 transition-opacity ${hot && hot.ent !== id ? "opacity-50" : ""}`}>
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-body">{grp.name?.[lang] ?? id}</span>
                  <span className="text-caption text-muted">{r ? r.where[lang] : l.absent}</span>
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {grp.usages.slice(0, 8).map((x, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) chips.current.set(`${id}:${i}`, el);
                          else chips.current.delete(`${id}:${i}`);
                        }}
                        onPointerEnter={() => light({ ent: id, i })}
                        onFocus={() => light({ ent: id, i })}
                        onClick={() => {
                          setTouring(false);
                          light({ ent: id, i });
                        }}
                        aria-pressed={hot?.ent === id && hot.i === i}
                        className="min-h-11 text-left"
                        data-testid="names-chip"
                      >
                        <span lang={x.lang} className={`${x.lang === "ja" ? "font-serif" : "font-serif italic"} text-lead ${hot?.ent === id && hot.i === i ? "text-koto" : "text-paper"}`}>
                          {x.text}
                        </span>
                        <span className="ml-1 text-caption text-muted">
                          {x.time ? x.time.slice(0, 4) : ""}
                          {x.specificity === "ambiguous" ? ` · ${l.ambiguous}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-muted">{l.note(print.annotated_by)}</p>
      </div>

      {/* the thread from the name to what it names */}
      <svg className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block" aria-hidden>
        {line && <m.path key={line} d={line} fill="none" stroke="var(--thread-koto)" strokeWidth={1.4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45 }} />}
      </svg>
    </div>
  );
}
