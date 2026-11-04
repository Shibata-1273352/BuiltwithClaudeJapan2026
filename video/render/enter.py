"""Bridge 1, in Cycles: the four threads fly into the empty photo frame of the app.

The app frame is real and empty (elapsed 0.0 s, before any AI output). The fibres land as a warp of
vertical threads across the frame, on a transparent background, and the real photo takes over.

  blender -b -P render/enter.py -- --t 1.8 --res 960 --samples 32 --out out/look/enter.png
"""

import json
import os
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from letters import APPROACH, args, at_time, scene  # noqa: E402
from spin import FPS, ORDER, THREADS  # noqa: E402

with open("timeline.json") as f:
    B = json.load(f)["bridges"]["enter"]
K = 1.6 / 1920  # world units per screen pixel
X, Y, W, H = B["rect"]
POINTS = 24


def rails(n=12000):
    rng = np.random.default_rng(21)
    # where each fibre lands: a vertical run inside the frame
    col = rng.uniform(0, 1, n)
    px = X + W * col
    top = Y + H * rng.uniform(0, 0.8, n)
    run = H * rng.uniform(0.12, 0.3, n)
    u = np.linspace(0, 1, POINTS)[None, :]
    wob = np.sin(u * 6 + rng.uniform(0, 6, (n, 1))) * 1.4
    sx = (px[:, None] + wob - 960) * K
    sz = (540 - np.clip(top[:, None] + run[:, None] * u, Y, Y + H)) * K
    sy = np.full_like(sx, -0.004) + rng.normal(0, 0.001, (n, 1))
    stitch = np.stack([sx, sy, sz], axis=2)

    a = stitch[:, 0, :]
    src = np.array([-1.1, -0.02, -0.12]) + rng.normal(0, 0.006, (n, 3)) * np.array([1, 0.4, 1])
    c1 = np.array([-0.62, -0.05, -0.16]) + rng.normal(0, 0.008, (n, 3))
    gate = np.array([(X - 960) * K - 0.1, -0.05, 0.02])
    c2 = gate + (a - gate) * 0.3 + rng.normal(0, 0.01, (n, 3))
    s = np.linspace(0, 1, APPROACH, endpoint=False)[None, :, None]
    p0, p1, p2, p3 = (v[:, None, :] for v in (src, c1, c2, a))
    bez = (1 - s) ** 3 * p0 + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s**2 * p2 + s**3 * p3
    rail = np.concatenate([bez, stitch], axis=1).astype(np.float32)

    # the four threads arrive side by side, each filling its quarter of the frame in turn
    band = np.minimum(3, (col * 4).astype(int))
    start = B["fly"][0] + (B["fly"][1] - B["fly"][0]) * (band / 3) * 0.5 + rng.uniform(0, 0.5, n) * (B["fly"][1] - B["fly"][0])
    travel = np.full(n, B["travel"], np.float32)
    dye = np.array([THREADS[k] for k in ORDER])[band] * rng.uniform(0.85, 1.1, (n, 1))
    colour = np.concatenate([dye, np.ones((n, 1))], axis=1).astype(np.float32)
    radius = (0.00034 * rng.uniform(0.7, 1.3, n))[:, None] * np.ones_like(u)
    return rail, start.astype(np.float32), travel, radius.astype(np.float32), colour


def main():
    a = args()
    s, cu = scene(a)
    s.render.film_transparent = True
    s.render.image_settings.color_mode = "RGBA"
    rail, start, travel, radius, colour = rails()
    n = rail.shape[0]
    cu.add_curves([POINTS] * n)
    cu.attributes.new("radius", "FLOAT", "POINT")
    cu.attributes["radius"].data.foreach_set("value", radius.ravel())
    cu.attributes.new("dye", "FLOAT_COLOR", "CURVE").data.foreach_set("color", colour.ravel())
    if a.frames:
        os.makedirs(a.out, exist_ok=True)
        todo = [(f / FPS, os.path.join(a.out, f"f{f:04d}.png")) for f in range(a.frames[0], a.frames[1] + 1)]
    else:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        todo = [(a.t, a.out)]
    for t, path in todo:
        if os.path.exists(path) and a.frames:
            continue
        began = time.time()
        cu.attributes["position"].data.foreach_set("vector", at_time(rail, start, travel, POINTS, t).ravel())
        cu.update_tag()
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
