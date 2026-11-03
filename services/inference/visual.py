"""Visual search (FR-58, 4.4 F): image embeddings of a photo crop (e.g. the great lantern) against a
pre-indexed gallery of prints. Each print is indexed as the full image plus overlapping tiles at two
scales, so a lantern that fills a small part of a print can still be found; an item's score is its
best-matching crop. Similarity is a pointer to look at, never evidence (the UI says so).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from scripts.bench import LOCK

GRIDS = (2, 3)  # tiles per side; tiles overlap by 1/3 of their size
# models.lock.json key. so400m: the lantern finds Hiroshige's Kinryūzan print at rank 1 where the
# base model ranks it ~21st of 118 (docs/verification/visual-search.md). fp16 on GPU: same ranking, 1.8 GB.
MODEL_KEY = os.environ.get("VISUAL_MODEL", "siglip_large")


def index_dir(data: Path) -> Path:
    return data / "cache" / "visual" / f"index-{MODEL_KEY}"


def load(device: torch.device):
    from transformers import AutoImageProcessor, AutoModel

    spec = LOCK[MODEL_KEY]
    proc = AutoImageProcessor.from_pretrained(spec["repo"], revision=spec["revision"])  # images only: no tokenizer
    dtype = torch.float16 if device.type in ("mps", "cuda") else torch.float32
    model = AutoModel.from_pretrained(spec["repo"], revision=spec["revision"], use_safetensors=True, torch_dtype=dtype).to(device).eval()
    return model, proc


@torch.inference_mode()
def embed(model, proc, device: torch.device, images: list[Image.Image], batch: int = 16) -> np.ndarray:
    out = []
    for i in range(0, len(images), batch):
        inputs = proc(images=[im.convert("RGB") for im in images[i : i + batch]], return_tensors="pt").to(device)
        inputs["pixel_values"] = inputs["pixel_values"].to(next(model.parameters()).dtype)
        f = model.get_image_features(**inputs)
        if not isinstance(f, torch.Tensor):  # newer transformers return an output object
            f = f.pooler_output
        f = f / f.norm(dim=-1, keepdim=True)
        out.append(f.float().cpu().numpy())
    return np.concatenate(out) if out else np.zeros((0, 768), dtype=np.float32)


def crops(img: Image.Image, lanterns: list[dict] | None = None) -> list[tuple[str, Image.Image, list[float]]]:
    """(name, image, normalized box). Grid tiles at two scales, plus the lanterns SAM 3 found in the
    print (FR-58: the photo's lantern is compared with the print's lantern itself)."""
    w, h = img.size
    out = [("full", img, [0.0, 0.0, 1.0, 1.0])]
    for g in GRIDS:
        tw, th = w / (g - (g - 1) / 3), h / (g - (g - 1) / 3)  # tiles overlap by a third
        sx, sy = (w - tw) / max(1, g - 1), (h - th) / max(1, g - 1)
        for r in range(g):
            for c in range(g):
                x, y = c * sx, r * sy
                out.append((f"g{g}r{r}c{c}", img.crop((round(x), round(y), round(x + tw), round(y + th))), [x / w, y / h, (x + tw) / w, (y + th) / h]))
    for k, lan in enumerate(lanterns or []):
        x1, y1, x2, y2 = lan["bbox"]
        mx, my = (x2 - x1) * 0.1, (y2 - y1) * 0.1  # a little context around the lantern
        b = [max(0.0, x1 - mx), max(0.0, y1 - my), min(1.0, x2 + mx), min(1.0, y2 + my)]
        if (b[2] - b[0]) * w < 16 or (b[3] - b[1]) * h < 16:
            continue
        out.append((f"sam{k}", img.crop((round(b[0] * w), round(b[1] * h), round(b[2] * w), round(b[3] * h))), b))
    return out


def build_index(model, proc, device, gallery: list[dict], image_dir: Path, out: Path, lanterns: dict | None = None) -> dict:
    vecs, owners, names, boxes = [], [], [], []
    for i, item in enumerate(gallery):
        img = Image.open(image_dir / item["file"]).convert("RGB")
        cs = crops(img, (lanterns or {}).get(item["id"]))
        vecs.append(embed(model, proc, device, [c for _, c, _ in cs]))
        owners += [i] * len(cs)
        names += [n for n, _, _ in cs]
        boxes += [[round(v, 4) for v in b] for _, _, b in cs]
    mat = np.concatenate(vecs).astype(np.float32)
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "vectors.npy", mat)
    (out / "index.json").write_text(json.dumps({"model": LOCK[MODEL_KEY], "items": gallery, "owners": owners, "crops": names, "boxes": boxes, "sam_lanterns": bool(lanterns)}, ensure_ascii=False))
    return {"items": len(gallery), "crops": len(owners), "dim": int(mat.shape[1]), "sam_crops": sum(n.startswith("sam") for n in names)}


class Index:
    def __init__(self, path: Path):
        self.meta = json.loads((path / "index.json").read_text())
        self.vectors = np.load(path / "vectors.npy")
        self.owners = np.array(self.meta["owners"])

    def search(self, q: np.ndarray, k: int = 5) -> list[dict]:
        sims = self.vectors @ q.reshape(-1)
        best: dict[int, tuple[float, int]] = {}
        for j, s in enumerate(sims):
            o = int(self.owners[j])
            if o not in best or s > best[o][0]:
                best[o] = (float(s), j)
        ranked = sorted(best.items(), key=lambda kv: -kv[1][0])[:k]
        boxes = self.meta.get("boxes")
        return [
            {
                **{x: self.meta["items"][o][x] for x in ("id", "title", "commons", "license", "file")},
                "score": round(s, 4),
                "crop": self.meta["crops"][j],
                "box": boxes[j] if boxes else [0.0, 0.0, 1.0, 1.0],
            }
            for o, (s, j) in ranked
        ]
