/**
 * Scene geometry for the layered 3D view (FR-31, FR-32). Pure functions, unit-tested.
 * World units: photo height = 2; x right, y up; camera looks down -z.
 */

export type SceneElement = {
  prompt: string;
  score: number;
  bbox: [number, number, number, number]; // normalized x1,y1,x2,y2 (top-left origin)
  area: number;
  depth: number;
  png: string;
  layer: "foreground" | "midground" | "background";
};

export type SceneJson = {
  image: string;
  photo: string;
  /** Background with lifted elements inpainted, so no ghost remains behind them. */
  plate?: string;
  size: [number, number];
  elements: Record<string, SceneElement>;
  anchors?: { name: string; x: number; y: number }[];
  alignment?: {
    ok: boolean;
    artifact: string;
    matrix_photo_px_to_artifact_px: [[number, number, number], [number, number, number]];
    photo_size: [number, number];
    artifact_size: [number, number];
    artifact_anchors_annotated_by: string;
    scale: number;
  };
  timings_ms: Record<string, number>;
};

export const LAYER_Z: Record<SceneElement["layer"], number> = { foreground: 0.9, midground: 0.45, background: 0.15 };
export const CAMERA_Z = 4;

export function photoWorldSize(size: [number, number]): { w: number; h: number } {
  return { w: (2 * size[0]) / size[1], h: 2 };
}

/** Plane for a normalized rect, before depth compensation. */
export function rectToPlane(bbox: [number, number, number, number], world: { w: number; h: number }) {
  const [x1, y1, x2, y2] = bbox;
  return {
    x: ((x1 + x2) / 2 - 0.5) * world.w,
    y: (0.5 - (y1 + y2) / 2) * world.h,
    w: (x2 - x1) * world.w,
    h: (y2 - y1) * world.h,
  };
}

/**
 * Scale applied to a plane moved to depth z so that, from the initial camera, it covers exactly
 * the same pixels as in the flat photo (the photo "splits" without jumping).
 */
export function depthCompensation(z: number, cameraZ = CAMERA_Z): number {
  return (cameraZ - z) / cameraZ;
}

/**
 * Where the whole artifact image lands in photo-normalized coordinates, given the photo->artifact
 * pixel transform (scale + translation; rotation is not used for upright lanterns).
 */
export function artifactRectInPhoto(a: NonNullable<SceneJson["alignment"]>): [number, number, number, number] {
  const [[k, , tx], [, k2, ty]] = a.matrix_photo_px_to_artifact_px;
  const [pw, ph] = a.photo_size;
  const [aw, ah] = a.artifact_size;
  // inverse map: photo_px = (artifact_px - t) / k
  const x1 = (0 - tx) / k / pw;
  const y1 = (0 - ty) / k2 / ph;
  const x2 = (aw - tx) / k / pw;
  const y2 = (ah - ty) / k2 / ph;
  return [x1, y1, x2, y2];
}
