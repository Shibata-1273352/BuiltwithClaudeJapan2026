"""The reach, in Cycles: thousands of threads hanging in the dark, and one of them gold.

The tourism agency's English commentaries are in the thousands; this is a picture of that, not data.
Two stills from one seed, aligned pixel for pixel: `all` with every thread lit, `one` with the others
sunk and the gold thread up. The composition dissolves from one to the other.

  blender -b -P render/warp.py -- --t 0 --res 960 --samples 32 --out out/look/warp-all.png
  (--t 0 is `all`, --t 1 is `one`)
"""

import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from letters import args, scene  # noqa: E402
from spin import THREADS, area  # noqa: E402

N = 3200
POINTS = 28
GOLD_X = 0.26  # the gold thread, in world units from the centre


def threads():
    rng = np.random.default_rng(41)
    depth = rng.uniform(0.05, 1.1, N) ** 1.5
    spread = 1.0 + depth * 0.3
    x = rng.uniform(-1, 1, N) * spread
    zs = np.linspace(-1.1, 1.1, POINTS)[None, :] * (1 + depth[:, None] * 0.3)
    sway = rng.uniform(0.002, 0.012, N)[:, None] * np.sin(zs * rng.uniform(1.5, 4, N)[:, None] + rng.uniform(0, 6.3, N)[:, None])
    pos = np.stack([x[:, None] + sway, np.broadcast_to(depth[:, None], zs.shape), zs], axis=2)
    # the one, in front and in focus
    pos[0, :, 0] = GOLD_X + 0.004 * np.sin(zs[0] * 2.2)
    pos[0, :, 1] = 0.0
    pos[0, :, 2] = np.linspace(-1.1, 1.1, POINTS)
    keep = np.abs(pos[1:, 0, 0] - GOLD_X) > 0.012
    radius = np.full(N, 0.00024) * rng.uniform(0.7, 1.3, N)
    radius[0] = 0.0018
    return pos[np.r_[True, keep]].astype(np.float32), radius[np.r_[True, keep]].astype(np.float32)


def main():
    a = args()
    one = a.t > 0.5
    dim = 0.16 if one else 1.0
    s, cu = scene(a)
    cam = s.camera
    cam.data.dof.aperture_fstop = 5.6
    for ob in [o for o in s.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob)
    area("side", (-3.0, -0.6, 1.4), (0, 0.4, 0), 1.2, (1.0, 0.9, 0.78), 90 * dim)
    area("rim", (3.2, 2.4, -0.8), (0, 0.6, 0), 1.2, (0.6, 0.68, 1.0), 70 * dim)
    if one:
        area("gold", (GOLD_X - 0.5, -1.2, 0.3), (GOLD_X, 0, 0), 0.5, (1.0, 0.86, 0.66), 150)
    pos, radius = threads()
    n = pos.shape[0]
    rng = np.random.default_rng(5)
    cu.add_curves([POINTS] * n)
    cu.attributes.new("radius", "FLOAT", "POINT")
    cu.attributes["radius"].data.foreach_set("value", np.repeat(radius[:, None], POINTS, 1).ravel())
    cu.attributes["position"].data.foreach_set("vector", pos.ravel())
    pale = np.array(THREADS["koto"])
    dye = pale * rng.uniform(0.3, 1.05, (n, 1)) ** 2
    dye[0] = np.array(THREADS["toki"]) * (1.25 if one else 0.0) + pale * (0.0 if one else 1.0)
    cu.attributes.new("dye", "FLOAT_COLOR", "CURVE").data.foreach_set("color", np.concatenate([dye, np.ones((n, 1))], axis=1).astype(np.float32).ravel())
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    s.render.filepath = os.path.abspath(a.out)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
