/**
 * The postcard (step 8): an answer to the friend's two questions — what does it say (Claude's reading
 * of the inscription in the photo) and how long has it been here (the year it stands since, decided by
 * code from the timeline), with the record's own words about the rebuild (the route adds the quote).
 * Pure: built from the stored events; every number on it is counted here, never typed.
 */
import { interimSince } from "./time-river";
export type Bi = { ja: string; en: string };
type Ev = { type: string; data: unknown };

export type PostcardData = {
  place: Bi | null;
  area: Bi | null;
  seal: string | null;
  /** Claude's reading of the inscription the seal was taken from (its meaning in the card's language) */
  reading: { text: string; meaning: string } | null;
  /** the year the place stands since: its last rebuild (or build) in the timeline, never typed */
  since: string | null;
  sentence: { text: string; source: string | null } | null;
  /** interim: the year a temporary structure was put up before this year (then "the permanent …") */
  broken: { year: string; source: string | null; interim: number | null } | null;
  sceneId: string | null;
  cutout: string | null;
  counts: { sources: number; threads: number; claims: number };
};

const CJK = /[㐀-鿿豈-﫿]/g;

/** Up to four kanji from the first inscription read in the photo (風雷神門). */
export function sealOf(texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const k = (t ?? "").match(CJK);
    if (k && k.length >= 2) return k.slice(0, 4).join("");
  }
  return null;
}

type Sentence = { text: string; claim_ids: string[]; assertion_type: string };
type TimelineData = { events?: { event: string; time?: { start?: string | null } | null }[] };

/** The year the place stands since: its last rebuild or build, unless something destroyed it after. */
export function sinceOf(tl: TimelineData | undefined): string | null {
  const evs = (tl?.events ?? []).filter((e) => e.time?.start);
  const at = (e: (typeof evs)[number]) => e.time!.start!;
  const made = evs.filter((e) => e.event === "rebuilt" || e.event === "built").sort((a, b) => at(a).localeCompare(at(b))).at(-1);
  if (!made) return null;
  if (evs.some((e) => e.event === "destroyed" && at(e) > at(made))) return null;
  return at(made).slice(0, 4);
}
type Claim = { id: string; source_id?: string; status: string };

export function postcardData(events: Ev[], lang: "ja" | "en", story: Sentence[] | null, titles: Map<string, string>): PostcardData {
  const get = <T>(type: string) => events.find((e) => e.type === type)?.data as T | undefined;
  const place = get<{ chosen?: { path?: { name: Bi }[] } | null }>("place")?.chosen;
  const see = get<{ elements?: { text_original?: string | null; meaning?: Bi | null; box?: { w: number; h: number } }[] }>("see");
  const guide = events.filter((e) => e.type === "guide").at(-1)?.data as { notes?: { element: number }[] } | undefined;
  const space = get<{ ok?: boolean; scene_id?: string }>("space");
  const claims = events.filter((e) => e.type === "claims").flatMap((e) => ((e.data as { claims?: Claim[] }).claims ?? []) as Claim[]);
  const threads = (get<{ claimId: string; state: string }[]>("threads") ?? []) as { claimId: string; state: string }[];
  const existence = get<{ rows?: { source: string; time?: { start?: string | null } | null; value: string }[] }>("existence")?.rows ?? [];
  // the story in the asked language (cached), else the run's own
  const sentences: Sentence[] = story ?? (events.filter((e) => e.type === "narrative").at(-1)?.data as { sentences?: Sentence[] } | undefined)?.sentences ?? [];

  // the largest element with a guide note first (the lantern, not the donor's plate), then the rest by size
  const els = see?.elements ?? [];
  const area = (i: number) => (els[i]?.box ? els[i].box!.w * els[i].box!.h : 0);
  const order = [...(guide?.notes ?? []).map((n) => n.element).sort((a, b) => area(b) - area(a)), ...els.map((_, i) => i).sort((a, b) => area(b) - area(a))];
  const seal = sealOf(order.map((i) => els[i]?.text_original));
  const sealEl = order.map((i) => els[i]).find((e) => sealOf([e?.text_original]) === seal);
  const reading = seal && sealEl?.text_original && sealEl.meaning?.[lang] ? { text: sealEl.text_original, meaning: sealEl.meaning[lang] } : null;

  const sourceOf = (claimId: string) => (claimId.startsWith("cl:exist:") ? (claimId.split(":").pop() ?? null) : (claims.find((c) => c.id === claimId)?.source_id ?? null));
  const limit = lang === "ja" ? 70 : 150;
  const absentFirst = threads.find((t) => t.state === "absent")?.claimId.split(":").pop();
  const ok = (x: Sentence) => x.assertion_type !== "uncertain" && x.claim_ids.length > 0 && x.text.length <= limit;
  // the sentence that tells the broken thread goes with the broken-thread line; else the first checked one
  const tellsAbsent = (x: Sentence) => x.claim_ids.some((c) => sourceOf(c) === absentFirst);
  const dated = (x: Sentence) => /\d{4}/.test(x.text);
  const s = sentences.find((x) => ok(x) && tellsAbsent(x) && dated(x)) ?? sentences.find((x) => ok(x) && dated(x)) ?? sentences.find(ok) ?? null;
  const sentenceSource = s ? sourceOf(s.claim_ids[0]) : null;

  const absent = threads.find((t) => t.state === "absent");
  const absentSource = absent ? (absent.claimId.split(":").pop() ?? null) : null;
  const year = existence.find((r) => r.source === absentSource)?.time?.start?.slice(0, 4) ?? null;

  const path = place?.path ?? [];
  return {
    place: path[0]?.name ?? null,
    area: path.at(-1)?.name ?? null,
    seal,
    reading,
    since: sinceOf(events.filter((e) => e.type === "timeline").at(-1)?.data as TimelineData | undefined),
    sentence: s ? { text: s.text, source: sentenceSource ? (titles.get(sentenceSource) ?? sentenceSource) : null } : null,
    broken: year
      ? {
          year,
          source: absentSource ? (titles.get(absentSource) ?? absentSource) : null,
          interim: (() => {
            const tl = events.filter((e) => e.type === "timeline").at(-1)?.data as { events?: unknown[] } | undefined;
            return tl?.events ? interimSince(tl as never, Number(year)) : null;
          })(),
        }
      : null,
    sceneId: space?.ok && space.scene_id ? space.scene_id : null,
    cutout: null,
    counts: {
      // the same definitions as the stage strip (stripNumbers): sources searched, claims accepted
      sources: new Set(events.filter((e) => e.type === "candidates").flatMap((e) => ((e.data as { candidates?: { sourceId: string }[] }).candidates ?? []).map((c) => c.sourceId))).size,
      threads: threads.length,
      claims: claims.filter((c) => c.status === "accepted").length,
    },
  };
}
