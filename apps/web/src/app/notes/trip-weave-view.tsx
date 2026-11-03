"use client";

/**
 * The trip weave (step 8): the places of this trip on one small map, a thread between two places
 * for each source they share (Bird reaches both Asakusa and Ueno). Places with nothing shared stand
 * alone — that is said, not hidden.
 */
import { LazyMotion, domMax, m } from "motion/react";
import { fitPlaces, spread, tripWeave, type WeavePlace } from "@/lib/trip-weave";
import { dict, useDict, useLang } from "../i18n";

const W = 720;
const H = 320;

const L = dict({
  ja: {
    title: "旅の糸",
    sub: "同じ資料が語る場所どうしを、糸で結ぶ（位置は略図）",
    shared: (n: number) => `共有する資料 ${n}`,
    alone: "まだ、ほかの場所と共有する資料はありません。",
    one: "二つ目の場所を紡ぐと、旅の糸が結ばれます。",
  },
  en: {
    title: "The threads of your trip",
    sub: "places joined by the sources that tell of both (a sketch map)",
    shared: (n: number) => `${n} shared source${n === 1 ? "" : "s"}`,
    alone: "No source is shared with another place yet.",
    one: "Weave a second place and the threads of your trip are tied.",
  },
});

export function TripWeave({ input, titles }: { input: WeavePlace[]; titles: Record<string, string> }) {
  const l = useDict(L);
  const lang = useLang();
  const { places, threads } = tripWeave(input);
  if (places.length === 0) return null;
  const f = fitPlaces(places, W, H);
  const pts = spread(places.map(f), W, H);
  const at = new Map(places.map((p, i) => [p.id, pts[i]]));
  return (
    <LazyMotion features={domMax} strict>
      <section className="flex flex-col gap-3 border-t border-rule pt-6" aria-label={l.title} data-testid="trip-weave">
        <div>
          <p className="label">{l.title}</p>
          <p className="mt-0.5 text-caption text-muted">{l.sub}</p>
        </div>
        {places.length > 1 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={l.title}>
            {threads.map((t, i) => {
              const a = at.get(t.a)!;
              const b = at.get(t.b)!;
              // one strand per shared source, fanned a little, like threads of one weave
              return t.sources.map((sid, k) => {
                const bend = 28 + k * 14;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 - bend;
                return (
                  <m.path
                    key={`${i}:${sid}`}
                    d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                    fill="none"
                    stroke="var(--thread-toki)"
                    strokeOpacity={0.85 - k * 0.12}
                    strokeWidth={1.4}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, delay: 0.15 * (i + k) }}
                  >
                    <title>{titles[sid] ?? sid}</title>
                  </m.path>
                );
              });
            })}
            {places.map((p) => {
              const { x, y } = at.get(p.id)!;
              return (
                <a key={p.id} href={`/note/${p.noteId}`}>
                  <circle cx={x} cy={y} r={5} fill="var(--paper)" />
                  <text x={x} y={y + 22} textAnchor="middle" fontSize={15} fill="var(--paper)" fontFamily="var(--font-serif)">
                    {p.name[lang]}
                  </text>
                </a>
              );
            })}
          </svg>
        )}
        {places.length === 1 && <p className="text-small text-muted">{l.one}</p>}
        {places.length > 1 && threads.length === 0 && <p className="text-small text-muted">{l.alone}</p>}
        {threads.length > 0 && (
          <ul className="flex flex-col gap-1 text-caption text-muted">
            {threads.map((t) => {
              const a = places.find((p) => p.id === t.a)!;
              const b = places.find((p) => p.id === t.b)!;
              return (
                <li key={`${t.a}-${t.b}`}>
                  <span className="text-paper">
                    {a.name[lang]} — {b.name[lang]}
                  </span>
                  {"　"}
                  {l.shared(t.sources.length)}
                  {lang === "ja" ? "：" : ": "}
                  {t.sources.map((s) => titles[s] ?? s).join(lang === "ja" ? "、" : ", ")}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </LazyMotion>
  );
}
