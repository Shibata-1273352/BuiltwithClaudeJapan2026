"""The title, in Cycles: the four threads run in from the left and lay themselves into TSUMUGI.

Same silk and the same rails as letters.py, on a transparent ground, so the composition sets it over
the lit lantern. The last frame is reused in the credits.

  blender -b -P render/title.py -- --t 1.5 --res 960 --samples 32 --out out/look/title.png
"""

import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from letters import APPROACH, args, at_time, scene  # noqa: E402
from spin import FPS, ORDER, THREADS  # noqa: E402

K = 1.6 / 1920  # world units per screen pixel
LEAVE = (0.05, 0.75)  # first and last fibre leave
TRAVEL = 0.55
# the four colours in turn along the word, in the order of the app's threads
COLOUR = [0, 1, 2, 3, 0, 1, 2]


def rails():
    d = np.load("public/title.npz")
    paths, letters = d["paths"], d["letters"]
    n, points, _ = paths.shape
    rng = np.random.default_rng(23)
    x = (paths[..., 0] - 960) * K
    z = (540 - paths[..., 1]) * K
    u = np.linspace(0, 1, points)[None, :]
    y = -0.002 - 0.0045 * np.sin(u * math.pi) + rng.normal(0, 0.0007, (n, 1))
    stitch = np.stack([x, y, z], axis=2)

    a = stitch[:, 0, :]
    src = np.array([-1.1, -0.02, 0.03]) + rng.normal(0, 0.006, (n, 3)) * np.array([1, 0.4, 1])
    c1 = np.array([-0.72, -0.05, 0.05]) + rng.normal(0, 0.008, (n, 3))
    c2 = a * np.array([0.7, 1, 0.5]) + np.array([-0.16, -0.05, 0.03]) + rng.normal(0, 0.012, (n, 3))
    s = np.linspace(0, 1, APPROACH, endpoint=False)[None, :, None]
    p0, p1, p2, p3 = (v[:, None, :] for v in (src, c1, c2, a))
    bez = (1 - s) ** 3 * p0 + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s**2 * p2 + s**3 * p3
    rail = np.concatenate([bez, stitch], axis=1).astype(np.float32)

    across = (paths[..., 0].mean(axis=1) - paths[..., 0].min()) / np.ptp(paths[..., 0])
    start = LEAVE[0] + (LEAVE[1] - LEAVE[0]) * across + rng.normal(0, 0.03, n)
    travel = np.full(n, TRAVEL, np.float32)
    radius = (0.00026 * rng.uniform(0.7, 1.3, n))[:, None] * (1 - 0.25 * np.abs(2 * u - 1) ** 6)
    dye = np.array([THREADS[k] for k in ORDER])
    mine = np.array(COLOUR)[letters]
    pick = np.where(rng.uniform(0, 1, n) < 0.08, rng.integers(0, 4, n), mine)
    colour = dye[pick] * rng.uniform(0.85, 1.1, (n, 1))
    colour = np.concatenate([colour, np.ones((n, 1))], axis=1).astype(np.float32)
    return rail, start.astype(np.float32), travel, radius.astype(np.float32), points, colour


def main():
    a = args()
    s, cu = scene(a)
    s.render.film_transparent = True
    s.render.image_settings.color_mode = "RGBA"
    rail, start, travel, radius, points, colour = rails()
    n = rail.shape[0]
    cu.add_curves([points] * n)
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
        cu.attributes["position"].data.foreach_set("vector", at_time(rail, start, travel, points, t).ravel())
        cu.update_tag()
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
