"""Visual search (FR-58, 4.4 F): image embeddings of a photo crop (e.g. the great lantern) against a
pre-indexed gallery of prints. Each print is indexed as the full image plus overlapping tiles at two
scales, so a lantern that fills a small part of a print can still be found; an item's score is its
best-matching crop. Similarity is a pointer to look at, never evidence (the UI says so).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from scripts.bench import LOCK

GRIDS = (2, 3)  # tiles per side; tiles overlap by 1/3 of their size


def load(device: torch.device):
    from transformers import AutoImageProcessor, AutoModel

    spec = LOCK["siglip"]
    proc = AutoImageProcessor.from_pretrained(spec["repo"], revision=spec["revision"])  # images only: no tokenizer
    model = AutoModel.from_pretrained(spec["repo"], revision=spec["revision"], use_safetensors=True).to(device).eval()
    return model, proc


@torch.inference_mode()
def embed(model, proc, device: torch.device, images: list[Image.Image], batch: int = 16) -> np.ndarray:
    out = []
    for i in range(0, len(images), batch):
        inputs = proc(images=[im.convert("RGB") for im in images[i : i + batch]], return_tensors="pt").to(device)
        f = model.get_image_features(**inputs)
        f = f / f.norm(dim=-1, keepdim=True)
        out.append(f.float().cpu().numpy())
    return np.concatenate(out) if out else np.zeros((0, 768), dtype=np.float32)


def crops(img: Image.Image) -> list[tuple[str, Image.Image]]:
    w, h = img.size
    out = [("full", img)]
    for g in GRIDS:
        tw, th = w / (g - (g - 1) / 3), h / (g - (g - 1) / 3)  # tiles overlap by a third
        sx, sy = (w - tw) / max(1, g - 1), (h - th) / max(1, g - 1)
        for r in range(g):
            for c in range(g):
                x, y = c * sx, r * sy
                out.append((f"g{g}r{r}c{c}", img.crop((round(x), round(y), round(x + tw), round(y + th)))))
    return out


def build_index(model, proc, device, gallery: list[dict], image_dir: Path, out: Path) -> dict:
    vecs, owners, names = [], [], []
    for i, item in enumerate(gallery):
        img = Image.open(image_dir / item["file"]).convert("RGB")
        cs = crops(img)
        vecs.append(embed(model, proc, device, [c for _, c in cs]))
        owners += [i] * len(cs)
        names += [n for n, _ in cs]
    mat = np.concatenate(vecs).astype(np.float32)
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "vectors.npy", mat)
    (out / "index.json").write_text(json.dumps({"model": LOCK["siglip"], "items": gallery, "owners": owners, "crops": names}, ensure_ascii=False))
    return {"items": len(gallery), "crops": len(owners), "dim": int(mat.shape[1])}


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
        return [{**{x: self.meta["items"][o][x] for x in ("id", "title", "commons", "license", "file")}, "score": round(s, 4), "crop": self.meta["crops"][j]} for o, (s, j) in ranked]
