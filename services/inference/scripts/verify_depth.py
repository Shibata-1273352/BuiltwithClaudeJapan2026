"""Day-1 check: Depth Anything V2 Small on Apple Silicon.

Writes a normalized depth PNG to $DATA_DIR/out/depth/ and prints latency / memory.

  uv run python scripts/verify_depth.py IMAGE [--device mps|cpu]
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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--device")
    args = ap.parse_args()

    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    device = pick_device(args.device)
    img = Image.open(args.image).convert("RGB")
    out_dir = data_dir() / "out" / "depth"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(args.image).stem
    m = LOCK["depth"]
    results: dict = {"model": m["repo"], "revision": m["revision"], "device": str(device),
                     "image": Path(args.image).name, "size": [img.width, img.height]}

    with capture_fallback_warnings(results):
        with timed(results, "load_ms", device):
            processor = AutoImageProcessor.from_pretrained(m["repo"], revision=m["revision"])
            model = AutoModelForDepthEstimation.from_pretrained(m["repo"], revision=m["revision"]).to(device).eval()
        results["mem_after_load"] = mem_snapshot(device)

        inputs = processor(images=img, return_tensors="pt").to(device)
        with torch.inference_mode():
            model(**inputs)  # warmup
            with timed(results, "infer_ms", device):
                out = model(**inputs)
        depth = processor.post_process_depth_estimation(out, target_sizes=[(img.height, img.width)])[0][
            "predicted_depth"
        ].float().cpu().numpy()
        results["mem_peak_after_infer"] = mem_snapshot(device)

    d = (depth - depth.min()) / max(float(depth.max() - depth.min()), 1e-6)
    Image.fromarray((d * 255).astype(np.uint8)).save(out_dir / f"{stem}_depth.png")
    np.save(out_dir / f"{stem}_depth.npy", depth.astype(np.float16))
    results["depth_range"] = [round(float(depth.min()), 3), round(float(depth.max()), 3)]

    (out_dir / f"{stem}_{device.type}.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
