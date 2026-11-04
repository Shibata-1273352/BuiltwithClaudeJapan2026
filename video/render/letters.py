"""The second shot, in Cycles: the thread opens and lays itself into 風雷神門, top to bottom.

Each fibre slides along a rail: in from the thread at the left edge, then along a stitch path that
prep_letters.py traced from the real brush strokes. Rendered on black, so the composition can
bring the lit lantern up behind it with the gold landing exactly on the painted letters.

  blender -b -P render/letters.py -- --t 3 --res 960 --samples 48 --out out/look/l.png
"""

import argparse
import json
import math
import os
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spin import FPS, ORDER, THREADS, area, silk  # noqa: E402

K = 0.0009  # world units per photo pixel: 1600 px of crop in a 1.6-unit-wide, 1920 px frame
# per character: (first fibre leaves, last fibre leaves, seconds to arrive), from timeline.json.
# 風 drifts in, 雷 falls at once, 神 comes after a held breath, 門 settles with weight
with open("timeline.json") as f:
    WRITE = json.load(f)["opening"]["write"]
APPROACH = 40


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--t", type=float, default=3.0)
    p.add_argument("--frames", type=int, nargs=2)
    p.add_argument("--res", type=int, default=960)
    p.add_argument("--samples", type=int, default=48)
    p.add_argument("--out", required=True)
    return p.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def rails():
    """(n, APPROACH + points, 3) paths, and each fibre's start time."""
    d = np.load("public/letters.npz")
    paths, order, chars, crop = d["paths"], d["order"], d["chars"], d["crop"]
    n, points, _ = paths.shape
    rng = np.random.default_rng(5)
    w = (crop[2] - crop[0]) / 2
    h = (crop[3] - crop[1]) / 2
    x = (paths[..., 0] - crop[0] - w) * K
    z = (h - (paths[..., 1] - crop[1])) * K
    # raised a little, like satin stitch: higher along the middle of each stitch
    u = np.linspace(0, 1, points)[None, :]
    y = -0.002 - 0.004 * np.sin(u * math.pi) + rng.normal(0, 0.0007, (n, 1))
    stitch = np.stack([x, y, z], axis=2)

    # the approach: all from one thread at the left edge, fanning out only near the letters
    a = stitch[:, 0, :]
    src = np.array([-1.1, -0.02, -0.28]) + rng.normal(0, 0.006, (n, 3)) * np.array([1, 0.4, 1])
    c1 = np.array([-0.2, -0.05, -0.33]) + rng.normal(0, 0.008, (n, 3))
    c2 = np.array([-0.12, -0.06, -0.3]) + (a - np.array([-0.12, 0, -0.3])) * 0.42 + rng.normal(0, 0.012, (n, 3))
    s = np.linspace(0, 1, APPROACH, endpoint=False)[None, :, None]
    p0, p1, p2, p3 = (v[:, None, :] for v in (src, c1, c2, a))
    bez = (1 - s) ** 3 * p0 + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s**2 * p2 + s**3 * p3
    rail = np.concatenate([bez, stitch], axis=1).astype(np.float32)
    table = np.array(WRITE)[chars]
    # position inside its own character, top to bottom
    within = np.zeros(n)
    for c in range(4):
        k = chars == c
        within[k] = (order[k] - order[k].min()) / np.ptp(order[k])
    start = table[:, 0] + (table[:, 1] - table[:, 0]) * within + rng.normal(0, 0.03, n) * table[:, 2]
    travel = table[:, 2]
    radius = (0.00028 * rng.uniform(0.7, 1.3, n))[:, None] * (1 - 0.25 * np.abs(2 * u - 1) ** 6)
    # one thread per character, with a few fibres of the others worked through it
    dye = np.array([THREADS[k] for k in ORDER])
    pick = np.where(rng.uniform(0, 1, n) < 0.1, rng.integers(0, 4, n), chars)
    colour = dye[pick] * rng.uniform(0.85, 1.1, (n, 1))
    colour = np.concatenate([colour, np.ones((n, 1))], axis=1).astype(np.float32)
    return rail, start.astype(np.float32), radius.astype(np.float32), points, colour, travel.astype(np.float32)


def at_time(rail, start, travel, points, t):
    n, m, _ = rail.shape
    prog = np.clip((t - start) / travel, 0, 1)
    prog = 1 - (1 - prog) ** 2.4  # arrives gently
    head = (points - 1) + prog * (m - points)
    s = np.clip(head[:, None] - np.arange(points - 1, -1, -1)[None, :], 0, m - 1)
    i = np.minimum(s.astype(np.int32), m - 2)
    f = (s - i)[..., None]
    rows = np.arange(n)[:, None]
    pos = rail[rows, i] * (1 - f) + rail[rows, i + 1] * f
    # fibres not yet released wait outside the frame
    return np.where((t < start)[:, None, None], rail[:, :1, :] + np.array([-1, 0, 0], np.float32), pos).astype(np.float32)


def scene(a):
    from mathutils import Vector

    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    s.cycles.device = "GPU"
    s.cycles.samples = a.samples
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 6
    s.cycles.transmission_bounces = 6
    s.cycles.diffuse_bounces = 2
    s.cycles.glossy_bounces = 4
    s.cycles_curves.shape = "RIBBONS"
    s.render.resolution_x = a.res
    s.render.resolution_y = a.res * 9 // 16
    s.render.image_settings.file_format = "PNG"
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Punchy"
    world = bpy.data.worlds.new("dark")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
    s.world = world

    cam_data = bpy.data.cameras.new("front")
    cam_data.lens = 100
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = 4.444
    cam_data.dof.aperture_fstop = 1.2
    cam = bpy.data.objects.new("front", cam_data)
    s.collection.objects.link(cam)
    cam.location = (0, -4.444, 0)
    cam.rotation_euler = Vector((0, 1, 0)).to_track_quat("-Z", "Y").to_euler()
    s.camera = cam

    # raking light, as on embroidery: the sheen turns with the direction of each stitch
    area("rake", (-1.6, -1.4, 2.6), (0, 0, 0), 0.7, (1.0, 0.9, 0.78), 300)
    area("rake2", (2.4, -0.8, -1.6), (0, 0, 0), 0.8, (0.8, 0.82, 1.0), 110)
    area("back", (0.2, 2.2, 0.2), (0, 0, 0), 2.0, (1.0, 0.8, 0.6), 30)

    curves = bpy.data.hair_curves.new("silk")
    mat = silk()
    hair = mat.node_tree.nodes["Principled Hair BSDF"]
    hair.inputs["Roughness"].default_value = 0.16
    curves.materials.append(mat)
    ob = bpy.data.objects.new("silk", curves)
    s.collection.objects.link(ob)
    return s, curves


def main():
    a = args()
    s, cu = scene(a)
    rail, start, radius, points, colour, travel = rails()
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
