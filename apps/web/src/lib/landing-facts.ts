/**
 * The numbers and names on the landing page, computed — never typed (CLAUDE.md): the evaluation
 * figures from the latest report, the places with a reviewed timeline, the size of the corpus.
 */
import { entities } from "./entities-server";
import { evalSummary } from "./eval-summary";
import { timeline } from "./timeline-server";
import sources from "../../../../corpus/sources.json";

export type LandingFacts = {
  citationExactPct: number;
  citationN: number;
  fabricated: number;
  rejected: number;
  unsupportedShown: number;
  evalRun: string;
  places: { ja: string; en: string }[];
  sources: number;
  languages: number;
};

export function landingFacts(): LandingFacts {
  const e = evalSummary();
  const E = entities();
  const tl = timeline();
  // one line per structure, named with its site, the "(present hall)" style qualifiers dropped
  const strip = (s: string) => s.replace(/[（(][^）)]*[）)]\s*$/, "").trim();
  const bySite = new Map<string, { ja: string; en: string; former: boolean }>();
  for (const [id, p] of tl.periods.entries()) {
    const e = p.length ? E.get(id) : undefined;
    if (!e) continue;
    const site = e.parent ? E.get(e.parent) : undefined;
    const inSite = site && site.type === "site";
    const name = { ja: strip(e.name.ja).replace(/^旧/, ""), en: strip(e.name.en).replace(/^(Former|Old)\s+/i, "") };
    const entry = { ja: inSite ? `${strip(site.name.ja)}の${name.ja}` : name.ja, en: inSite ? `${name.en}, ${strip(site.name.en)}` : name.en, former: /^旧/.test(e.name.ja) };
    const key = inSite ? site.id : e.id;
    const cur = bySite.get(key);
    if (!cur || (cur.former && !entry.former)) bySite.set(key, entry);
  }
  const places = [...bySite.values()].map(({ ja, en }) => ({ ja, en }));
  const list = (sources as { sources: { lang: string }[] }).sources;
  return {
    citationExactPct: Math.round(e.citation.exact * 100),
    citationN: e.citation.n,
    fabricated: e.citation.fabricated,
    rejected: e.citation.rejected,
    unsupportedShown: e.generation.shown,
    evalRun: e.run,
    places,
    sources: list.length,
    languages: new Set(list.map((s) => s.lang)).size,
  };
}
