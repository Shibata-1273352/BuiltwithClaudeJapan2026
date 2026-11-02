/**
 * Server-side upload checks (SEC-09, 9.4.3): JPEG only (magic bytes, not the file name),
 * size and pixel limits, and metadata stripping (APP1 EXIF/XMP, APP13 IPTC, COM) even though the
 * client already strips them — the server never trusts the client.
 */

export const UPLOAD_LIMITS = { maxBytes: 8 * 2 ** 20, maxSide: 4096, maxPixels: 4096 * 4096 } as const;

export type JpegInfo = { width: number; height: number; stripped: number; bytes: Uint8Array };

export class UploadError extends Error {
  constructor(
    public readonly code: "too_large" | "not_jpeg" | "corrupt" | "too_many_pixels",
    message: string,
  ) {
    super(message);
  }
}

const STRIP = new Set([0xe1, 0xe2, 0xed, 0xfe]); // APP1 (EXIF/XMP), APP2 (ICC/FlashPix), APP13 (IPTC), COM

export function checkAndStripJpeg(input: Uint8Array): JpegInfo {
  if (input.length > UPLOAD_LIMITS.maxBytes) throw new UploadError("too_large", "file too large");
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8 || input[2] !== 0xff) {
    throw new UploadError("not_jpeg", "not a JPEG");
  }
  const out: number[] = [0xff, 0xd8];
  let width = 0;
  let height = 0;
  let stripped = 0;
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) throw new UploadError("corrupt", "bad marker");
    const marker = input[i + 1];
    if (marker === 0xd9) break;
    if (marker === 0xda) {
      // start of scan: copy the rest verbatim
      for (let j = i; j < input.length; j++) out.push(input[j]);
      i = input.length;
      break;
    }
    if (i + 3 >= input.length) throw new UploadError("corrupt", "truncated");
    const len = (input[i + 2] << 8) | input[i + 3];
    if (len < 2 || i + 2 + len > input.length) throw new UploadError("corrupt", "bad segment length");
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = (input[i + 5] << 8) | input[i + 6];
      width = (input[i + 7] << 8) | input[i + 8];
    }
    if (STRIP.has(marker)) {
      stripped++;
    } else {
      for (let j = i; j < i + 2 + len; j++) out.push(input[j]);
    }
    i += 2 + len;
  }
  if (!width || !height) throw new UploadError("corrupt", "no frame header");
  if (Math.max(width, height) > UPLOAD_LIMITS.maxSide || width * height > UPLOAD_LIMITS.maxPixels) {
    throw new UploadError("too_many_pixels", "image dimensions too large");
  }
  return { width, height, stripped, bytes: Uint8Array.from(out) };
}
