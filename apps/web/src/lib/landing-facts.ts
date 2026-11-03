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
  const seen = new Set<string>();
  const places: { ja: string; en: string }[] = [];
  for (const [id, p] of tl.periods.entries()) {
    const e = p.length ? E.get(id) : undefined;
    if (!e) continue;
    const site = e.parent ? E.get(e.parent) : undefined;
    const ja = site && site.type === "site" ? `${strip(site.name.ja)}の${strip(e.name.ja)}` : strip(e.name.ja);
    const en = site && site.type === "site" ? `${strip(e.name.en)}, ${strip(site.name.en)}` : strip(e.name.en);
    if (seen.has(ja)) continue;
    seen.add(ja);
    places.push({ ja, en });
  }
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
