/**
 * Language switch (FR-40, RAG-08, 4.7): exploration results are language-independent and stored as
 * events. Switching language only (re)generates the narrative from the SAME claims/threads and
 * caches it per language. IDs and states cannot change because nothing upstream is re-run.
 */
import type { CheckedClaim } from "@tsumugi/core";
import type { CallRecord } from "./claude";
import { eventsAfter } from "./dag/events";
import type { ExistenceRow, Thread } from "./dag/threads";
import { entities } from "./entities-server";
import { buildClaimCards, narrate } from "./narrate";
import { store } from "./store";
import { sourceTime } from "./timeline-server";

export type NarrativePayload = {
  lang: "ja" | "en";
  sentences: { text: string; claim_ids: string[]; assertion_type: string }[];
  dropped: { text: string; problems: string[] }[];
};

type StoredClaim = {
  id: string;
  passage_id: string;
  source_id?: string;
  source?: string;
  subject: string;
  predicate: CheckedClaim["predicate"];
  object: string | null;
  value: string | null;
  relation: CheckedClaim["relation"];
  status: CheckedClaim["status"];
  excerpt: string;
  sentence_ids: string[];
};

export function cachedNarrative(explorationId: string, lang: "ja" | "en"): NarrativePayload | null {
  const r = store().prepare("SELECT json FROM narratives WHERE exploration_id = ? AND lang = ?").get(explorationId, lang) as { json: string } | undefined;
  return r ? (JSON.parse(r.json) as NarrativePayload) : null;
}

export function saveNarrative(explorationId: string, p: NarrativePayload): void {
  store()
    .prepare("INSERT INTO narratives (exploration_id, lang, json, created_at) VALUES (?,?,?,?) ON CONFLICT(exploration_id, lang) DO UPDATE SET json = excluded.json")
    .run(explorationId, p.lang, JSON.stringify(p), new Date().toISOString());
}

/** Rebuild the language-independent state from the stored events. */
export function loadState(explorationId: string) {
  const ev = eventsAfter(explorationId, 0);
  const placeEv = ev.find((e) => e.type === "place")?.data as { chosen?: { entity: string }; unmatched?: { name_ja: string; name_en: string } | null } | undefined;
  const place = placeEv?.chosen?.entity ?? null;
  const unmatched = placeEv?.unmatched ?? null;
  const claims = ev.filter((e) => e.type === "claims").flatMap((e) => (e.data as { claims: StoredClaim[] }).claims);
  const threads = (ev.find((e) => e.type === "threads")?.data as Thread[] | undefined) ?? [];
  const existence = ((ev.find((e) => e.type === "existence")?.data as { rows: ExistenceRow[] } | undefined)?.rows ?? []) as ExistenceRow[];
  return { place, claims, threads, existence, unmatched };
}

type Result = { payload: NarrativePayload; cached: boolean; record?: CallRecord } | null;
const inflight = new Map<string, Promise<Result>>();

/** Cached, or generated once: concurrent requests for the same language share one Claude call. */
export function narrativeFor(explorationId: string, lang: "ja" | "en"): Promise<Result> {
  const hit = cachedNarrative(explorationId, lang);
  if (hit) return Promise.resolve({ payload: hit, cached: true });
  const key = `${explorationId}:${lang}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = generate(explorationId, lang).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function generate(explorationId: string, lang: "ja" | "en"): Promise<Result> {
  const { place, claims, threads, existence, unmatched } = loadState(explorationId);
  if (!place || !threads.length) return null;
  const E = entities();
  const asChecked = claims.map((c) => ({ ...c, negated: false, rationale: "", checks: [] }) as unknown as CheckedClaim);
  const byId = new Map(claims.map((c) => [c.passage_id, c]));
  const cards = buildClaimCards(
    E,
    asChecked,
    threads,
    existence,
    (pid) => byId.get(pid)?.source ?? pid,
    (pid) => sourceTime(byId.get(pid)?.source_id ?? "", place),
  );
  const r = await narrate(E, cards, lang, E.ancestors(place).map((e) => e.id), unmatched);
  const payload: NarrativePayload = {
    lang,
    sentences: r.sentences.filter((s) => s.ok).map(({ text, claim_ids, assertion_type }) => ({ text, claim_ids, assertion_type })),
    dropped: r.sentences.filter((s) => !s.ok).map(({ text, problems }) => ({ text, problems })),
  };
  saveNarrative(explorationId, payload);
  store()
    .prepare("INSERT INTO ai_calls (exploration_id, stage, record_json, cost_usd, ts) VALUES (?,?,?,?,?)")
    .run(explorationId, r.record.stage, JSON.stringify(r.record), r.record.costUsd, new Date().toISOString());
  return { payload, cached: false, record: r.record };
}
