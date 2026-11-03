/**
 * Live stage state (REQUIREMENTS.md 6.2–6.3): a pure fold of the exploration's events. Live, replay
 * and presenter use the same function, so they always show the same thing. Order-independent
 * (events are keyed by type; lists are kept in seq order) and idempotent (a seq is applied once).
 */
import type { EventType } from "../dag/event-types";

export type LiveEvent = { seq: number; type: EventType | string; data: unknown };

export type SeeElement = { label: string; box: { x: number; y: number; w: number; h: number }; text_original: string | null; reading: string | null; meaning: { ja: string; en: string } | null; confidence: number };
type Bi = { ja: string; en: string };
export type Viewpoint = {
  state: "pencil";
  visitor: { position: Bi; facing: string; toward: Bi; premises: Bi[] } | null;
  artwork: { entity: string; name: Bi; ja: string; en: string; facing: string; premises: Bi[]; annotated_by: string } | null;
};
export type Candidate = { passageId: string; sourceId: string; sourceTitle: string; lang: "en" | "ja"; text: string; facet: string; relation?: string; year?: number | null; yearKind?: "source_time" | "published" | null };
export type ClaimRow = { id: string; passage_id: string; source_id?: string; source?: string; lang?: "en" | "ja"; subject: string; predicate: string; value: string | null; status: string; excerpt: string; sentence_ids: string[]; failed_checks?: string[] };
export type ThreadRow = { id: string; claimId: string; layer: "toki" | "ba" | "koto" | "ma"; state: string; label: { ja: string; en: string }; evidence: string[] };
export type ExistenceRow = { source: string; sourceTitle: string; time: { kind: string; start: string | null; end?: string | null } | null; value: "present" | "absent" | "unknown"; reason: string };
export type VisualHit = { id: string; title: string; commons: string; score: number; file: string; crop?: string; box?: number[]; into?: string | null; artwork?: string | null };
export type Association = { passage: string; source: string; title: string; text: string; score: number; path: { id: string; label: string; text: string }[] };

export type LiveState = {
  applied: Record<number, true>;
  /** when each event type was first shown (client ms), for animations relative to their beat */
  at: Record<string, number>;
  stages: Record<string, { started: number; done?: number; ms?: number }>;
  calls: { stage: string; model: string; served: string; startedAt: string; elapsedMs: number; costUsd: number; seq: number }[];
  see?: { elements: SeeElement[] };
  /** while Claude is still writing: its thinking summary and the elements completed so far (display only) */
  seeProgress?: { thinking: string; elements: SeeElement[]; seq: number };
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

export const initialState = (): LiveState => ({ applied: {}, at: {}, stages: {}, calls: [], candidates: [], candidateGroups: [], claims: [], claimTotals: { accepted: 0, downgraded: 0, rejected: 0 } });

/** Apply one event. `at` is the client time (ms) the event became visible, for stage timers. */
export function reduce(s: LiveState, ev: LiveEvent, at = 0): LiveState {
  if (s.applied[ev.seq]) return s;
  const n: LiveState = { ...s, applied: { ...s.applied, [ev.seq]: true }, at: ev.type in s.at ? s.at : { ...s.at, [ev.type]: at } };
  const d = ev.data as Record<string, unknown>;
  switch (ev.type) {
    case "stage": {
      const name = String(d.stage);
      const cur = n.stages[name] ?? { started: at };
      n.stages = { ...n.stages, [name]: d.status === "done" ? { ...cur, done: at, ms: Number(d.ms ?? 0) } : { ...cur, started: Math.min(cur.started, at) } };
      break;
    }
    case "ai_call":
      n.calls = [...n.calls, { stage: String(d.stage), model: String(d.model), served: String(d.servedModel ?? d.model), startedAt: String(d.startedAt ?? ""), elapsedMs: Number(d.elapsedMs ?? 0), costUsd: Number(d.costUsd ?? 0), seq: ev.seq }].sort((a, b) => a.seq - b.seq);
      break;
    case "see":
      n.see = { elements: (d.elements as SeeElement[]) ?? [] };
      break;
    case "see_progress": {
      // keep only well-formed elements (not validated yet): a box inside the photo
      const els = ((d.elements as SeeElement[]) ?? []).filter(
        (e) => e && e.box && [e.box.x, e.box.y, e.box.w, e.box.h].every((v) => typeof v === "number" && v >= 0 && v <= 1) && typeof e.label === "string",
      );
      if (!n.seeProgress || ev.seq > n.seeProgress.seq) n.seeProgress = { thinking: String(d.thinking ?? ""), elements: els, seq: ev.seq };
      break;
    }
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

/** Where a thread comes from: an existence thread names its source; others cite a passage. */
export function threadSource(t: ThreadRow): string {
  if (t.claimId.startsWith("cl:exist:")) return t.claimId.split(":").pop()!;
  return (t.evidence[0] ?? "").split(":")[0];
}

const STATE_RANK: Record<string, number> = { absent: 5, pending: 4, combined: 3, fork: 2, pencil: 1, ink: 0 };

export type SourceCard = {
  sourceId: string;
  title: string;
  lang: "en" | "ja";
  year: number | null;
  yearKind: "source_time" | "published" | null;
  excerpt: string;
  accepted: number;
  downgraded: number;
  rejected: number;
  existence: ExistenceRow | null;
  threads: ThreadRow[];
  /** the strongest thread state for this source (a broken thread wins) and its layer */
  state: string | null;
  layer: ThreadRow["layer"] | null;
  firstSeq: number;
};

/** One card per source, in the order the sources were found (6.2 evidence column). */
export function sourceCards(s: LiveState): SourceCard[] {
  const by = new Map<string, SourceCard>();
  for (const c of s.candidates) {
    if (by.has(c.sourceId)) continue;
    by.set(c.sourceId, { sourceId: c.sourceId, title: c.sourceTitle, lang: c.lang, year: c.year ?? null, yearKind: c.yearKind ?? (c.year ? "source_time" : null), excerpt: c.text, accepted: 0, downgraded: 0, rejected: 0, existence: null, threads: [], state: null, layer: null, firstSeq: c.seq });
  }
  for (const cl of s.claims) {
    const card = cl.source_id ? by.get(cl.source_id) : undefined;
    if (!card) continue;
    if (cl.status === "accepted") card.accepted++;
    else if (cl.status === "downgraded") card.downgraded++;
    else card.rejected++;
    if (cl.status === "accepted" && card.accepted === 1 && cl.excerpt) card.excerpt = cl.excerpt;
  }
  for (const r of s.existence?.rows ?? []) {
    const card = by.get(r.source);
    if (!card) continue;
    card.existence = r;
    // the existence judgment's time wins over a publication year
    if ((card.year == null || card.yearKind === "published") && r.time?.start) {
      card.year = Number(r.time.start.slice(0, 4)) || card.year;
      card.yearKind = "source_time";
    }
  }
  for (const t of s.threads ?? []) {
    const card = by.get(threadSource(t));
    if (!card) continue;
    card.threads.push(t);
    if (card.state == null || (STATE_RANK[t.state] ?? 0) > (STATE_RANK[card.state] ?? 0)) {
      card.state = t.state;
      card.layer = t.layer;
    }
  }
  return [...by.values()].sort((a, b) => a.firstSeq - b.firstSeq);
}
