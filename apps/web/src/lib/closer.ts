/**
 * 寄って読む: small writing in the photo, read again from a close crop. At the size of the whole photo
 * a plate's first line is lost (measured: 4 of 4 reads stop at the name; from the crop, 3 of 3 read both
 * lines). Code picks what to look at, crops it, and keeps the new reading only if it contains the old one.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { UNTRUSTED_POLICY, type SeeOutput } from "@tsumugi/core";
import sharp from "sharp";
import { z } from "zod";
import { CLAUDE_MODEL, FAST_BETA, claude, costOf, rateLimitHeaders, withFast, type CallRecord } from "./claude";
import { callStarted } from "./dag/call-notice";

const SMALL = 0.0065; // of the photo's area per character: writing this small is worth a closer look
const MAX = 2;
const LONG_SIDE = 1500; // the crop is enlarged to about what the model takes in

const CloserOutput = z.object({
  text_original: z.string().nullable().describe("every line written on the plate or sign, in reading order, a space between lines; null if unreadable"),
  reading: z.string().nullable().describe("romanized reading of text_original (Hepburn), or null"),
});

export const CLOSER_SYSTEM = `You read the writing on one plate or sign in a close crop of a traveler's photo.
Transcribe every line exactly as it appears, in reading order, with a space between lines. The crop is enlarged and may be soft: give what is written, and return null rather than guess at a line you cannot make out.
- ${UNTRUSTED_POLICY}`;

/** The written elements with the smallest characters, smallest first (Claude's boxes vary from run to run). */
export function closerTargets(see: Pick<SeeOutput, "elements">): number[] {
  return see.elements
    .map((e, i) => ({ i, each: (e.box.w * e.box.h) / Math.max(1, e.text_original?.replace(/\s/g, "").length ?? 0), text: e.text_original }))
    .filter((e) => e.text && e.each > 0 && e.each < SMALL)
    .sort((a, b) => a.each - b.each)
    .slice(0, MAX)
    .map((e) => e.i);
}

/** The box with room around it, in pixels of the photo, inside the photo. */
export function cropOf(box: { x: number; y: number; w: number; h: number }, width: number, height: number) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // at least this much of the photo: Claude's box for small writing can sit a tenth of the photo away
  const w = Math.max(box.w * 2.5, 0.4);
  const h = Math.max(box.h * 2.4, 0.26);
  const left = Math.max(0, Math.round((cx - w / 2) * width));
  const top = Math.max(0, Math.round((cy - h / 2) * height));
  return { left, top, width: Math.max(1, Math.min(Math.round(w * width), width - left)), height: Math.max(1, Math.min(Math.round(h * height), height - top)) };
}

/** A reading is only ever extended: every character read before must still be there, in order. */
export function extends_(before: string, after: string): boolean {
  const old = before.replace(/\s/g, "");
  const now = after.replace(/\s/g, "");
  return now.length > old.length && now.includes(old);
}

export async function readCloser(photo: Buffer, box: { x: number; y: number; w: number; h: number }): Promise<{ text_original: string | null; reading: string | null; record: CallRecord }> {
  const startedAt = new Date();
  callStarted("closer", startedAt);
  const meta = await sharp(photo).metadata();
  const crop = cropOf(box, meta.width as number, meta.height as number);
  const jpeg = await sharp(photo).extract(crop).resize({ width: Math.round((crop.width * LONG_SIDE) / Math.max(crop.width, crop.height)), kernel: "lanczos3" }).jpeg({ quality: 92 }).toBuffer();
  const { data, response } = await withFast((fast) =>
    claude()
      .beta.messages.create(
        {
          model: CLAUDE_MODEL,
          ...(fast ? { speed: "fast" as const } : {}),
          max_tokens: 2000,
          betas: ["server-side-fallback-2026-07-01", ...(fast ? [FAST_BETA] : [])],
          fallbacks: "default",
          output_config: { effort: "low", format: betaZodOutputFormat(CloserOutput) },
          system: [{ type: "text", text: CLOSER_SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } }, { type: "text", text: "Read the writing on this plate." }] }],
        },
        { timeout: 20_000 },
      )
      .withResponse(),
  );
  const record: CallRecord = {
    stage: "closer",
    model: CLAUDE_MODEL,
    servedModel: data.model,
    startedAt: startedAt.toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    stopReason: data.stop_reason,
    usage: { input: data.usage.input_tokens, output: data.usage.output_tokens, cacheRead: data.usage.cache_read_input_tokens ?? 0, cacheWrite: data.usage.cache_creation_input_tokens ?? 0 },
    costUsd: costOf(data.usage),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.filter((b) => b.type === "text").at(-1)?.text;
  const parsed = text && data.stop_reason !== "refusal" ? CloserOutput.safeParse(JSON.parse(text)) : null;
  return { text_original: parsed?.success ? parsed.data.text_original : null, reading: parsed?.success ? parsed.data.reading : null, record };
}
