"""FR-58 / FR-49: build the visual-search index from corpus/visual-gallery.json, then (optionally)
query it with a crop of a scene photo to check that the lantern finds lantern prints.

  uv run python scripts/visual_index.py build
  uv run python scripts/visual_index.py query <scene_id> <element>   # e.g. kaminarimon_cc0 lantern
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.bench import pick_device  # noqa: E402
import visual  # noqa: E402

REPO = ROOT.parent.parent
DATA = Path(os.environ["DATA_DIR"])
OUT = visual.index_dir(DATA)


def scene_crop(scene_id: str, element: str) -> Image.Image:
    d = DATA / "cache" / "scenes" / scene_id
    s = json.loads((d / "scene.json").read_text())
    img = Image.open(d / "photo.jpg").convert("RGB")
    x1, y1, x2, y2 = s["elements"][element]["bbox"]
    return img.crop((round(x1 * img.width), round(y1 * img.height), round(x2 * img.width), round(y2 * img.height)))


def main() -> None:
    device = pick_device(os.environ.get("INFERENCE_DEVICE"))
    model, proc = visual.load(device)
    if sys.argv[1] == "build":
        gallery = json.loads((REPO / "corpus" / "visual-gallery.json").read_text())["items"]
        t0 = time.perf_counter()
        info = visual.build_index(model, proc, device, gallery, DATA / "cache" / "visual" / "images", OUT)
        print(json.dumps({**info, "seconds": round(time.perf_counter() - t0, 1)}))
    elif sys.argv[1] == "check":
        # FR-58 acceptance: the lantern cut-out of each scene finds a lantern print within the top 5.
        # Gold: prints whose great lantern is the subject (checked by eye on a contact sheet).
        gold = ("Kinryūzan Temple in Asakusa",)
        idx = visual.Index(OUT)
        rows = []
        for scene in sys.argv[2:]:
            q = visual.embed(model, proc, device, [scene_crop(scene, "lantern")])[0]
            hits = idx.search(q, k=len(idx.meta["items"]))
            rank = next((i + 1 for i, h in enumerate(hits) if h["title"] in gold), None)
            rows.append({"scene": scene, "rank": rank, "top5": [h["title"] for h in hits[:5]], "in_top5": bool(rank and rank <= 5)})
        print(json.dumps({"recall_at_5": sum(r["in_top5"] for r in rows) / len(rows), "rows": rows}, ensure_ascii=False, indent=1))
    else:
        q = visual.embed(model, proc, device, [scene_crop(sys.argv[2], sys.argv[3])])[0]
        for r in visual.Index(OUT).search(q, k=int(sys.argv[4]) if len(sys.argv) > 4 else 10):
            print(f"{r['score']:.3f}  {r['crop']:8s}  {r['title']}")


if __name__ == "__main__":
    main()
