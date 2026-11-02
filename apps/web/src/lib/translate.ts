/**
 * 参考訳 for the travel note (FR-42, screen 8): the cited original passages translated into the
 * reader's language. One Claude call per exploration and language, cached. The originals are
 * untrusted data; the output is checked (only known ids, non-empty) and always labelled as a
 * machine reference translation — the original stays the evidence.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { UNTRUSTED_POLICY, wrapUntrusted } from "@tsumugi/core";
import { z } from "zod";
import { CLAUDE_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";
import type { Lang } from "./note";
import { store } from "./store";

const Output = z.object({ items: z.array(z.object({ id: z.string().max(400), text: z.string().max(4000) })).max(60) });

const SYSTEM = `You translate short quoted passages for a travel note, as a reference translation.
- Translate faithfully and completely. Do not summarize, explain, add, or correct anything.
- Keep proper names as the writer spelled them (e.g. Kwan-non, Uyéno), and add nothing in brackets.
- Classical or old-style Japanese: translate the meaning into plain modern language.
- Return one item per input id, with the same id.
${UNTRUSTED_POLICY}`;

export type Translations = Record<string, string>;

export function cachedTranslations(explorationId: string, lang: Lang): Translations | null {
  const r = store().prepare("SELECT json FROM translations WHERE exploration_id = ? AND lang = ?").get(explorationId, lang) as { json: string } | undefined;
  return r ? (JSON.parse(r.json) as Translations) : null;
}

/** Keep only items whose id was asked for and whose text is non-empty. */
export function checkTranslations(asked: { id: string }[], out: z.infer<typeof Output>): Translations {
  const ids = new Set(asked.map((a) => a.id));
  return Object.fromEntries(out.items.filter((i) => ids.has(i.id) && i.text.trim()).map((i) => [i.id, i.text.trim()]));
}

const inflight = new Map<string, Promise<Translations>>();

export function translationsFor(explorationId: string, lang: Lang, items: { id: string; lang: Lang; text: string }[]): Promise<Translations> {
  const hit = cachedTranslations(explorationId, lang);
  if (hit) return Promise.resolve(hit);
  if (!items.length) return Promise.resolve({});
  const key = `${explorationId}:${lang}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = generate(explorationId, lang, items).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function generate(explorationId: string, lang: Lang, items: { id: string; lang: Lang; text: string }[]): Promise<Translations> {
  const startedAt = new Date();
  const { data, response } = await claude()
    .beta.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: betaZodOutputFormat(Output) },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Translate into ${lang === "ja" ? "Japanese" : "English"}.\n${items.map((i) => `id: ${i.id}\n${wrapUntrusted(`passage (${i.lang})`, i.text)}`).join("\n\n")}`,
          },
        ],
      },
      { timeout: 45_000 },
    )
    .withResponse();
  const record: CallRecord = {
    stage: `translate:${lang}`,
    model: CLAUDE_MODEL,
    servedModel: data.model,
    startedAt: startedAt.toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    stopReason: data.stop_reason,
    usage: {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      cacheRead: data.usage.cache_read_input_tokens ?? 0,
      cacheWrite: data.usage.cache_creation_input_tokens ?? 0,
    },
    costUsd: costOf(data.usage),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  store()
    .prepare("INSERT INTO ai_calls (exploration_id, stage, record_json, cost_usd, ts) VALUES (?,?,?,?,?)")
    .run(explorationId, record.stage, JSON.stringify(record), record.costUsd, new Date().toISOString());
  const text = data.content.find((b) => b.type === "text")?.text;
  const parsed = text && data.stop_reason !== "refusal" ? Output.safeParse(JSON.parse(text)) : null;
  const t = parsed?.success ? checkTranslations(items, parsed.data) : {};
  if (Object.keys(t).length)
    store()
      .prepare("INSERT INTO translations (exploration_id, lang, json, created_at) VALUES (?,?,?,?) ON CONFLICT(exploration_id, lang) DO UPDATE SET json = excluded.json")
      .run(explorationId, lang, JSON.stringify(t), new Date().toISOString());
  return t;
}
