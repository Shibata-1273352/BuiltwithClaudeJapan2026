"""Bridge 2, in Cycles: a thread from each side, hooked through each other, pulled into a knot.

The 間 of the film: a macro in the dark, no words. Each thread is a bight (a loop with two legs); the
two bights lie in crossing planes, so they hook like links and cannot pass through each other, and
pulling draws them into the knot of a gift cord. Each thread is three twisted plies of staple fibres.
The positions are a pure function of t, so frames render in any order.

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
TIGHT = B["tighten"]
FIBRES = 9000  # per thread
POINTS = 40  # per fibre
REACH = 2.6  # how far each leg runs from the tip of the bight
THREAD = 0.024  # radius of a thread
PLY = 0.56  # plies sit this far out, as a share of the thread
TWIST = 34.0  # radians of ply per unit of thread
LOOSE, TIGHTENED = (0.34, 0.33), (THREAD * 1.08, 0.062)  # (reach of the tip past centre, radius of the bight)


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (6 * u - 15) + 10)


def pull(t):
    """0 loose, 1 tight: a long draw, then the last of it all at once, and the cord settling."""
    settle = 0.0 if t < TIGHT else 0.05 * math.exp(-5.0 * (t - TIGHT)) * math.sin(17.0 * (t - TIGHT))
    return ease(0.22 + 0.78 * t / TIGHT) - settle


def bight(t):
    """The centreline in its own plane, from the tip outward: signed distance along it, p, q."""
    e = pull(t)
    tip = LOOSE[0] + (TIGHTENED[0] - LOOSE[0]) * e
    r = LOOSE[1] + (TIGHTENED[1] - LOOSE[1]) * e
    a = np.linspace(0, math.pi / 2, 90)
    arc_p, arc_q = (tip - r) + r * np.cos(a), r * np.sin(a)
    d = np.linspace(0, 3.0, 700)[1:]
    leg_p, leg_q = (tip - r) - d, r + 0.34 * d * d / (1 + 0.8 * d)
    p, q = np.concatenate([arc_p, leg_p]), np.concatenate([arc_q, leg_q])
    s = np.concatenate([[0], np.cumsum(np.hypot(np.diff(p), np.diff(q)))])
    return s, p, q


def strand(side, n, rng, t):
    s, p, q = bight(t)
    sigma0 = rng.uniform(-REACH, REACH, n)[:, None]
    length = rng.uniform(0.22, 0.5, n)[:, None]
    u = np.linspace(0, 1, POINTS)[None, :]
    sigma = sigma0 + length * (u - 0.5)
    ply = rng.integers(0, 3, n)[:, None]
    ang = rng.uniform(0, math.tau, n)[:, None]
    core = np.sqrt(rng.uniform(0, 1, n))[:, None]
    fly = (rng.uniform(0, 1, n) < 0.025)[:, None]
    ph = rng.uniform(0, math.tau, n)[:, None]

    mirror = np.sign(sigma)
    a = np.abs(sigma)
    cp, cq = np.interp(a, s, p), mirror * np.interp(a, s, q)
    h = 0.004
    # p is even in sigma and q is odd, so the tangent carries the mirror on p, not on q
    tp = mirror * (np.interp(a + h, s, p) - np.interp(np.maximum(a - h, 0), s, p))
    tq = np.interp(a + h, s, q) - np.interp(np.maximum(a - h, 0), s, q)
    norm = np.hypot(tp, tq) + 1e-9
    np_, nq = -tq / norm, tp / norm

    # three plies round the core, and the fibres round each ply, twisting the other way
    turn = TWIST * sigma + ply * (math.tau / 3)
    centre_n, centre_w = THREAD * PLY * np.cos(turn), THREAD * PLY * np.sin(turn)
    roll = ang - 2.2 * TWIST * sigma
    rad = THREAD * (1 - PLY) * 1.1 * core
    end = np.abs(2 * u - 1) ** 5
    rad = rad + fly * end * 0.02
    off_n = centre_n + rad * np.cos(roll) + 0.0006 * np.sin(sigma * 60 + ph)
    off_w = centre_w + rad * np.sin(roll)

    pp, qq, ww = cp + off_n * np_, cq + off_n * nq, off_w
    # the two threads lie in crossing planes, turning slowly together
    phi = (0.52 if side > 0 else 0.52 - math.pi / 2) + 0.05 * t
    x = side * pp
    y = qq * math.sin(phi) + ww * math.cos(phi)
    z = qq * math.cos(phi) - ww * math.sin(phi)
    return np.stack([x, y, z], axis=2).astype(np.float32)


def fibres(n, t):
    rng = np.random.default_rng(31)
    return np.concatenate([strand(1, n, rng, t), strand(-1, n, rng, t)], axis=0)


def main():
    from mathutils import Vector

    a = args()
    s, cu = scene(a)
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0052, 0.0091, 0.03, 1)
    cam = s.camera
    cam.data.dof.aperture_fstop = 0.8
    for ob in [o for o in s.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob)
    area("back", (0.5, 2.0, 0.6), (0, 0, 0), 1.4, (1.0, 0.84, 0.66), 150)
    area("key", (-1.2, -1.0, 1.4), (0, 0, 0), 0.8, (1.0, 0.88, 0.74), 15)
    area("rim", (1.6, 0.6, -1.0), (0, 0, 0), 1.0, (0.55, 0.6, 1.0), 60)

    n = FIBRES
    cu.add_curves([POINTS] * (2 * n))
    rng = np.random.default_rng(3)
    cu.attributes.new("radius", "FLOAT", "POINT")
    u = np.linspace(0, 1, POINTS)[None, :]
    radius = (0.00042 * rng.uniform(0.7, 1.3, 2 * n))[:, None] * (1 - 0.85 * np.abs(2 * u - 1) ** 3)
    cu.attributes["radius"].data.foreach_set("value", radius.astype(np.float32).ravel())
    # the Japanese record and the English one: the app's gold and light indigo
    dye = np.concatenate([np.tile(THREADS["toki"], (n, 1)), np.tile(THREADS["koto"], (n, 1))])
    dye = dye * rng.uniform(0.8, 1.12, (2 * n, 1))
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
        # the camera comes in with the pull, and the focus stays on the knot all the way
        near = 4.4 - 1.9 * ease(t / (TIGHT + 0.5))
        cam.location = Vector((0.015 * math.sin(t * 0.4), -near, 0.0))
        cam.data.dof.focus_distance = near
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
