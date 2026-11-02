"use client";

/**
 * On-device preprocessing (FR-02, FR-03, REQUIREMENTS.md 9.2). Raw images never leave the device:
 * - decode with EXIF orientation applied, downscale to 2048px long side
 * - detect faces (MediaPipe BlazeFace short-range on full image + tiles, same-origin assets) and mosaic them
 * - re-encode as JPEG via canvas, which drops all EXIF (incl. GPS)
 * Any failure throws: the caller must not send (fail closed).
 */
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { expandBox, fitWithin, mosaicCell, selectFaces, tiles, TILE_SIZES, type Box, type RawDetection } from "./geometry";

let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector(): Promise<FaceDetector> {
  detectorPromise ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.3, // low on purpose; selectFaces applies per-scale thresholds
    });
  })();
  try {
    return await detectorPromise;
  } catch (e) {
    detectorPromise = null;
    throw e;
  }
}

export type Prepared = {
  canvas: HTMLCanvasElement; // unblurred working copy stays local
  faces: Box[];
  width: number;
  height: number;
  /** All raw detections (for tuning and tests; never sent). */
  raw: RawDetection[];
};

export async function prepare(file: File): Promise<Prepared> {
  if (!file.type.startsWith("image/") || /svg/i.test(file.type)) throw new Error("unsupported file type");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { w, h } = fitWithin(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const detector = await getDetector();
  // Multi-scale tiles: the short-range model sees 128×128, so small (distant) faces need small tiles.
  const tileCanvas = document.createElement("canvas");
  const tctx = tileCanvas.getContext("2d");
  if (!tctx) throw new Error("canvas unavailable");
  const raw: RawDetection[] = [];
  for (const t of tiles(w, h, TILE_SIZES)) {
    tileCanvas.width = t.w;
    tileCanvas.height = t.h;
    tctx.drawImage(canvas, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h);
    for (const d of detector.detect(tileCanvas).detections) {
      const b = d.boundingBox;
      if (!b) continue;
      raw.push({
        x: t.x + b.originX,
        y: t.y + b.originY,
        w: b.width,
        h: b.height,
        score: d.categories[0]?.score ?? 0,
        tile: Math.max(t.w, t.h),
        full: t.w === w && t.h === h,
      });
    }
  }
  const faces = selectFaces(raw).map((b) => expandBox(b, w, h));
  return { canvas, faces, width: w, height: h, raw };
}

/** Draw the image with mosaics over all boxes onto `out` (preview and upload use the same pixels). */
export function render(src: HTMLCanvasElement, boxes: Box[], out: HTMLCanvasElement): void {
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d");
  if (!tctx) throw new Error("canvas unavailable");
  for (const b of boxes) {
    const cell = mosaicCell(b);
    const sw = Math.max(1, Math.round(b.w / cell));
    const sh = Math.max(1, Math.round(b.h / cell));
    tmp.width = sw;
    tmp.height = sh;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, sw, sh);
    ctx.drawImage(tmp, 0, 0, sw, sh, b.x, b.y, b.w, b.h);
  }
}

/** JPEG without EXIF (canvas encoding writes no metadata). */
export function toJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}
