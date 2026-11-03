"""FR-58: crops and best-crop ranking, without loading the model."""

import json

import numpy as np
from PIL import Image

import visual


def test_crops_cover_full_and_two_grids():
    cs = visual.crops(Image.new("RGB", (300, 450)))
    assert [n for n, _ in cs][:1] == ["full"]
    assert len(cs) == 1 + 2 * 2 + 3 * 3
    for _, c in cs[1:]:
        assert 0 < c.width <= 300 and 0 < c.height <= 450


def test_item_score_is_its_best_crop(tmp_path):
    items = [{"id": f"i{k}", "title": f"t{k}", "commons": "https://x", "license": "PD", "file": f"i{k}.jpg"} for k in range(3)]
    vecs = np.eye(4, dtype=np.float32)[[0, 1, 2, 3]]  # item 0: crop 0; item 1: crops 1,3; item 2: crop 2
    (tmp_path / "index.json").write_text(json.dumps({"model": {}, "items": items, "owners": [0, 1, 2, 1], "crops": ["full", "full", "full", "g2r0c0"]}))
    np.save(tmp_path / "vectors.npy", vecs)
    hits = visual.Index(tmp_path).search(np.array([0, 0.2, 0, 0.9], dtype=np.float32), k=2)
    assert [h["id"] for h in hits] == ["i1", "i0"]
    assert hits[0]["crop"] == "g2r0c0"
