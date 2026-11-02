/**
 * Exploration DAG (REQUIREMENTS.md 4.3). Code fixes the order of stages; Claude only makes the
 * bounded judgment inside a stage, and code validates it. Day-3 scope: received → see → place →
 * plan → retrieve → done. Extraction / claims / existence / narrative are added on 11/5–11/6.
 *
 * Budgets (4.3, 4.13): 90 s wall-clock deadline, at most 14 Claude calls per exploration.
 * Retries happen only within the remaining time; at the deadline we finish with what is verified.
 */
import { readFile } from "node:fs/promises";
import type { SeeOutput } from "@tsumugi/core";
import { openDb } from "../corpus/db";
import type { CaptureRow } from "../captures";
import { entities } from "../entities-server";
import { seePhoto } from "../see";
import { store } from "../store";
import { emit } from "./events";
import { buildPlan } from "./plan";
import { retrieveFacet, type Retrieved } from "./retrieve";

export const BUDGET = { deadlineMs: 90_000, maxClaudeCalls: 14 } as const;

class Deadline extends Error {}

export class RunContext {
  readonly started = Date.now();
  claudeCalls = 0;
  costUsd = 0;
  constructor(readonly explorationId: string) {}
  remaining(): number {
    return BUDGET.deadlineMs - (Date.now() - this.started);
  }
  check(): void {
    if (this.remaining() <= 0) throw new Deadline("deadline");
  }
  claude(): void {
    if (this.claudeCalls >= BUDGET.maxClaudeCalls) throw new Error("claude call budget exhausted");
    this.claudeCalls++;
  }
}

async function stage<T>(ctx: RunContext, name: string, fn: () => Promise<T>): Promise<T> {
  ctx.check();
  const t0 = Date.now();
  emit(ctx.explorationId, "stage", { stage: name, status: "start", remaining_ms: ctx.remaining() });
  const out = await fn();
  emit(ctx.explorationId, "stage", { stage: name, status: "done", ms: Date.now() - t0 });
  return out;
}

export async function runExploration(explorationId: string, capture: CaptureRow): Promise<void> {
  const ctx = new RunContext(explorationId);
  const db = store();
  const finish = (status: "done" | "failed" | "deadline", result: unknown) => {
    db.prepare("UPDATE explorations SET status = ?, finished_at = ?, cost_usd = ?, result_json = ? WHERE id = ?").run(
      status,
      new Date().toISOString(),
      ctx.costUsd,
      JSON.stringify(result),
      explorationId,
    );
  };
  try {
    emit(explorationId, "received", { capture_id: capture.id, size: [capture.width, capture.height], location: capture.lat != null });

    // 1. See (Claude): cultural elements and place candidates
    const see = await stage(ctx, "see", async () => {
      ctx.claude();
      const img = await readFile(capture.image_path);
      const r = await seePhoto({ base64: img.toString("base64"), mediaType: "image/jpeg" });
      ctx.costUsd += r.record.costUsd;
      db.prepare("INSERT INTO ai_calls (exploration_id, stage, record_json, cost_usd, ts) VALUES (?,?,?,?,?)").run(
        explorationId,
        "see",
        JSON.stringify(r.record),
        r.record.costUsd,
        new Date().toISOString(),
      );
      emit(explorationId, "ai_call", { ...r.record, rateLimit: undefined });
      if (!r.validation.ok) throw new Error(`see output rejected: ${r.validation.errors.join("; ")}`);
      emit(explorationId, "see", r.validation.value);
      return r.validation.value as SeeOutput;
    });

    // 2. Place: map Claude's candidates to the dictionary (FR-07). Unknown place -> honest stop (FR-19).
    const E = entities();
    const place = await stage(ctx, "place", async () => {
      const candidates = see.places
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({ rank: p.rank, confidence: p.confidence, reason: p.reason, hierarchy: p.hierarchy, entity: E.matchPlace(p.hierarchy)?.id ?? null }));
      const chosen = candidates.find((c) => c.entity) ?? null;
      emit(explorationId, "place", {
        candidates,
        chosen: chosen ? { entity: chosen.entity, rank: chosen.rank, path: E.ancestors(chosen.entity!).map((e) => ({ id: e.id, name: e.name })) } : null,
      });
      return chosen?.entity ?? null;
    });
    if (!place) {
      emit(explorationId, "notice", { kind: "no_known_place", message: "この写真の場所は、登録済みの資料の範囲では特定できませんでした。" });
      emit(explorationId, "done", { status: "no_known_place", claude_calls: ctx.claudeCalls, cost_usd: ctx.costUsd });
      finish("done", { place: null });
      return;
    }

    // 3. Plan (FR-08)
    const plan = await stage(ctx, "plan", async () => {
      const p = buildPlan(E, place);
      emit(explorationId, "plan", p.map((f) => ({ facet: f.facet, target: f.target, scopes: f.scopes.map((s) => ({ entity: s.entity, relation: s.relation })), sourceTypes: f.sourceTypes })));
      return p;
    });

    // 4. Retrieve (FR-09..11), per facet × language, with "not found" reported per language
    const retrieved = await stage(ctx, "retrieve", async () => {
      const corpus = openDb({ readonly: true });
      try {
        const all: Retrieved[] = [];
        for (const f of plan) {
          for (const lang of ["en", "ja"] as const) {
            ctx.check();
            const r = retrieveFacet(corpus, E, f, lang);
            all.push(...r.candidates);
            emit(explorationId, "candidates", {
              facet: f.facet,
              lang,
              widened: r.widened,
              tried: r.tried,
              found: r.candidates.length,
              notFound: r.candidates.length === 0,
              candidates: r.candidates.map((c) => ({ ...c, text: c.text.slice(0, 400) })),
            });
          }
        }
        return all;
      } finally {
        corpus.close();
      }
    });

    const summary = {
      status: "retrieved",
      place,
      candidates: retrieved.length,
      bySource: Object.fromEntries(
        [...new Set(retrieved.map((r) => r.sourceId))].map((s) => [s, retrieved.filter((r) => r.sourceId === s).length]),
      ),
      claude_calls: ctx.claudeCalls,
      cost_usd: Math.round(ctx.costUsd * 1e4) / 1e4,
      elapsed_ms: Date.now() - ctx.started,
      next: "extraction / claims / existence / narrative (11/5–11/6)",
    };
    emit(explorationId, "done", summary);
    finish("done", summary);
  } catch (e) {
    const deadline = e instanceof Deadline;
    emit(explorationId, "failed", { reason: deadline ? "deadline" : "error", message: deadline ? "時間内に終わりませんでした" : "処理に失敗しました" });
    console.error(`[exploration ${explorationId}]`, e);
    finish(deadline ? "deadline" : "failed", { error: deadline ? "deadline" : String((e as Error).message).slice(0, 200) });
  }
}
