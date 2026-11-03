"""FR-58 with SAM 3: find the lanterns IN each gallery print (text prompt), so the photo's lantern is
compared with the prints' lanterns, and the page can show where the lantern is in the print.
Writes $DATA_DIR/cache/visual/lanterns.json {item id: [{score, bbox (normalized)}, ...]}.

  uv run python scripts/visual_lanterns.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import torch
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.bench import LOCK, pick_device  # noqa: E402
from spatial import mask_bbox  # noqa: E402

# Two prompts: "paper lantern" finds small lanterns; the great lantern of Kaminarimon (e.g. in Hiroshige's
# Kinryūzan print) is found only as "large red lantern" (0.69 vs ~0.1). Note: this second prompt was chosen
# after looking at that print, so it is tuned to the demo case (docs/verification/visual-search.md).
PROMPTS = ("paper lantern", "large red lantern")
MIN_SCORE = 0.5
DATA = Path(os.environ["DATA_DIR"])
REPO = ROOT.parent.parent


def main() -> None:
    from transformers import Sam3Model, Sam3Processor

    device = pick_device(os.environ.get("INFERENCE_DEVICE"))
    s = LOCK["sam3"]
    proc = Sam3Processor.from_pretrained(s["repo"], revision=s["revision"])
    model = Sam3Model.from_pretrained(s["repo"], revision=s["revision"]).to(device).eval()
    gallery = json.loads((REPO / "corpus" / "visual-gallery.json").read_text())["items"]
    out: dict[str, list[dict]] = {}
    t0 = time.perf_counter()
    for item in gallery:
        img = Image.open(DATA / "cache" / "visual" / "images" / item["file"]).convert("RGB")
        found = []
        for prompt in PROMPTS:
            with torch.inference_mode():
                inputs = proc(images=img, text=prompt, return_tensors="pt").to(device)
                res = model(**inputs)
                post = proc.post_process_instance_segmentation(res, threshold=0.4, mask_threshold=0.5, target_sizes=inputs["original_sizes"].tolist())[0]
            found += [
                {"score": round(float(sc), 3), "bbox": [round(v, 4) for v in mask_bbox(m)], "prompt": prompt}
                for m, sc in zip(post["masks"].cpu().numpy().astype(bool), post["scores"].cpu().tolist())
                if sc >= MIN_SCORE and m.any()
            ]
        if found:
            out[item["id"]] = sorted(found, key=lambda f: -f["score"])[:3]
    (DATA / "cache" / "visual" / "lanterns.json").write_text(json.dumps({"prompts": PROMPTS, "min_score": MIN_SCORE, "model": s, "items": out}, ensure_ascii=False, indent=1))
    print(json.dumps({"prints": len(gallery), "with_lantern": len(out), "seconds": round(time.perf_counter() - t0, 1)}))


if __name__ == "__main__":
    main()
