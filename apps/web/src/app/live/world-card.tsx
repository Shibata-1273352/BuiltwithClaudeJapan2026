"use client";

/**
 * FR-25: the threads across space. From the photo's site, a thread to where each source comes from —
 * the print kept in New York, the traveller born in Yorkshire, the essayist of Tokyo. No coastlines:
 * a graticule and the places, so nothing on it is drawn that the data does not say.
 */
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { project, type WorldPoint } from "@/lib/world";
import { dict, useDict, useLang } from "../i18n";

const W = 560;
const H = 170;
// the band of the world where the threads run (Japan, Europe, North America)
const LAT_TOP = 70;
const LAT_BOT = -10;
const at = (p: { lat: number; lon: number }) => ({ x: project(p, W, H).x, y: ((LAT_TOP - p.lat) / (LAT_TOP - LAT_BOT)) * H });

const L = dict({
  ja: { title: "海を越える糸", sub: "資料が今ある場所、書き手の生まれた場所", held: "所蔵", origin: "生まれ", publisher: "発信", here: "ここ", km: (n: number) => `${n.toLocaleString("ja-JP")} km` },
  en: { title: "Threads across the sea", sub: "where the sources are kept, where their writers were born", held: "kept at", origin: "born in", publisher: "published by", here: "here", km: (n: number) => `${n.toLocaleString("en-US")} km` },
});

export function WorldCard({ entity, sourceIds, titles }: { entity: string; sourceIds: string[]; titles: Map<string, string> }) {
  const l = useDict(L);
  const lang = useLang();
  const key = `${entity}|${sourceIds.join(",")}`;
  const [data, setData] = useState<{ key: string; site: { lat: number; lon: number }; points: WorldPoint[] } | null>(null);
  useEffect(() => {
    let off = false;
    fetch(`/api/world?entity=${encodeURIComponent(entity)}&sources=${encodeURIComponent(sourceIds.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!off && j?.site) setData({ key, ...j });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [entity, sourceIds, key]);
  if (!data || data.key !== key) return null;
  const far = data.points.filter((p) => p.km >= 500);
  if (!far.length) return null;
  const s = at(data.site);
  // one mark per place (several sources can share The Met)
  const byPlace = new Map<string, WorldPoint[]>();
  for (const p of far) byPlace.set(`${p.lat},${p.lon}`, [...(byPlace.get(`${p.lat},${p.lon}`) ?? []), p]);
  return (
    <section className="flex flex-col gap-2" aria-label={l.title} data-testid="world-card">
      <div>
        <p className="label">{l.title}</p>
        <p className="mt-0.5 text-caption text-muted">{l.sub}</p>
      </div>
      <svg viewBox={`0 -24 ${W} ${H + 24}`} className="w-full" role="img" aria-label={l.title}>
        {/* graticule */}
        {[0, 30, 60].map((lat) => (
          <line key={lat} x1={0} x2={W} y1={at({ lat, lon: 0 }).y} y2={at({ lat, lon: 0 }).y} stroke="var(--muted)" strokeOpacity={lat === 0 ? 0.25 : 0.12} strokeWidth={0.6} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} y1={0} y2={H} x1={(i * W) / 12} x2={(i * W) / 12} stroke="var(--muted)" strokeOpacity={0.12} strokeWidth={0.6} />
        ))}
        {[...byPlace.values()].map((ps, i, all) => {
          const p = at(ps[0]);
          // a label near an earlier one goes above its dot instead of below
          const up = all.slice(0, i).some((q) => Math.abs(at(q[0]).x - p.x) < 120 && Math.abs(at(q[0]).y - p.y) < 30);
          const lift = Math.min(90, Math.abs(p.x - s.x) * 0.35);
          const d = `M ${s.x} ${s.y} Q ${(s.x + p.x) / 2} ${Math.max(-40, Math.min(s.y, p.y) - lift)} ${p.x} ${p.y}`;
          const right = p.x > W * 0.6;
          return (
            <g key={i}>
              <m.path d={d} fill="none" stroke="var(--thread-ba)" strokeWidth={1.2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.2 + i * 0.25 }} />
              <circle cx={p.x} cy={p.y} r={2.6} fill="var(--paper)" />
              <text x={p.x + (right ? -6 : 6)} y={up ? p.y - 22 : p.y + 14} textAnchor={right ? "end" : "start"} fontSize={10} fill="var(--paper)">
                {ps[0].name[lang]}
              </text>
              <text x={p.x + (right ? -6 : 6)} y={up ? p.y - 10 : p.y + 26} textAnchor={right ? "end" : "start"} fontSize={9} fill="var(--muted)">
                {l.km(ps[0].km)}
              </text>
            </g>
          );
        })}
        <circle cx={s.x} cy={s.y} r={3.4} fill="var(--lantern)" />
        <text x={s.x} y={s.y - 8} textAnchor="middle" fontSize={10} fill="var(--lantern)">
          {l.here}
        </text>
      </svg>
      <ul className="flex flex-col gap-1 text-caption text-muted">
        {far.map((p, i) => (
          <li key={i}>
            <span className="text-paper">{titles.get(p.sourceId) ?? p.sourceId}</span> — {l[p.role]} {p.name[lang]}
            {lang === "ja" ? `（${l.km(p.km)}）` : ` (${l.km(p.km)})`}
          </li>
        ))}
      </ul>
    </section>
  );
}
