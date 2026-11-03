import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
/** The light stages (gap judgment, viewpoint) run on Sonnet 5.5 for latency (user decision 2026-11-03). */
export const CLAUDE_LIGHT_MODEL = process.env.CLAUDE_LIGHT_MODEL ?? "claude-sonnet-5-5";

/** USD per 1M tokens; fast mode doubles the Opus 5.5 rates. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/**
 * Fast mode (research preview, Opus 5.5 only, ~2x price): only when CLAUDE_FAST=1 — the live demo
 * (user decision 2026-11-03). A rate-limited fast request is retried once at standard speed.
 */
export const fastOn = () => process.env.CLAUDE_FAST === "1";
export const FAST_BETA = "fast-mode-2026-02-01";
export async function withFast<T>(call: (fast: boolean) => Promise<T>): Promise<T> {
  if (!fastOn()) return call(false);
  try {
    return await call(true);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return call(false);
    throw e;
  }
}

let client: Anthropic | undefined;
export function claude(): Anthropic {
  // Server-side only (ASI03). 30s per-call timeout per REQUIREMENTS.md 11; the 90s deadline is enforced by the DAG.
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * Tail latency: if the request is still running after `afterMs`, send an identical one and keep
 * whichever answers first; the other is aborted (its partial output is still billed, which only
 * happens on the slow tail). Rejects only when every request sent has failed.
 */
export function hedged<T>(call: (signal: AbortSignal) => Promise<T>, afterMs: number): Promise<{ value: T; hedged: boolean }> {
  const ctl = [new AbortController(), new AbortController()];
  return new Promise((resolve, reject) => {
    let done = false;
    let sent = 1;
    let failed = 0;
    let fired = false;
    const win = (i: number) => (v: T) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      ctl[1 - i].abort();
      resolve({ value: v, hedged: fired });
    };
    const lose = (e: unknown) => {
      failed++;
      if (!done && failed >= sent) {
        done = true;
        clearTimeout(t);
        reject(e);
      }
    };
    call(ctl[0].signal).then(win(0), lose);
    const t = setTimeout(() => {
      if (done) return;
      fired = true;
      sent = 2;
      call(ctl[1].signal).then(win(1), lose);
    }, afterMs);
  });
}

/** One record per Claude call; becomes AgentRun/ToolCall rows and the presentation-mode trace. */
export type CallRecord = {
  stage: string;
  model: string;
  servedModel?: string;
  startedAt: string;
  elapsedMs: number;
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  costUsd: number;
  rateLimit: Record<string, string>;
  requestId: string | null;
  /** a second identical request was sent because the first was slow (the faster one is recorded) */
  hedged?: boolean;
};

type UsageLike = {
  speed?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costOf(u: UsageLike, model: string = CLAUDE_MODEL): number {
  const PRICE = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const k = u.speed === "fast" ? 2 : 1;
  const usd =
    (k *
      (u.input_tokens * PRICE.input +
        u.output_tokens * PRICE.output +
        (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
        (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite)) /
    1_000_000;
  return Math.round(usd * 1e5) / 1e5;
}

/** Keep only the rate-limit headers (used to learn the account's tier limits). */
export function rateLimitHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (k.startsWith("anthropic-ratelimit-") || k === "retry-after") out[k] = v;
  });
  return out;
}
