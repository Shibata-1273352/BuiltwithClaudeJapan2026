import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAndStripJpeg, UploadError } from "./jpeg";

/** Minimal JPEG-shaped bytes: SOI, APP1 Exif, SOF0 (w×h), SOS, payload, EOI. */
function fakeJpeg(w: number, h: number, withExif = true): Uint8Array {
  const exif = [0xff, 0xe1, 0x00, 0x0a, ...Buffer.from("Exif\0\0"), 0x01, 0x02];
  const sof = [0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00];
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9];
  return Uint8Array.from([0xff, 0xd8, ...(withExif ? exif : []), ...sof, ...sos]);
}

describe("checkAndStripJpeg (SEC-09)", () => {
  it("reads dimensions and strips EXIF", () => {
    const r = checkAndStripJpeg(fakeJpeg(2048, 1536));
    expect([r.width, r.height, r.stripped]).toEqual([2048, 1536, 1]);
    expect(Buffer.from(r.bytes).includes(Buffer.from("Exif"))).toBe(false);
  });

  it("rejects non-JPEG content regardless of name (e.g. SVG / PNG)", () => {
    expect(() => checkAndStripJpeg(Buffer.from("<svg onload=alert(1)>"))).toThrow(UploadError);
    expect(() => checkAndStripJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toThrow(/not a JPEG/);
  });

  it("rejects huge pixel counts (decompression bombs)", () => {
    expect(() => checkAndStripJpeg(fakeJpeg(30000, 30000))).toThrow(/dimensions/);
  });

  it("rejects oversized files", () => {
    const big = new Uint8Array(9 * 2 ** 20);
    big.set([0xff, 0xd8, 0xff]);
    expect(() => checkAndStripJpeg(big)).toThrow(/too large/);
  });

  it("rejects corrupt segment lengths", () => {
    expect(() => checkAndStripJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]))).toThrow(UploadError);
  });

  it("strips real EXIF+GPS from a camera JPEG when available", () => {
    const p = `${process.env.HOME}/tsumugi-data/samples/faces/test_exif_gps_4096.jpg`;
    let buf: Buffer;
    try {
      buf = readFileSync(p);
    } catch {
      return; // sample not present in CI
    }
    const r = checkAndStripJpeg(buf);
    expect(r.width).toBe(4096);
    expect(r.stripped).toBeGreaterThan(0);
    expect(Buffer.from(r.bytes).includes(Buffer.from("Exif"))).toBe(false);
  });
});
