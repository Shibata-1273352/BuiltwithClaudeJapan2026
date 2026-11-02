"""Build a layered scene from a photo and align it to a pre-processed artifact (FR-28..31, FR-30, FR-49).

  # 1) artifact preprocessing (cached under $DATA_DIR/cache/artifacts/<id>/; annotation is tracked in fixtures/)
  uv run python scripts/build_scene.py artifact met-56689 $DATA_DIR/samples/met_56689.jpg
  # 2) photo -> layers + anchors + alignment to the artifact
  uv run python scripts/build_scene.py photo $DATA_DIR/samples/kaminarimon_cc0.jpg --artifact met-56689

Outputs go to $DATA_DIR/cache/... ; scene.json describes layers, anchors, transform, timings.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts.bench import LOCK, data_dir, pick_device  # noqa: E402
from spatial import (  # noqa: E402
    Anchor,
    anchor_dicts,
    base_anchor,
    assign_layers,
    lantern_anchors,
    mask_bbox,
    representative_depth,
    scale_translate_fit,
    transform_params,
)

REPO = ROOT.parent.parent
ANNOTATIONS = REPO / "fixtures" / "artifacts"
PHOTO_PROMPTS = [
    ("lantern", "paper lantern"),
    ("lantern_base", "gold metal base of the lantern"),
    ("gate", "vermilion wooden structure"),
    ("people", "person"),
]
# Silhouette anchors: Hiroshige draws the paper body much larger relative to the base than the real
# lantern, so base-based anchors misalign the bodies. Align what the viewer perceives instead.
ALIGN_ANCHORS = ("bottom_center", "left_extreme")


class Models:
    @classmethod
    def from_loaded(cls, device: torch.device, sam_model, sam_proc, depth_model, depth_proc) -> "Models":
        """Reuse models already loaded by the inference server (no second copy in memory)."""
        m = cls.__new__(cls)
        m.device, m.sm, m.sp, m.dm, m.dp = device, sam_model, sam_proc, depth_model, depth_proc
        return m

    def __init__(self, device: torch.device):
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation, Sam3Model, Sam3Processor

        s, d = LOCK["sam3"], LOCK["depth"]
        self.device = device
        self.sp = Sam3Processor.from_pretrained(s["repo"], revision=s["revision"])
        self.sm = Sam3Model.from_pretrained(s["repo"], revision=s["revision"]).to(device).eval()
        self.dp = AutoImageProcessor.from_pretrained(d["repo"], revision=d["revision"])
        self.dm = AutoModelForDepthEstimation.from_pretrained(d["repo"], revision=d["revision"]).to(device).eval()

    @torch.inference_mode()
    def masks(self, img: Image.Image, text: str | None = None, box_px: list[float] | None = None):
        kw: dict = {}
        if text:
            kw["text"] = text
        if box_px:
            kw["input_boxes"] = [[box_px]]
            kw["input_boxes_labels"] = [[1]]
        inputs = self.sp(images=img, return_tensors="pt", **kw).to(self.device)
        out = self.sm(**inputs)
        post = self.sp.post_process_instance_segmentation(
            out, threshold=0.4, mask_threshold=0.5, target_sizes=inputs["original_sizes"].tolist()
        )[0]
        return post["masks"].cpu().numpy().astype(bool), post["scores"].cpu().tolist()

    @torch.inference_mode()
    def depth(self, img: Image.Image) -> np.ndarray:
        inputs = self.dp(images=img, return_tensors="pt").to(self.device)
        out = self.dm(**inputs)
        d = self.dp.post_process_depth_estimation(out, target_sizes=[(img.height, img.width)])[0]["predicted_depth"]
        return d.float().cpu().numpy()


def save_cutout(img: Image.Image, mask: np.ndarray, path: Path) -> None:
    rgba = np.dstack([np.asarray(img), (mask * 255).astype(np.uint8)])
    x1, y1, x2, y2 = mask_bbox(mask)
    w, h = img.size
    Image.fromarray(rgba).crop((int(x1 * w), int(y1 * h), int(x2 * w), int(y2 * h))).save(path)


def draw_anchors(img: Image.Image, anchors: list[Anchor], path: Path) -> None:
    im = img.copy()
    d = ImageDraw.Draw(im)
    r = max(6, img.width // 120)
    for a in anchors:
        x, y = a.x * img.width, a.y * img.height
        d.ellipse((x - r, y - r, x + r, y + r), outline=(0, 255, 255), width=max(2, r // 3))
        d.text((x + r + 2, y - r), a.name, fill=(0, 255, 255))
    im.save(path)


def save_display(img: Image.Image, path: Path, long_side: int = 2048) -> None:
    """Downscaled copy for the viewer (geometry stays in normalized coordinates)."""
    im = img.copy()
    im.thumbnail((long_side, long_side))
    im.save(path, quality=88)


def save_plate(img: Image.Image, masks: list[np.ndarray], path: Path, work_long_side: int = 512) -> None:
    """Inpaint lifted regions (OpenCV Telea) at reduced resolution, then upscale for display."""
    import cv2

    small = img.copy()
    small.thumbnail((work_long_side, work_long_side))
    if not masks:
        small.save(path, quality=88)
        return
    union = np.any(np.stack(masks), axis=0).astype(np.uint8) * 255
    m = cv2.resize(union, small.size, interpolation=cv2.INTER_NEAREST)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    bgr = cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2BGR)
    filled = cv2.inpaint(bgr, m, 3, cv2.INPAINT_TELEA)
    out = Image.fromarray(cv2.cvtColor(filled, cv2.COLOR_BGR2RGB))
    out = out.resize((min(img.width, 2048 * img.width // max(img.size)), min(img.height, 2048 * img.height // max(img.size))))
    out.save(path, quality=88)


def depth_png(depth: np.ndarray, path: Path) -> None:
    d = (depth - depth.min()) / max(float(depth.max() - depth.min()), 1e-6)
    Image.fromarray((d * 255).astype(np.uint8)).save(path)


def cmd_artifact(args, models: Models) -> None:
    ann_path = ANNOTATIONS / f"{args.id}.json"
    ann = json.loads(ann_path.read_text())
    img = Image.open(args.image).convert("RGB")
    out = data_dir() / "cache" / "artifacts" / args.id
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    bx = ann["lantern_box"]
    masks, scores = models.masks(img, box_px=[bx[0] * img.width, bx[1] * img.height, bx[2] * img.width, bx[3] * img.height])
    t_seg = time.perf_counter() - t0
    depth = models.depth(img)
    lantern = masks[0]
    np.save(out / "lantern_mask.npy", np.packbits(lantern))
    save_cutout(img, lantern, out / "lantern.png")
    depth_png(depth, out / "depth.png")
    save_display(img, out / "image.jpg")
    proposed = lantern_anchors(lantern)
    draw_anchors(img, proposed, out / "anchors_proposed.png")
    meta = {
        "id": args.id,
        "size": [img.width, img.height],
        "lantern": {"score": round(scores[0], 3), "bbox": [round(v, 4) for v in mask_bbox(lantern)],
                    "depth": round(representative_depth(depth, lantern), 3)},
        "anchors_proposed": anchor_dicts(proposed),
        "anchors_annotated": ann.get("anchors"),
        "annotated_by": ann.get("annotated_by"),
        "timings_ms": {"segment": round(t_seg * 1000)},
        "models": {k: LOCK[k]["revision"] for k in ("sam3", "depth")},
    }
    (out / "artifact.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(json.dumps(meta, ensure_ascii=False, indent=2))


def cmd_photo(args, models: Models) -> None:
    img = Image.open(args.image).convert("RGB")
    scene = build_photo_scene(models, img, Path(args.image).stem, args.artifact, image_name=Path(args.image).name)
    print(json.dumps(scene, ensure_ascii=False, indent=2))


def build_photo_scene(models: "Models", img: Image.Image, scene_id: str, artifact: str | None, image_name: str = "capture.jpg",
                      prompts: list[tuple[str, str]] | None = None) -> dict:
    """Masks + depth + layers + plate + anchors + alignment for one photo; writes $DATA_DIR/cache/scenes/<scene_id>/."""
    out = data_dir() / "cache" / "scenes" / scene_id
    out.mkdir(parents=True, exist_ok=True)
    timings: dict[str, int] = {}

    t0 = time.perf_counter()
    depth = models.depth(img)
    timings["depth"] = round((time.perf_counter() - t0) * 1000)
    depth_png(depth, out / "depth.png")
    save_display(img, out / "photo.jpg")

    elements: dict[str, dict] = {}
    masks_by_key: dict[str, np.ndarray] = {}
    for key, prompt in prompts or PHOTO_PROMPTS:
        t0 = time.perf_counter()
        masks, scores = models.masks(img, text=prompt)
        timings[f"segment_{key}"] = round((time.perf_counter() - t0) * 1000)
        if not len(masks):
            continue
        if key == "people":
            m = np.any(masks, axis=0)  # union of all people (P1 crowd layer)
            score = max(scores)
        else:
            m, score = masks[0], scores[0]
        if key == "gate" and "lantern" in masks_by_key:
            m = m & ~masks_by_key["lantern"]  # lantern floats in front of the gate
        masks_by_key[key] = m
        save_cutout(img, m, out / f"{key}.png")
        elements[key] = {
            "prompt": prompt,
            "score": round(float(score), 3),
            "bbox": [round(v, 4) for v in mask_bbox(m)],
            "area": round(float(m.mean()), 4),
            "depth": round(representative_depth(depth, m), 3),
            "png": f"{key}.png",
        }

    layers = assign_layers({k: v["depth"] for k, v in elements.items()}, depth)
    for k, layer in layers.items():
        elements[k]["layer"] = layer

    # Background plate: remove lifted (fore/midground) elements so no "ghost" stays behind them.
    t0 = time.perf_counter()
    lifted = [masks_by_key[k] for k, v in elements.items() if v["layer"] != "background"]
    save_plate(img, lifted, out / "plate.jpg")
    timings["plate"] = round((time.perf_counter() - t0) * 1000)

    scene: dict = {"image": image_name, "photo": "photo.jpg", "plate": "plate.jpg",
                   "size": [img.width, img.height], "elements": elements,
                   "depth_png": "depth.png", "timings_ms": timings}

    if "lantern" in masks_by_key:
        anchors = lantern_anchors(masks_by_key["lantern"])
        if "lantern_base" in masks_by_key:
            b = base_anchor(masks_by_key["lantern_base"])
            if b:
                anchors.append(b)
        scene["anchors"] = anchor_dicts(anchors)
        draw_anchors(img, anchors, out / "anchors.png")
        if artifact:
            scene["alignment"] = align(img, anchors, artifact, out)

    (out / "scene.json").write_text(json.dumps(scene, ensure_ascii=False, indent=2))
    return scene


def align(photo: Image.Image, photo_anchors: list[Anchor], artifact_id: str, out: Path) -> dict:
    ann = json.loads((ANNOTATIONS / f"{artifact_id}.json").read_text())
    art_img_path = data_dir() / "samples" / ann["image_file"]
    if not art_img_path.exists():
        art_img_path = data_dir() / "cache" / "artifacts" / artifact_id / "image.jpg"
    art = Image.open(art_img_path).convert("RGB")
    by_name = {a["name"]: a for a in ann["anchors"]}
    names = [a.name for a in photo_anchors if a.name in by_name and a.name in ALIGN_ANCHORS]
    if len(names) < 2:
        return {"ok": False, "reason": "fewer than 2 shared anchors"}
    src = [(a.x * photo.width, a.y * photo.height) for a in photo_anchors if a.name in names]
    dst = [(by_name[n]["x"] * art.width, by_name[n]["y"] * art.height) for n in names]
    t0 = time.perf_counter()
    m = scale_translate_fit(src, dst)
    # PIL wants the inverse map (output pixel -> input pixel)
    inv = np.linalg.inv(np.vstack([m, [0, 0, 1]]))[:2]
    warped = photo.transform(art.size, Image.Transform.AFFINE, tuple(inv.flatten()), resample=Image.Resampling.BICUBIC)
    alpha = photo.copy().convert("L").point(lambda _: 255).transform(
        art.size, Image.Transform.AFFINE, tuple(inv.flatten()))
    blend = Image.composite(Image.blend(art, warped, 0.5), art, alpha)
    blend.save(out / f"overlay_{artifact_id}.jpg", quality=88)
    elapsed = round((time.perf_counter() - t0) * 1000)
    return {"ok": True, "artifact": artifact_id, "anchors": names, "matrix_photo_px_to_artifact_px": m.round(5).tolist(),
            **{k: round(v, 4) for k, v in transform_params(m).items()},
            "overlay": f"overlay_{artifact_id}.jpg", "elapsed_ms": elapsed,
            "photo_size": [photo.width, photo.height], "artifact_size": [art.width, art.height],
            "artifact_anchors_annotated_by": ann["annotated_by"]}


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("artifact")
    a.add_argument("id")
    a.add_argument("image")
    p = sub.add_parser("photo")
    p.add_argument("image")
    p.add_argument("--artifact")
    ap.add_argument("--device")
    args = ap.parse_args()
    t0 = time.perf_counter()
    models = Models(pick_device(args.device))
    print(f"models loaded in {time.perf_counter() - t0:.1f}s", file=sys.stderr)
    {"artifact": cmd_artifact, "photo": cmd_photo}[args.cmd](args, models)


if __name__ == "__main__":
    main()
