"""Spatial helpers for the 間 (ma) layer (REQUIREMENTS.md 4.10). Pure numpy; no model calls.

Coordinates are normalized to the image, origin top-left, x right, y down (section 7).
Depth Anything returns relative *inverse* depth: larger = nearer.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

LAYERS = ("foreground", "midground", "background")


@dataclass
class Anchor:
    name: str
    x: float
    y: float


def representative_depth(depth: np.ndarray, mask: np.ndarray) -> float:
    """Median relative depth inside the mask (robust to edges bleeding into background)."""
    vals = depth[mask]
    return float(np.median(vals)) if vals.size else float("nan")


def assign_layers(depths: dict[str, float], scene_depth: np.ndarray) -> dict[str, str]:
    """Split elements into foreground / midground / background by scene depth tertiles."""
    lo, hi = np.quantile(scene_depth, [1 / 3, 2 / 3])
    out = {}
    for k, d in depths.items():
        out[k] = "foreground" if d >= hi else "midground" if d >= lo else "background"
    return out


def mask_bbox(mask: np.ndarray) -> tuple[float, float, float, float]:
    ys, xs = np.nonzero(mask)
    h, w = mask.shape
    return xs.min() / w, ys.min() / h, (xs.max() + 1) / w, (ys.max() + 1) / h


def lantern_anchors(mask: np.ndarray, band: float = 0.02) -> list[Anchor]:
    """Two anchors from a lantern mask, chosen to survive cropping at the top/right image edge:
    - bottom_center: the lowest mask row's center (the bottom ring / hook)
    - left_extreme: the leftmost mask column at its widest row
    `band` ignores a thin strip at the image border so a cut-off edge is never used (4.10 step 5).
    """
    h, w = mask.shape
    m = mask.copy()
    bx, by = int(w * band), int(h * band)
    m[:, :bx] = m[:, w - bx :] = False
    m[:by, :] = m[h - by :, :] = False
    ys, xs = np.nonzero(m)
    if not xs.size:
        return []
    y_bottom = ys.max()
    row = xs[ys >= y_bottom - max(2, h // 400)]
    bottom = Anchor("bottom_center", float(np.median(row)) / w, float(y_bottom) / h)
    x_left = xs.min()
    col = ys[xs <= x_left + max(2, w // 400)]
    left = Anchor("left_extreme", float(x_left) / w, float(np.median(col)) / h)
    return [bottom, left]


def base_anchor(base_mask: np.ndarray) -> Anchor | None:
    """Top-left corner of the lantern's metal base, from a separate base mask (SAM 3 concept prompt).
    The base ring is visible in both photos and prints even when the top of the lantern is cropped."""
    if not base_mask.any():
        return None
    x1, y1, _, _ = mask_bbox(base_mask)
    return Anchor("base_left", x1, y1)


def similarity_from_two(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> np.ndarray:
    """2x3 similarity transform (uniform scale, rotation, translation) mapping src -> dst.
    Points in pixel space of their own images. Exactly determined by two point pairs."""
    (x1, y1), (x2, y2) = src
    (u1, v1), (u2, v2) = dst
    s = complex(x2 - x1, y2 - y1)
    d = complex(u2 - u1, v2 - v1)
    if abs(s) < 1e-9:
        raise ValueError("source anchors coincide")
    z = d / s  # scale * e^{i theta}
    a, b = z.real, z.imag
    tx = u1 - (a * x1 - b * y1)
    ty = v1 - (b * x1 + a * y1)
    return np.array([[a, -b, tx], [b, a, ty]], dtype=np.float64)


def scale_translate_fit(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> np.ndarray:
    """Least-squares uniform scale + translation (no rotation) mapping src -> dst, as a 2x3 matrix.
    Used for upright subjects (a hanging lantern) where a rotation from two noisy anchors would
    only add tilt."""
    s, d = np.asarray(src, float), np.asarray(dst, float)
    if len(s) < 2:
        raise ValueError("need at least two anchors")
    sc, dc = s - s.mean(0), d - d.mean(0)
    denom = float((sc**2).sum())
    if denom < 1e-9:
        raise ValueError("source anchors coincide")
    k = float((sc * dc).sum()) / denom
    t = d.mean(0) - k * s.mean(0)
    return np.array([[k, 0.0, t[0]], [0.0, k, t[1]]])


def transform_params(m: np.ndarray) -> dict:
    a, b = m[0, 0], m[1, 0]
    return {
        "scale": float(np.hypot(a, b)),
        "rotation_deg": float(np.degrees(np.arctan2(b, a))),
        "tx": float(m[0, 2]),
        "ty": float(m[1, 2]),
    }


def apply(m: np.ndarray, pts: np.ndarray) -> np.ndarray:
    return pts @ m[:, :2].T + m[:, 2]


def anchor_dicts(anchors: list[Anchor]) -> list[dict]:
    return [asdict(a) for a in anchors]
