"""Bridge 2, in Cycles: two threads, one from each side, wind round each other and draw tight.

The 間 of the film: a macro in the dark, no words. Each strand is a bundle of real fibres round a
centreline; the centrelines are a pure function of t, so frames render in any order.

  blender -b -P render/knot.py -- --t 2.6 --res 960 --samples 48 --out out/look/knot.png
"""

import json
import math
import os
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from letters import args, scene  # noqa: E402
from spin import FPS, THREADS, area  # noqa: E402

with open("timeline.json") as f:
    B = json.load(f)["bridges"]["knot"]
POINTS = 160
TURNS = 2.6  # how many times the two wind round each other
SPAN = 0.42  # half the length of the wound part


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def centre(side, x, t):
    """side +1/-1. Far from the middle the threads lie apart; near it they wind, and tighten with t."""
    close = ease(t / B["tighten"])
    window = np.exp(-((x / SPAN) ** 2))
    gap = 0.34 * (1 - close) ** 1.4 + 0.016
    apart = side * (0.05 + 0.3 * (1 - window))
    phase = math.tau * TURNS * (x / (2 * SPAN)) + (0 if side > 0 else math.pi) + 2.4 * close
    y = apart * (1 - window) + gap * window * np.sin(phase)
    z = gap * window * np.cos(phase)
    return y, z


def strand(side, n, rng, t):
    x0 = np.linspace(-1.5, 1.5, POINTS)[None, :]
    ang = rng.uniform(0, math.tau, n)[:, None]
    core = np.sqrt(rng.uniform(0, 1, n))[:, None]
    slide = rng.uniform(-0.05, 0.05, n)[:, None]
    ph = rng.uniform(0, math.tau, (n, 2))
    fly = (rng.uniform(0, 1, n) < 0.04)[:, None]
    # each fibre covers only part of the thread, as staple fibres do
    a = rng.uniform(-1.9, 1.3, n)[:, None]
    length = rng.uniform(0.6, 1.3, n)[:, None]
    u = np.linspace(0, 1, 40)[None, :]
    x = a + length * u + slide * 0
    cy, cz = centre(side, x, t)
    # the thread swells where the two press together
    r = 0.015 * core * (1 + 0.22 * np.sin(x * 9 + ph[:, :1]) * 0.5)
    y = cy + r * np.cos(ang) + 0.0012 * np.sin(x * 40 + ph[:, 1:2])
    z = cz + r * np.sin(ang) + 0.0012 * np.sin(x * 37 + ph[:, :1])
    end = np.abs(2 * u - 1) ** 4
    y = y + fly * end * 0.03 * np.cos(ang)
    z = z + fly * end * 0.03 * np.sin(ang)
    return np.stack([x, z, y], axis=2).astype(np.float32)


def fibres(n, t):
    rng = np.random.default_rng(31)
    return np.concatenate([strand(1, n, rng, t), strand(-1, n, rng, t)], axis=0)


def main():
    from mathutils import Vector

    a = args()
    s, cu = scene(a)
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0052, 0.0091, 0.03, 1)
    cam = s.camera
    cam.location = (0.0, -2.0, 0.0)
    cam.data.dof.focus_distance = 2.0
    cam.data.dof.aperture_fstop = 0.45
    for ob in [o for o in s.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob)
    area("back", (0.5, 2.0, 0.6), (0, 0, 0), 1.4, (1.0, 0.84, 0.66), 150)
    area("key", (-1.2, -1.0, 1.4), (0, 0, 0), 0.8, (1.0, 0.88, 0.74), 34)
    area("rim", (1.6, 0.6, -1.0), (0, 0, 0), 1.0, (0.55, 0.6, 1.0), 60)

    n = 5200
    pos = fibres(n, 0.0)
    points = pos.shape[1]
    rng = np.random.default_rng(3)
    cu.add_curves([points] * (2 * n))
    cu.attributes.new("radius", "FLOAT", "POINT")
    u = np.linspace(0, 1, points)[None, :]
    radius = (0.00032 * rng.uniform(0.7, 1.3, 2 * n))[:, None] * (1 - 0.85 * np.abs(2 * u - 1) ** 3)
    cu.attributes["radius"].data.foreach_set("value", radius.astype(np.float32).ravel())
    # the Japanese record and the English one: the app's gold and light indigo
    dye = np.concatenate([np.tile(THREADS["toki"], (n, 1)), np.tile(THREADS["koto"], (n, 1))])
    dye = dye * rng.uniform(0.85, 1.1, (2 * n, 1))
    cu.attributes.new("dye", "FLOAT_COLOR", "CURVE").data.foreach_set("color", np.concatenate([dye, np.ones((2 * n, 1))], axis=1).astype(np.float32).ravel())

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
        cu.attributes["position"].data.foreach_set("vector", fibres(n, t).ravel())
        cu.update_tag()
        cam.location = Vector((0.03 * math.sin(t * 0.4), -2.0 + 0.05 * t, 0.0))
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
