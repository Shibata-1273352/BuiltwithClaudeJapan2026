/**
 * Live stage state (REQUIREMENTS.md 6.2–6.3): a pure fold of the exploration's events. Live, replay
 * and presenter use the same function, so they always show the same thing. Order-independent
 * (events are keyed by type; lists are kept in seq order) and idempotent (a seq is applied once).
 */
import type { EventType } from "../dag/event-types";

export type LiveEvent = { seq: number; type: EventType | string; data: unknown };

export type SeeElement = { label: string; box: { x: number; y: number; w: number; h: number }; text_original: string | null; reading: string | null; meaning: { ja: string; en: string } | null; confidence: number };
export type Viewpoint = { state: "pencil"; visitor: { position: string; facing: string; toward: string; premises: string[] } | null; artwork: { text: string; premise: string } | null };
export type Candidate = { passageId: string; sourceId: string; sourceTitle: string; lang: "en" | "ja"; text: string; facet: string; relation?: string };
export type ClaimRow = { id: string; passage_id: string; source_id?: string; source?: string; lang?: "en" | "ja"; subject: string; predicate: string; value: string | null; status: string; excerpt: string; sentence_ids: string[]; failed_checks?: string[] };
export type ThreadRow = { id: string; claimId: string; layer: "toki" | "ba" | "koto" | "ma"; state: string; label: { ja: string; en: string }; evidence: string[] };
export type ExistenceRow = { source: string; sourceTitle: string; time: { kind: string; start: string | null; end?: string | null } | null; value: "present" | "absent" | "unknown"; reason: string };
export type VisualHit = { id: string; title: string; commons: string; score: number; file: string; crop?: string; box?: number[]; into?: string | null; artwork?: string | null };
export type Association = { source: string; title: string; passage: string | null; score: number; path: string[] };

export type LiveState = {
  applied: Record<number, true>;
  stages: Record<string, { started: number; done?: number; ms?: number }>;
  calls: { stage: string; model: string; elapsedMs: number; costUsd: number; seq: number }[];
  see?: { elements: SeeElement[] };
  place?: { entity: string; path: { id: string; name: { ja: string; en: string } }[]; names?: string[] } | null;
  placeTried?: string[];
  notice?: { kind?: string; message: string };
  space?: { ok: boolean; scene_id?: string; url?: string; elements?: string[]; aligned?: boolean; ms?: number; message?: string };
  visual?: { hits: VisualHit[] };
  viewpoint?: Viewpoint;
  associations?: { ok: boolean; items: Association[] };
  candidates: (Candidate & { seq: number })[];
  candidateGroups: { facet: string; lang: "en" | "ja"; found: number; notFound: boolean; seq: number }[];
  gap?: { assessment?: string; gaps?: { facet: string; lang: string; reason: string; terms: string[] }[]; found?: number; skipped?: string };
  claims: ClaimRow[];
  claimTotals: { accepted: number; downgraded: number; rejected: number };
  existence?: { entity: string; rows: ExistenceRow[] };
  timeline?: unknown;
  names?: unknown;
  threads?: ThreadRow[];
  narrative?: { lang?: "ja" | "en"; sentences?: { text: string; claim_ids: string[]; assertion_type: string }[]; dropped?: unknown[] };
  graph?: { saved: boolean; ms?: number };
  done?: { elapsed_ms?: number; cost_usd?: number; claude_calls?: number; status?: string };
  failed?: { message: string };
};

export const initialState = (): LiveState => ({ applied: {}, stages: {}, calls: [], candidates: [], candidateGroups: [], claims: [], claimTotals: { accepted: 0, downgraded: 0, rejected: 0 } });

/** Apply one event. `at` is the client time (ms) the event became visible, for stage timers. */
export function reduce(s: LiveState, ev: LiveEvent, at = 0): LiveState {
  if (s.applied[ev.seq]) return s;
  const n: LiveState = { ...s, applied: { ...s.applied, [ev.seq]: true } };
  const d = ev.data as Record<string, unknown>;
  switch (ev.type) {
    case "stage": {
      const name = String(d.stage);
      const cur = n.stages[name] ?? { started: at };
      n.stages = { ...n.stages, [name]: d.status === "done" ? { ...cur, done: at, ms: Number(d.ms ?? 0) } : { ...cur, started: Math.min(cur.started, at) } };
      break;
    }
    case "ai_call":
      n.calls = [...n.calls, { stage: String(d.stage), model: String(d.model), elapsedMs: Number(d.elapsedMs ?? 0), costUsd: Number(d.costUsd ?? 0), seq: ev.seq }].sort((a, b) => a.seq - b.seq);
      break;
    case "see":
      n.see = { elements: (d.elements as SeeElement[]) ?? [] };
      break;
    case "place": {
      const chosen = d.chosen as LiveState["place"];
      n.place = chosen ?? null;
      n.placeTried = ((d.candidates as { hierarchy: { name_ja: string }[] }[]) ?? []).map((c) => c.hierarchy.map((h) => h.name_ja).join(" › "));
      break;
    }
    case "notice":
      n.notice = d as LiveState["notice"];
      break;
    case "space":
      n.space = d as LiveState["space"];
      break;
    case "visual":
      n.visual = { hits: (d.hits as VisualHit[]) ?? [] };
      break;
    case "viewpoint":
      n.viewpoint = d as unknown as Viewpoint;
      break;
    case "associations":
      n.associations = { ok: Boolean(d.ok), items: (d.items as Association[]) ?? [] };
      break;
    case "candidates": {
      const list = ((d.candidates as Candidate[]) ?? []).map((c) => ({ ...c, seq: ev.seq }));
      n.candidates = [...n.candidates, ...list].sort((a, b) => a.seq - b.seq);
      n.candidateGroups = [...n.candidateGroups, { facet: String(d.facet), lang: d.lang as "en" | "ja", found: Number(d.found ?? list.length), notFound: Boolean(d.notFound), seq: ev.seq }].sort((a, b) => a.seq - b.seq);
      break;
    }
    case "gap":
      n.gap = d as LiveState["gap"];
      break;
    case "claims": {
      const rows = (d.claims as ClaimRow[]) ?? [];
      const seen = new Set(n.claims.map((c) => c.id));
      n.claims = [...n.claims, ...rows.filter((r) => !seen.has(r.id))];
      n.claimTotals = {
        accepted: n.claimTotals.accepted + Number(d.accepted ?? 0),
        downgraded: n.claimTotals.downgraded + Number(d.downgraded ?? 0),
        rejected: n.claimTotals.rejected + Number(d.rejected ?? 0),
      };
      break;
    }
    case "existence":
      n.existence = d as LiveState["existence"];
      break;
    case "timeline":
      n.timeline = d;
      break;
    case "names":
      n.names = d;
      break;
    case "threads":
      n.threads = ev.data as ThreadRow[];
      break;
    case "narrative":
      n.narrative = d as LiveState["narrative"];
      break;
    case "graph":
      n.graph = d as LiveState["graph"];
      break;
    case "done":
      n.done = d as LiveState["done"];
      break;
    case "failed":
      n.failed = d as LiveState["failed"];
      break;
  }
  return n;
}

export function fold(events: LiveEvent[], atOf: (seq: number) => number = () => 0): LiveState {
  return [...events].sort((a, b) => a.seq - b.seq).reduce((s, e) => reduce(s, e, atOf(e.seq)), initialState());
}

/** The big numbers of the result strip (6.2): what the run looked at and what it kept. */
export function stripNumbers(s: LiveState) {
  const sources = new Set(s.candidates.map((c) => c.sourceId));
  const langs = new Set(s.candidates.map((c) => c.lang));
  return {
    passages: new Set(s.candidates.map((c) => c.passageId)).size,
    sources: sources.size,
    languages: langs.size,
    ...s.claimTotals,
    threads: s.threads?.length ?? 0,
    broken: s.threads?.filter((t) => t.state === "absent").length ?? 0,
    claudeCalls: s.calls.length,
    costUsd: s.calls.reduce((a, c) => a + c.costUsd, 0),
  };
}
