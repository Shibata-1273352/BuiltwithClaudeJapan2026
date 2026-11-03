/**
 * The postcard (step 8): what a visitor takes away — the cut-out, a vermilion seal of the words read
 * from the photo, ONE sentence of the story that passed the code checks, and the broken thread.
 * Pure: built from the stored events; every number on it is counted here, never typed.
 */
export type Bi = { ja: string; en: string };
type Ev = { type: string; data: unknown };

export type PostcardData = {
  place: Bi | null;
  area: Bi | null;
  seal: string | null;
  sentence: { text: string; source: string | null } | null;
  broken: { year: string; source: string | null } | null;
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
type Claim = { id: string; source_id?: string; status: string };

export function postcardData(events: Ev[], lang: "ja" | "en", story: Sentence[] | null, titles: Map<string, string>): PostcardData {
  const get = <T>(type: string) => events.find((e) => e.type === type)?.data as T | undefined;
  const place = get<{ chosen?: { path?: { name: Bi }[] } | null }>("place")?.chosen;
  const see = get<{ elements?: { text_original?: string | null }[] }>("see");
  const guide = events.filter((e) => e.type === "guide").at(-1)?.data as { notes?: { element: number }[] } | undefined;
  const space = get<{ ok?: boolean; scene_id?: string }>("space");
  const claims = events.filter((e) => e.type === "claims").flatMap((e) => ((e.data as { claims?: Claim[] }).claims ?? []) as Claim[]);
  const threads = (get<{ claimId: string; state: string }[]>("threads") ?? []) as { claimId: string; state: string }[];
  const existence = get<{ rows?: { source: string; time?: { start?: string | null } | null; value: string }[] }>("existence")?.rows ?? [];
  // the story in the asked language (cached), else the run's own
  const sentences: Sentence[] = story ?? (events.filter((e) => e.type === "narrative").at(-1)?.data as { sentences?: Sentence[] } | undefined)?.sentences ?? [];

  // the guide's elements first (the ones the visitor touched), then anything with writing
  const els = see?.elements ?? [];
  const order = [...(guide?.notes ?? []).map((n) => n.element), ...els.map((_, i) => i)];
  const seal = sealOf(order.map((i) => els[i]?.text_original));

  const sourceOf = (claimId: string) => (claimId.startsWith("cl:exist:") ? (claimId.split(":").pop() ?? null) : (claims.find((c) => c.id === claimId)?.source_id ?? null));
  const limit = lang === "ja" ? 70 : 150;
  const s = sentences.find((x) => x.assertion_type !== "uncertain" && x.claim_ids.length > 0 && x.text.length <= limit) ?? null;
  const sentenceSource = s ? sourceOf(s.claim_ids[0]) : null;

  const absent = threads.find((t) => t.state === "absent");
  const absentSource = absent ? (absent.claimId.split(":").pop() ?? null) : null;
  const year = existence.find((r) => r.source === absentSource)?.time?.start?.slice(0, 4) ?? null;

  const path = place?.path ?? [];
  return {
    place: path[0]?.name ?? null,
    area: path.at(-1)?.name ?? null,
    seal,
    sentence: s ? { text: s.text, source: sentenceSource ? (titles.get(sentenceSource) ?? sentenceSource) : null } : null,
    broken: year ? { year, source: absentSource ? (titles.get(absentSource) ?? absentSource) : null } : null,
    sceneId: space?.ok && space.scene_id ? space.scene_id : null,
    cutout: null,
    counts: {
      sources: new Set(claims.map((c) => c.source_id).filter(Boolean)).size,
      threads: threads.length,
      claims: claims.filter((c) => c.status === "accepted").length,
    },
  };
}
