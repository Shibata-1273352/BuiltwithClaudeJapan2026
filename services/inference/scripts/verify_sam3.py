"""Day-1 check: SAM 3 on Apple Silicon (REQUIREMENTS.md 14, open item 2).

Runs a text prompt and a box prompt, records latency / memory / MPS fallbacks, and writes
mask overlays to $DATA_DIR/out/sam3/.

  uv run python scripts/verify_sam3.py IMAGE [--text "paper lantern"] [--box x1 y1 x2 y2] [--device mps|cpu]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench import LOCK, capture_fallback_warnings, data_dir, mem_snapshot, pick_device, timed  # noqa: E402

MAX_PIXELS = 4096 * 4096


def overlay(img: Image.Image, masks: np.ndarray, path: Path) -> None:
    base = np.asarray(img).astype(np.float32)
    colors = [(255, 196, 64), (64, 200, 255), (255, 96, 160), (120, 255, 120)]
    for i, m in enumerate(masks):
        c = np.array(colors[i % len(colors)], dtype=np.float32)
        base[m] = base[m] * 0.45 + c * 0.55
    Image.fromarray(base.clip(0, 255).astype(np.uint8)).save(path)


def run(model, processor, img, device, results, key, **prompt):
    inputs = processor(images=img, return_tensors="pt", **prompt).to(device)
    with timed(results, f"{key}_ms", device), torch.inference_mode():
        outputs = model(**inputs)
    post = processor.post_process_instance_segmentation(
        outputs, threshold=0.4, mask_threshold=0.5, target_sizes=inputs.get("original_sizes").tolist()
    )[0]
    masks = post["masks"].cpu().numpy().astype(bool)
    scores = post["scores"].cpu().tolist()
    results[f"{key}_instances"] = len(masks)
    results[f"{key}_scores"] = [round(s, 3) for s in scores]
    if len(masks):
        ys, xs = np.nonzero(masks[0])
        h, w = masks[0].shape
        results[f"{key}_top_bbox_norm"] = [
            round(xs.min() / w, 3), round(ys.min() / h, 3), round(xs.max() / w, 3), round(ys.max() / h, 3)
        ]
        results[f"{key}_top_area_frac"] = round(float(masks[0].mean()), 4)
    return masks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--text", default="paper lantern")
    ap.add_argument("--box", nargs=4, type=float, metavar=("X1", "Y1", "X2", "Y2"))
    ap.add_argument("--device")
    args = ap.parse_args()

    from transformers import Sam3Model, Sam3Processor

    device = pick_device(args.device)
    img = Image.open(args.image)
    if img.width * img.height > MAX_PIXELS:
        raise SystemExit("image too large")
    img = img.convert("RGB")

    out_dir = data_dir() / "out" / "sam3"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(args.image).stem
    m = LOCK["sam3"]
    results: dict = {"model": m["repo"], "revision": m["revision"], "device": str(device),
                     "image": Path(args.image).name, "size": [img.width, img.height], "text": args.text}
    results["mem_before"] = mem_snapshot(device)

    with capture_fallback_warnings(results):
        with timed(results, "load_ms", device):
            processor = Sam3Processor.from_pretrained(m["repo"], revision=m["revision"])
            model = Sam3Model.from_pretrained(m["repo"], revision=m["revision"]).to(device).eval()
        results["mem_after_load"] = mem_snapshot(device)

        run(model, processor, img, device, results, "warmup", text=args.text)
        masks = run(model, processor, img, device, results, "text", text=args.text)
        overlay(img, masks[:4], out_dir / f"{stem}_text.png")

        if args.box:
            masks = run(model, processor, img, device, results, "box",
                        input_boxes=[[list(args.box)]], input_boxes_labels=[[1]])
            overlay(img, masks[:4], out_dir / f"{stem}_box.png")
        results["mem_peak_after_infer"] = mem_snapshot(device)

    del model
    if device.type == "mps":
        torch.mps.empty_cache()
    results["mem_after_release"] = mem_snapshot(device)

    (out_dir / f"{stem}_{device.type}.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
