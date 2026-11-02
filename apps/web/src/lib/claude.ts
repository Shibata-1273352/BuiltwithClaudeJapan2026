import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

/** USD per 1M tokens (claude-opus-5-5; update alongside CLAUDE_MODEL). */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

let client: Anthropic | undefined;
export function claude(): Anthropic {
  // Server-side only (ASI03). 30s per-call timeout per REQUIREMENTS.md 11; the 90s deadline is enforced by the DAG.
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return client;
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
};

type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costOf(u: UsageLike): number {
  const usd =
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
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
