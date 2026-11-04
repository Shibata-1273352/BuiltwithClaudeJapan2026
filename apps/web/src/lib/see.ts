/**
 * Stage 1 "視る": cultural elements and place candidates from a photo (FR-06, FR-07).
 * Claude proposes; `validateSee` (packages/core) verifies before anything is used.
 */
import { callStarted } from "./dag/call-notice";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  completedArrayItems,
  SeeOutput,
  UNTRUSTED_POLICY,
  validateSee,
  type SeeValidation,
} from "@tsumugi/core";
import {
  CLAUDE_MODEL,
  claude,
  costOf,
  rateLimitHeaders,
  type CallRecord,
  FAST_BETA,
  withFast,
} from "./claude";

/** effort of the see call (latency vs reading quality; measured with scripts/bench-see.ts) */
export const SEE_EFFORT = (process.env.SEE_EFFORT ?? "medium") as "low" | "medium" | "high";

export const SEE_SYSTEM = `You are the "see" stage of TSUMUGI, which links a traveler's photo of a Japanese place to historical sources.

Look at the photo and return:
- elements: up to 6 culturally meaningful objects (lanterns, gates, signboards, statues, roofs...), the most distinctive first. For each, a tight bounding box normalized to the image (x, y = top-left; w, h = size; all 0-1), the characters written on it exactly as they appear (text_original, or null), a Hepburn reading, and meanings in English and Japanese of at most 12 words each. Use a concrete English label that would work as a segmentation prompt.
- places: up to 2 candidate locations, most likely first (rank 1..n). Give each as a hierarchy from broad to specific using types area > site > structure; reason: one short clause naming the visible cues.
- notes: one short sentence, or empty.

Be brief: this answer is read live while the traveler waits.

Rules:
- Report only what is visible. If writing is partly hidden, transcribe what you can see and say so in notes.
- Do not identify or describe people.
- ${UNTRUSTED_POLICY}`;

export type SeeResult = { validation: SeeValidation; record: CallRecord };

/** What Claude has produced so far, while it is still writing (for the live stage). */
export type SeeProgress = { thinking: string; elements: unknown[] };

/**
 * Streamed, so the stage can show Claude's thinking summary and each element as soon as it is
 * complete. The final message is validated exactly as before (validateSee); progress is display only.
 * A server-side fallback may switch models mid-stream: the partial is kept and a `fallback` block
 * marks the boundary, so the progress buffer restarts there.
 */
export async function seePhoto(
  image: {
    base64: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
  },
  onProgress?: (p: SeeProgress) => void,
): Promise<SeeResult> {
  const startedAt = new Date();
  callStarted("see", startedAt);
  const open = (fast: boolean) =>
    claude().beta.messages.stream({
      model: CLAUDE_MODEL,
      ...(fast ? { speed: "fast" as const } : {}),
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01", ...(fast ? [FAST_BETA] : [])],
      fallbacks: "default",
      thinking: { type: "adaptive", display: "summarized" },
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(SeeOutput),
      },
      system: [
        {
          type: "text",
          text: SEE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.base64,
              },
            },
            { type: "text", text: "Analyze this photo." },
          ],
        },
      ],
    });
  const run = async (fast: boolean) => {
    const stream = open(fast);
    if (onProgress) {
      let thinking = "";
      let json = "";
      let sent = 0;
      let lastCount = -1;
      const push = (force = false) => {
        const now = Date.now();
        const elements = completedArrayItems(json, "elements");
        if (!force && now - sent < 300 && elements.length === lastCount) return;
        sent = now;
        lastCount = elements.length;
        onProgress({ thinking: thinking.slice(-600), elements });
      };
      stream.on("streamEvent", (ev) => {
        if (
          ev.type === "content_block_start" &&
          (ev.content_block as { type: string }).type === "fallback"
        )
          json = "";
        if (ev.type !== "content_block_delta") return;
        if (ev.delta.type === "thinking_delta") {
          thinking += ev.delta.thinking;
          push();
        } else if (ev.delta.type === "text_delta") {
          json += ev.delta.text;
          push();
        }
      });
    }
    const { response } = await stream.withResponse();
    const data = await stream.finalMessage();
    return { response, data };
  };
  const { response, data } = await withFast(run);

  const record: CallRecord = {
    stage: "see",
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

  if (data.stop_reason === "refusal") {
    return { validation: { ok: false, errors: ["refused"] }, record };
  }
  const text = data.content.filter((b) => b.type === "text").at(-1)?.text;
  if (!text)
    return {
      validation: {
        ok: false,
        errors: [`no text output (stop_reason=${data.stop_reason})`],
      },
      record,
    };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      validation: { ok: false, errors: ["output is not valid JSON"] },
      record,
    };
  }
  return { validation: validateSee(json), record };
}
