/**
 * FR-35 視点の見立て: a separate, small Claude call (run in parallel once the place is known, so it
 * does not lengthen the critical path). Qualitative, no geometry; shown in pencil with premises.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { UNTRUSTED_POLICY, validateViewpoint, ViewpointOutput, type Viewpoint } from "@tsumugi/core";
import { CLAUDE_LIGHT_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";

export const VIEWPOINT_SYSTEM = `You are the "viewpoint" step of TSUMUGI. The place in the photo has already been identified (given below).

Return viewpoint: a qualitative guess, without geometry, of where the photographer stands and which way the camera faces, from the composition and the known layout of that place. Give position and toward in Japanese and English, the compass direction faced ("up" when mainly looking up), and the premises the guess depends on (1-4 short items, e.g. "the great lantern hangs in the south opening of the gate"). Use null if you cannot tell. It is shown as an interpretation in pencil, never as evidence.

Rules:
- Do not identify or describe people.
- ${UNTRUSTED_POLICY}`;

export async function guessViewpoint(
  image: { base64: string; mediaType: "image/jpeg" },
  place: string,
): Promise<{ value: Viewpoint | null; errors: string[]; record: CallRecord }> {
  const startedAt = new Date();
  const { data, response } = await claude()
    .beta.messages.create({
      model: CLAUDE_LIGHT_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ViewpointOutput) },
      system: [{ type: "text", text: VIEWPOINT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
            { type: "text", text: `Place (from the dictionary): ${place}` },
          ],
        },
      ],
    })
    .withResponse();
  const record: CallRecord = {
    stage: "viewpoint",
    model: CLAUDE_LIGHT_MODEL,
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
    costUsd: costOf(data.usage, CLAUDE_LIGHT_MODEL),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  if (data.stop_reason === "refusal" || !text) return { value: null, errors: ["no output"], record };
  try {
    const v = validateViewpoint(JSON.parse(text));
    return v.ok ? { value: v.value, errors: [], record } : { value: null, errors: v.errors, record };
  } catch {
    return { value: null, errors: ["output is not valid JSON"], record };
  }
}
