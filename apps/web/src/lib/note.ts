/**
 * 旅ノート (FR-42, screen 8): one page built from the stored exploration events — no Claude call.
 * Every narrative sentence links to the claims it cites, and each claim to its original sentences
 * and source (切符). Pure: the page passes in events, source metadata and cached narratives.
 */
import type { StoredEvent } from "./dag/events";
import type { ExistenceRow, Thread } from "./dag/threads";

export type Lang = "ja" | "en";
export type NarrativeLike = { lang: Lang; sentences: { text: string; claim_ids: string[]; assertion_type: string }[]; dropped: unknown[] };

export type SourceMeta = {
  id: string;
  type: string;
  lang: string;
  title: string;
  author: string | null;
  first_published: number | null;
  edition: string | null;
  url: string | null;
  provider: string | null;
  license: string | null;
};

export type Cite =
  | {
      kind: "evidence";
      claimId: string;
      sourceId: string;
      sourceTitle: string;
      lang: Lang;
      passageId: string;
      sentenceIds: string[];
      excerpt: string;
      subject: string;
      predicate: string;
      value: string | null;
    }
  | {
      kind: "existence";
      claimId: string;
      sourceId: string;
      sourceTitle: string;
      state: string;
      label: { ja: string; en: string };
      evidence: string[];
    };

export type Ticket = SourceMeta & { cited: number };

export type Note = {
  id: string;
  captureId: string | null;
  place: { entity: string; path: string[] } | null;
  see: { label: string; text_original: string | null; reading: string | null; meaning: { ja: string; en: string } | null }[];
  space: { url: string; aligned: boolean; elements: string[] } | null;
  /** FR-58: prints that look like the cut-out lantern (similarity, not evidence) */
  visual: { id: string; title: string; commons: string; score: number; file: string; crop?: string; box?: number[]; into?: string | null }[];
  narratives: Partial<Record<Lang, NarrativeLike>>;
  cites: Record<string, Cite>;
  /** confirmedAt: FR-44, the viewer's own check of a pencil / pending thread (state itself unchanged) */
  threads: { id: string; layer: string; state: string; label: { ja: string; en: string }; confirmedAt?: string }[];
  tickets: Ticket[];
  stats: { elapsed_ms?: number; cost_usd?: number; claude_calls?: number };
};

type StoredClaim = {
  id: string;
  passage_id: string;
  source_id?: string;
  source?: string;
  lang?: Lang;
  subject: string;
  predicate: string;
  value: string | null;
  status: string;
  excerpt: string;
  sentence_ids: string[];
};

const first = <T>(ev: StoredEvent[], type: string) => ev.find((e) => e.type === type)?.data as T | undefined;

export function buildNote(
  id: string,
  captureId: string | null,
  ev: StoredEvent[],
  sources: Map<string, SourceMeta>,
  cached: Partial<Record<Lang, NarrativeLike>> = {},
  confirmations: Map<string, string> = new Map(),
): Note {
  const place = first<{ chosen?: { entity: string; path: { name: { ja: string } }[] } }>(ev, "place")?.chosen;
  const see = first<{ elements: Note["see"] }>(ev, "see")?.elements ?? [];
  const space = first<{ ok: boolean; url?: string; aligned?: boolean; elements?: string[] }>(ev, "space");
  const threads = first<Thread[]>(ev, "threads") ?? [];
  const existence = first<{ rows: ExistenceRow[] }>(ev, "existence")?.rows ?? [];
  const done = first<Note["stats"]>(ev, "done") ?? {};

  const narratives: Note["narratives"] = { ...cached };
  const live = first<NarrativeLike>(ev, "narrative");
  if (live && !narratives[live.lang ?? "ja"]) narratives[live.lang ?? "ja"] = { ...live, lang: live.lang ?? "ja" };

  const cites: Record<string, Cite> = {};
  for (const c of ev.filter((e) => e.type === "claims").flatMap((e) => (e.data as { claims: StoredClaim[] }).claims)) {
    if (c.status === "rejected") continue;
    const sourceId = c.source_id ?? c.passage_id.split(":")[0];
    cites[c.id] = {
      kind: "evidence",
      claimId: c.id,
      sourceId,
      sourceTitle: c.source ?? sources.get(sourceId)?.title ?? sourceId,
      lang: c.lang ?? ((sources.get(sourceId)?.lang as Lang) || "en"),
      passageId: c.passage_id,
      sentenceIds: c.sentence_ids,
      excerpt: c.excerpt,
      subject: c.subject,
      predicate: c.predicate,
      value: c.value,
    };
  }
  for (const t of threads) {
    if (!t.claimId.startsWith("cl:exist:") || cites[t.claimId]) continue;
    const sourceId = t.claimId.split(":").at(-1)!;
    cites[t.claimId] = {
      kind: "existence",
      claimId: t.claimId,
      sourceId,
      sourceTitle: existence.find((r) => r.source === sourceId)?.sourceTitle ?? sources.get(sourceId)?.title ?? sourceId,
      state: t.state,
      label: t.label,
      evidence: t.evidence,
    };
  }

  // 切符: every source cited by a kept sentence, in order of first citation
  const count = new Map<string, number>();
  for (const n of Object.values(narratives))
    for (const s of n?.sentences ?? [])
      for (const cid of s.claim_ids) {
        const c = cites[cid];
        if (c) count.set(c.sourceId, (count.get(c.sourceId) ?? 0) + 1);
      }
  const tickets = [...count]
    .map(([sid, cited]) => {
      const m = sources.get(sid);
      return m ? { ...m, cited } : null;
    })
    .filter((t): t is Ticket => t !== null);

  return {
    id,
    captureId,
    place: place ? { entity: place.entity, path: place.path.map((p) => p.name.ja).reverse() } : null,
    see,
    space: space?.ok && space.url ? { url: space.url, aligned: Boolean(space.aligned), elements: space.elements ?? [] } : null,
    visual: first<{ hits: Note["visual"] }>(ev, "visual")?.hits ?? [],
    narratives,
    cites,
    threads: threads.map(({ id: tid, layer, state, label }) => ({ id: tid, layer, state, label, confirmedAt: confirmations.get(tid) })),
    tickets,
    stats: { elapsed_ms: done.elapsed_ms, cost_usd: done.cost_usd, claude_calls: done.claude_calls },
  };
}

/** Original passages that need a reference translation into `lang` (keyed by claim id). */
export function toTranslate(note: Note, lang: Lang): { id: string; lang: Lang; text: string }[] {
  const seen = new Set<string>();
  const out: { id: string; lang: Lang; text: string }[] = [];
  const cited = new Set(Object.values(note.narratives).flatMap((n) => n?.sentences.flatMap((s) => s.claim_ids) ?? []));
  for (const c of Object.values(note.cites)) {
    if (c.kind !== "evidence" || c.lang === lang || !cited.has(c.claimId)) continue;
    const key = c.sentenceIds.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, lang: c.lang, text: c.excerpt });
  }
  return out;
}
