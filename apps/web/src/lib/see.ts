/**
 * Stage 1 "視る": cultural elements and place candidates from a photo (FR-06, FR-07).
 * Claude proposes; `validateSee` (packages/core) verifies before anything is used.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SeeOutput, UNTRUSTED_POLICY, validateSee, type SeeValidation } from "@tsumugi/core";
import { CLAUDE_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";

export const SEE_SYSTEM = `You are the "see" stage of TSUMUGI, which links a traveler's photo of a Japanese place to historical sources.

Look at the photo and return:
- elements: up to 8 culturally meaningful objects (lanterns, gates, signboards, statues, roofs...). For each, a tight bounding box normalized to the image (x, y = top-left; w, h = size; all 0-1), the characters written on it exactly as they appear (text_original, or null), a Hepburn reading, and short meanings in English and Japanese. Use a concrete English label that would work as a segmentation prompt.
- places: up to 3 candidate locations, most likely first (rank 1..n). Give each as a hierarchy from broad to specific using types area > site > structure, with the visible cues that support it.
- viewpoint: a qualitative guess, without geometry, of where the photographer stands and which way the camera faces, from the composition and the known layout of the rank-1 place. List the premises the guess depends on (1-4, e.g. "the great lantern hangs in the south opening of the gate"). Use null if you cannot tell. It is shown as an interpretation in pencil, never as evidence.

Rules:
- Report only what is visible. If writing is partly hidden, transcribe what you can see and say so in notes.
- Do not identify or describe people.
- ${UNTRUSTED_POLICY}`;

export type SeeResult = { validation: SeeValidation; record: CallRecord };

export async function seePhoto(image: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }): Promise<SeeResult> {
  const startedAt = new Date();
  // create() (not parse()) so the raw response headers are available; validateSee parses the JSON.
  const { data, response } = await claude()
    .beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(SeeOutput) },
      system: [{ type: "text", text: SEE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
            { type: "text", text: "Analyze this photo." },
          ],
        },
      ],
    })
    .withResponse();

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
  const text = data.content.find((b) => b.type === "text")?.text;
  if (!text) return { validation: { ok: false, errors: [`no text output (stop_reason=${data.stop_reason})`] }, record };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { validation: { ok: false, errors: ["output is not valid JSON"] }, record };
  }
  return { validation: validateSee(json), record };
}
