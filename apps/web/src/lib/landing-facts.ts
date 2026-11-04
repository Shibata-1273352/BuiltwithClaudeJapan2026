/**
 * The names on the landing page, computed — never typed (CLAUDE.md): the places with a reviewed
 * timeline, the size of the corpus. No evaluation figures: evaluation stays out of the app.
 */
import { entities } from "./entities-server";
import { timeline } from "./timeline-server";
import sources from "../../../../corpus/sources.json";

export type LandingFacts = {
  places: { ja: string; en: string; reviewed: boolean }[];
  /** the year of the print on the landing (from the corpus, not typed) */
  printYear: number | null;
  sources: number;
  languages: number;
};

export function landingFacts(): LandingFacts {
  const E = entities();
  const tl = timeline();
  // one line per structure, named with its site, the "(present hall)" style qualifiers dropped
  const strip = (s: string) => s.replace(/[（(][^）)]*[）)]\s*$/, "").trim();
  const bySite = new Map<string, { ja: string; en: string; former: boolean; reviewed: boolean }>();
  const reviews = (tl.t as { reviews?: Record<string, { by: string | null }> }).reviews ?? {};
  for (const [id, p] of tl.periods.entries()) {
    const e = p.length ? E.get(id) : undefined;
    if (!e) continue;
    const site = e.parent ? E.get(e.parent) : undefined;
    const inSite = site && site.type === "site";
    const name = { ja: strip(e.name.ja).replace(/^旧/, ""), en: strip(e.name.en).replace(/^(Former|Old)\s+/i, "") };
    const entry = { ja: inSite ? `${strip(site.name.ja)}の${name.ja}` : name.ja, en: inSite ? `${name.en}, ${strip(site.name.en)}` : name.en, former: /^旧/.test(e.name.ja), reviewed: Boolean(reviews[id]?.by) };
    const key = inSite ? site.id : e.id;
    const cur = bySite.get(key);
    if (!cur || (cur.former && !entry.former)) bySite.set(key, { ...entry, reviewed: entry.reviewed || Boolean(cur?.reviewed) });
  }
  const places = [...bySite.values()].map(({ ja, en, reviewed }) => ({ ja, en, reviewed })).sort((a, b) => Number(b.reviewed) - Number(a.reviewed));
  const list = (sources as { sources: { lang: string; id?: string; first_published?: number }[] }).sources;
  const printYear = list.find((x) => x.id === "met-56689")?.first_published ?? null;
  return {
    places,
    printYear,
    sources: list.length,
    languages: new Set(list.map((s) => s.lang)).size,
  };
}
