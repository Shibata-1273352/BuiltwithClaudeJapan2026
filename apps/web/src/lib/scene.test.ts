import { describe, expect, it } from "vitest";
import { artifactRectInPhoto, depthCompensation, easeInOut, framePlane, photoWorldSize, rectToPlane, type SceneJson, shouldFall2D } from "./scene";

describe("scene geometry", () => {
  it("maps the full photo to a centered plane", () => {
    const world = photoWorldSize([1600, 2000]);
    expect(world).toEqual({ w: 1.6, h: 2 });
    expect(rectToPlane([0, 0, 1, 1], world)).toEqual({ x: 0, y: 0, w: 1.6, h: 2 });
  });

  it("places a top-left quarter correctly (y up)", () => {
    const p = rectToPlane([0, 0, 0.5, 0.5], { w: 2, h: 2 });
    expect(p).toEqual({ x: -0.5, y: 0.5, w: 1, h: 1 });
  });

  it("compensates scale so projected size is unchanged", () => {
    const z = 1;
    const s = depthCompensation(z, 4);
    // projected size ∝ size / (cameraZ - z)
    expect((1 * s) / (4 - z)).toBeCloseTo(1 / 4);
  });

  it("frames a plane so it fills the view (FR-33)", () => {
    const f = framePlane({ x: 0.5, y: -0.2, w: 1, h: 2 }, 0.9, 30, 1.6, 1);
    // projected height at the plane = 2 * d * tan(15°) must equal the plane height (2)
    const d = f.position[2] - 0.9;
    expect(2 * d * Math.tan(Math.PI / 12)).toBeCloseTo(2);
    expect(f.target).toEqual([0.5, -0.2, 0.9]);
    // a wide plane is limited by width
    const g = framePlane({ x: 0, y: 0, w: 4, h: 1 }, 0, 30, 1, 1);
    expect(2 * g.position[2] * Math.tan(Math.PI / 12)).toBeCloseTo(4);
  });

  it("eases in and out monotonically within 0..1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.25)).toBeLessThan(easeInOut(0.3));
  });

  it("inverts the photo->artifact transform", () => {
    const a = {
      ok: true,
      artifact: "x",
      matrix_photo_px_to_artifact_px: [
        [2, 0, 100],
        [0, 2, -50],
      ],
      photo_size: [100, 200],
      artifact_size: [300, 350],
      artifact_anchors_annotated_by: "test",
      scale: 2,
    } as NonNullable<SceneJson["alignment"]>;
    const [x1, y1, x2, y2] = artifactRectInPhoto(a);
    expect(x1).toBeCloseTo(-0.5); // (0-100)/2/100
    expect(y1).toBeCloseTo(0.125); // (0+50)/2/200
    expect(x2).toBeCloseTo(1); // (300-100)/2/100
    expect(y2).toBeCloseTo(1); // (350+50)/2/200
  });
});

describe("shouldFall2D (FR-37)", () => {
  it("ignores the first second and needs three slow seconds in a row", () => {
    expect(shouldFall2D([5, 60, 60, 60])).toBe(false);
    expect(shouldFall2D([5, 25, 28, 29])).toBe(true);
    expect(shouldFall2D([5, 25, 40, 25, 25])).toBe(false);
    expect(shouldFall2D([60, 60, 20, 20, 20])).toBe(true);
  });
});
