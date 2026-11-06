"""Bridge 2, in Cycles: two silk cords drawn into a knot.

The 間 of the film: a macro in the dark, no words. render/knot_sim.py solves how the cords move; here each
is dressed as kumihimo, a round braid of eight bundles of fine fibres, the same silk as the opening.
The fibres are tied to the cord's own length, so the braid travels with it as it slides.

  score/.venv/bin/python render/knot_sim.py
  blender -b -P render/knot.py -- --t 3.4 --res 960 --samples 48 --out out/look/knot.png
"""

import math
import os
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from letters import args, scene  # noqa: E402
from spin import FPS, THREADS, area  # noqa: E402

SIM = np.load("out/knot-sim.npy")  # frames, cord, bead, xyz
H = 0.0125  # spacing of the beads
R = 0.0135  # radius of a cord
TIGHT = 2.7  # the pull ends here; the knot stops closing at frame 87, the "cinch" of timeline.json
FIBRES = 26000  # per cord
POINTS = 24  # per fibre
TURN = 44.0  # radians of braid per unit of cord
BEYOND = 90  # beads added past each end, so no end shows in the frame
TRIM = 40
ROLL = -11.0  # degrees


def soften(a, axis, passes):
    b = np.moveaxis(a, axis, 0).copy()
    for _ in range(passes):
        b[1:-1] = 0.25 * b[:-2] + 0.5 * b[1:-1] + 0.25 * b[2:]
    return np.moveaxis(b, 0, axis)


# the beads are a solver's chain: smooth them along the cord and through time
PATH = soften(soften(SIM, 2, 8), 0, 2)


def line(f, c):
    """Centre, normal and binormal along a cord at frame f."""
    q = PATH[f, c]
    k = np.arange(1, BEYOND + 1)[:, None]
    # the solver pins the ends, so the last beads run stiff: carry the cord on straight from further in
    q = q[TRIM:-TRIM]
    head = q[0] + (q[0] - q[30]) / 30 * k[::-1]
    tail = q[-1] + (q[-1] - q[-31]) / 30 * k
    q = np.concatenate([head, q, tail])
    t = np.gradient(q, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    # against a fixed axis, not transported: the frame must not swim from one frame to the next
    n = np.array([0.0, 1.0, 0.0]) - t[:, 1:2] * t
    n /= np.linalg.norm(n, axis=1, keepdims=True)
    return q, n, np.cross(t, n)


def at(a, i):
    lo = np.clip(i.astype(int), 0, len(a) - 2)
    w = (i - lo)[..., None]
    return a[lo] * (1 - w) + a[lo + 1] * w


def strand(f, c, n, rng):
    q, nor, bi = line(f, c)
    span = (len(q) - 1) * H
    sigma = rng.uniform(0, span, n)[:, None] + rng.uniform(0.1, 0.26, n)[:, None] * (np.linspace(0, 1, POINTS)[None, :] - 0.5)

    core = rng.uniform(0, 1, n)[:, None] < 0.22
    bundle = rng.integers(0, 8, n)[:, None]
    i = bundle // 2
    way = np.where(bundle % 2 == 0, 1.0, -1.0)
    # two sets of four bundles, wound opposite ways, each passing over then under the other
    theta = i * (math.pi / 2) + way * TURN * sigma
    other = i * (math.pi / 2) + way * 2 * TURN * sigma
    over = way * np.where(i % 2 == 0, 1.0, -1.0) * np.cos(2 * other)
    spread = rng.uniform(-0.62, 0.62, n)[:, None]
    theta = theta + spread
    rad = R * (0.78 + 0.11 * over * (1 - 0.8 * (spread / 0.62) ** 2) + rng.uniform(-0.1, 0.04, n)[:, None])
    rad = np.where(core, R * 0.6 * np.sqrt(rng.uniform(0, 1, n))[:, None], rad)

    # now and then a single fibre has slipped its bundle at one end
    fly = (rng.uniform(0, 1, n) < 0.0009)[:, None]
    rad = rad + fly * 0.006 * np.linspace(0, 1, POINTS)[None, :] ** 3

    i_ = np.clip(sigma / H, 0, len(q) - 1)
    return at(q, i_) + (rad * np.cos(theta))[..., None] * at(nor, i_) + (rad * np.sin(theta))[..., None] * at(bi, i_)


def fibres(n, f):
    rng = np.random.default_rng(31)
    return np.concatenate([strand(f, 0, n, rng), strand(f, 1, n, rng)]).astype(np.float32)


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (6 * u - 15) + 10)


def main():
    from mathutils import Matrix, Vector

    a = args()
    s, cu = scene(a)
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0052, 0.0091, 0.03, 1)
    hair = bpy.data.materials[0].node_tree.nodes["Principled Hair BSDF"]
    hair.inputs["Roughness"].default_value = 0.22
    hair.inputs["Radial Roughness"].default_value = 0.42
    cam = s.camera
    cam.data.dof.aperture_fstop = 0.6
    for ob in [o for o in s.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob)
    # one soft pool on the knot, so the cords fall away into the dark on either side
    area("key", (-0.5, -1.3, 1.0), (0, 0, 0), 0.5, (1.0, 0.9, 0.78), 55)
    area("back", (0.3, 1.1, 0.7), (0, 0, 0), 0.6, (1.0, 0.84, 0.66), 70)
    area("rim", (0.9, 0.3, -0.8), (0, 0, 0), 0.5, (0.55, 0.6, 1.0), 24)

    n = FIBRES
    cu.add_curves([POINTS] * (2 * n))
    rng = np.random.default_rng(3)
    cu.attributes.new("radius", "FLOAT", "POINT")
    u = np.linspace(0, 1, POINTS)[None, :]
    radius = (0.00026 * rng.uniform(0.7, 1.3, 2 * n))[:, None] * (1 - 0.7 * np.abs(2 * u - 1) ** 3)
    cu.attributes["radius"].data.foreach_set("value", radius.astype(np.float32).ravel())
    # the Japanese record and the English one: the app's gold and light indigo
    dye = np.concatenate([np.tile(THREADS["toki"], (n, 1)), np.tile(THREADS["koto"], (n, 1))])
    dye = dye * rng.uniform(0.82, 1.12, (2 * n, 1))
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
        f = min(len(SIM) - 1, round(t * FPS))
        cu.attributes["position"].data.foreach_set("vector", fibres(n, f).ravel())
        cu.update_tag()
        # the camera comes in with the pull, and swings slowly round so the weave shows its depth
        e = ease(t / (TIGHT + 0.6))
        near = 4.2 - 2.75 * e
        turn = math.radians(11 - 13 * t / 4)
        rise = math.radians(9 - 6 * e)
        cam.location = Vector((near * math.sin(turn) * math.cos(rise), -near * math.cos(turn) * math.cos(rise), near * math.sin(rise)))
        # a slight lean, so the cords run across the frame rather than along it
        up = Vector((math.sin(math.radians(ROLL)), 0.0, math.cos(math.radians(ROLL))))
        look = -cam.location.normalized()
        right = look.cross(up).normalized()
        cam.rotation_euler = Matrix((right, right.cross(look), -look)).transposed().to_euler()
        cam.data.dof.focus_distance = near
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
