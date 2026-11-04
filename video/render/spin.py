"""The opening shot, in Cycles: silk floss drawn out into one thread.

Every fibre is a real strand. Backlit, out of focus at the edges, the way a macro lens sees it. The
fibres gather at the point where hand-spun floss becomes a thread, and flow through it. Yuki tsumugi
thread is drawn out without twist, so the fibres run side by side and do not wind round each other.

Each frame is computed from t alone, so frames can be rendered in any order.

  blender -b -P render/spin.py -- --t 2 --res 960 --samples 96 --out out/look/a.png
  blender -b -P render/spin.py -- --frames 0 149 --res 1920 --samples 128 --out out/spin/
"""

import argparse
import math
import os
import sys
import time

import bpy
import numpy as np

FPS = 30
APEX_X = -0.12  # where the floss closes into the thread
THREAD_R = 0.017


def drawn(t):
    """How far the thread has been drawn: almost still, then pulled away all at once (緩急)."""
    return 0.07 * t + 1.5 * max(0.0, t - BEATS["pull"]) ** 2.4


AXIS_TILT = 0.2  # the thread rises to the left
X_MIN, X_MAX = -1.3, 1.9
# the four threads of the app (globals.css), as linear colours for the dye
def linear(hex_):
    c = np.array([int(hex_[i : i + 2], 16) for i in (1, 3, 5)]) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# silk lets light through and pales its dye, so the fibre is dyed deeper than the colour it shows
THREADS = {
    "koto": linear("#a9c6e8") ** 3.2,
    "toki": linear("#e2b65a") ** 2.3,
    "ma": linear("#c9a7ad") ** 2.3,
    "ba": linear("#e0603f") ** 1.55 * 0.8,  # held back: vermilion must not shout over the other three
}
ORDER = ["koto", "toki", "ma", "ba"]
BEATS = {"rise": 1.1, "pull": 1.7, "rack": [3.1, 4.5], "end": 6.0}


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--t", type=float, default=2.0)
    p.add_argument("--frames", type=int, nargs=2)
    p.add_argument("--res", type=int, default=960)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--fibres", type=int, default=11000)
    p.add_argument("--out", required=True)
    return p.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def smooth(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def fibres(n, points, t):
    """Positions (n, points, 3) and radii (n, points) at time t."""
    rng = np.random.default_rng(7)
    # fibres travel in wisps: a shared path per clump, a small private offset per fibre
    clumps = 150
    clump = rng.integers(0, clumps, n)
    c_ang = rng.uniform(0, math.tau, clumps)[clump][:, None]
    c_core = np.sqrt(rng.uniform(0, 1, clumps))[clump][:, None]
    c_y = rng.normal(0, 1, clumps)[clump][:, None]
    c_z = rng.normal(0, 1, clumps)[clump][:, None]
    c_ph = rng.uniform(0, math.tau, (clumps, 4))[clump]
    c_start = rng.uniform(X_MIN - 1.0, X_MAX, clumps)[clump][:, None]

    length = rng.uniform(1.1, 2.3, n)[:, None]
    start = c_start + rng.normal(0, 0.16, n)[:, None]
    j_y = rng.normal(0, 1, n)[:, None]
    j_z = rng.normal(0, 1, n)[:, None]
    ph = rng.uniform(0, math.tau, (n, 4))
    fly = (rng.uniform(0, 1, n) < 0.05)[:, None]
    fly_ang = rng.uniform(0, math.tau, n)[:, None]
    curl = rng.uniform(-1, 1, n)[:, None]
    u = np.linspace(0, 1, points)[None, :]

    # material coordinate along the fibre; the fibre slides left as it is drawn out
    span = X_MAX - X_MIN + 1.0
    head = (start - drawn(t) - X_MIN) % span + X_MIN - 0.6
    x = head + length * u
    m = x + drawn(t)  # moves with the fibre, so slubs and crimp travel with it

    open_ = np.clip(x - APEX_X, 0, None)  # distance into the floss
    fan = smooth(open_ / 1.15)

    # slubs: the drawn thread thickens and thins along its length
    slub = 1 + 0.42 * np.sin(m * 6.3 + 1.1) * np.sin(m * 2.3) + 0.14 * np.sin(m * 15.0)
    r = THREAD_R * slub * c_core
    y = r * np.cos(c_ang) + THREAD_R * 0.16 * j_y
    z = r * np.sin(c_ang) + THREAD_R * 0.16 * j_z

    # the spinning triangle: the wisps fan out; inside a wisp the fibres loosen as it opens
    y = y + c_y * (0.06 * open_**1.2 + 0.46 * fan**1.5) + j_y * 0.014 * fan
    z = z + c_z * (0.03 * open_**1.2 + 0.16 * fan**1.5) + j_z * 0.014 * fan
    crimp = 0.006 + 0.1 * fan
    y = y + crimp * (np.sin(m * 4.1 + c_ph[:, :1]) + 0.5 * np.sin(m * 9.7 + c_ph[:, 1:2]))
    z = z + crimp * (np.sin(m * 3.7 + c_ph[:, 2:3]) + 0.5 * np.sin(m * 8.9 + c_ph[:, 3:4]))
    fine = 0.0015 + 0.006 * fan
    y = y + fine * np.sin(m * 19 + ph[:, :1])
    z = z + fine * np.sin(m * 17 + ph[:, 1:2])
    # a slow breath in the floss, so it never looks like a frozen sculpture
    y = y + 0.025 * fan * np.sin(t * 0.8 + x * 2.0)

    # flyaways: a fibre end leaves the thread in a soft curl and catches the backlight
    end = np.clip((u - 0.62) / 0.38, 0, 1)
    lift = fly * end**1.6 * (0.05 + 0.1 * fan)
    y = y + lift * (np.cos(fly_ang) + curl * np.sin(end * 3.4))
    z = z + lift * (np.sin(fly_ang) + curl * np.cos(end * 3.4))

    # the thread's own path: tilted, with a slow bend
    y = y + AXIS_TILT * -x + 0.05 * np.sin(x * 1.7 + 0.6)

    pos = np.stack([x, z, y], axis=2)  # the camera looks along +Y, so the depth axis is Y
    radius = 0.00026 * (0.7 + 0.7 * rng.uniform(0, 1, n))[:, None] * (1 - 0.85 * np.abs(2 * u - 1) ** 3)
    return pos.astype(np.float32), radius.astype(np.float32)


def dyes(n):
    """Four bands of floss, by where each wisp sits in the fan; they close into one thread."""
    rng = np.random.default_rng(7)
    clump = rng.integers(0, 150, n)
    rng.uniform(0, math.tau, 150)
    rng.uniform(0, 1, 150)
    band = np.digitize(rng.normal(0, 1, 150), [-0.67, 0, 0.67])[clump]
    colours = np.array([THREADS[k] for k in ORDER])[band]
    colours = colours * np.random.default_rng(9).uniform(0.82, 1.1, (n, 1))
    return np.concatenate([colours, np.ones((n, 1))], axis=1).astype(np.float32)


def silk():
    mat = bpy.data.materials.new("silk")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    hair = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    hair.parametrization = "COLOR"
    dye = nt.nodes.new("ShaderNodeAttribute")
    dye.attribute_name = "dye"
    nt.links.new(dye.outputs["Color"], hair.inputs["Color"])
    hair.inputs["Roughness"].default_value = 0.26
    hair.inputs["Radial Roughness"].default_value = 0.42
    nt.links.new(hair.outputs[0], out.inputs["Surface"])
    return mat


def emission(name, rgb, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def area(name, loc, target, size, rgb, watts):
    light = bpy.data.lights.new(name, "AREA")
    light.size = size
    light.color = rgb
    light.energy = watts
    ob = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = np.array(target) - np.array(loc)
    from mathutils import Vector

    ob.rotation_euler = Vector(d.tolist()).to_track_quat("-Z", "Y").to_euler()


def scene(a):
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
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 4
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles_curves.shape = "RIBBONS"
    s.render.resolution_x = a.res
    s.render.resolution_y = a.res * 9 // 16
    s.render.film_transparent = False
    s.render.image_settings.file_format = "PNG"
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Punchy"

    world = bpy.data.worlds.new("dusk")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0052, 0.0091, 0.03, 1)
    s.world = world

    from mathutils import Vector

    cam_data = bpy.data.cameras.new("macro")
    cam_data.lens = 100
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = 3.4
    cam_data.dof.aperture_fstop = 0.42
    cam = bpy.data.objects.new("macro", cam_data)
    s.collection.objects.link(cam)
    cam.location = (0.12, -3.4, 0.02)
    cam.rotation_euler = Vector((0, 1, 0)).to_track_quat("-Z", "Y").to_euler()
    s.camera = cam

    # the lantern behind and to the right: the floss glows from inside
    area("back", (0.8, 2.6, 0.2), (0.5, 0, 0), 1.6, (1.0, 0.84, 0.66), 130)
    area("rim", (-2.2, 2.2, 1.4), (-0.4, 0, 0.1), 1.6, (0.45, 0.48, 0.85), 60)
    area("thread", (-0.9, -0.9, 1.3), (-0.6, 0, 0.1), 0.9, (1.0, 0.86, 0.7), 26)
    area("fill", (0.6, -2.2, -1.8), (0.4, 0, 0), 3.0, (1.0, 0.66, 0.4), 5)

    # far lanterns: only their bokeh reaches the lens
    rng = np.random.default_rng(3)
    glow = emission("lantern", (1.0, 0.36, 0.1), 10)
    for i in range(34):
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=rng.uniform(0.003, 0.016),
            location=(rng.uniform(-1.6, 1.8), rng.uniform(2.6, 4.6), rng.uniform(-1.0, 1.0)),
            segments=12,
            ring_count=8,
        )
        bpy.context.object.data.materials.append(glow)

    # the photograph of the lantern base, waiting behind everything for the focus to reach it
    card = bpy.data.materials.new("photo")
    card.use_nodes = True
    nt = card.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.abspath("public/lantern.jpg"))
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.485, 5, 0.22), rotation=(math.pi / 2, 0, 0))
    plane = bpy.context.object
    plane.scale = (4.03, 3.02, 1)
    plane.data.materials.append(card)

    curves = bpy.data.hair_curves.new("floss")
    curves.materials.append(silk())
    ob = bpy.data.objects.new("floss", curves)
    s.collection.objects.link(ob)
    return s, curves, ob, cam_data, plane, em, glow


def ease(u):
    u = min(1, max(0, u))
    return u * u * (3 - 2 * u)


def animate(t, ob, cam_data, plane, photo, glow):
    """The beats of the shot. Timings come from timeline.json in the end; see BEATS."""
    b = BEATS
    rise = ease(t / b["rise"])
    for name, watts in (("back", 130), ("rim", 60), ("thread", 26), ("fill", 5)):
        bpy.data.lights[name].energy = watts * rise
    r = ease((t - b["rack"][0]) / (b["rack"][1] - b["rack"][0]))
    cam_data.dof.focus_distance = 3.4 + (8.4 - 3.4) * r
    # a slow drift along the thread, so the fibres slide against the lanterns
    cam = bpy.context.scene.camera
    d = min(t, b["rack"][0]) / b["rack"][0]
    cam.location = (0.2 - 0.2 * d, -3.4 + 0.1 * d, 0.05 - 0.05 * d)
    # the thread is drawn up and out of frame as it falls out of focus
    ob.location = (-0.3 * r, 0, 3.4 * r**1.5)
    glow.node_tree.nodes["Emission"].inputs["Strength"].default_value = 10 * rise * (1 - r)
    photo.inputs["Strength"].default_value = 0.46 * ease((t - b["rack"][0] + 0.3) / 1.0)
    push = 1 + 0.035 * max(0, t - b["rack"][0]) / (b["end"] - b["rack"][0])
    plane.scale = (4.03 * push, 3.02 * push, 1)


def set_fibres(cu, n, points, t, first):
    pos, rad = fibres(n, points, t)
    if first:
        cu.add_curves([points] * n)
        cu.attributes.new("radius", "FLOAT", "POINT")
        cu.attributes.new("dye", "FLOAT_COLOR", "CURVE").data.foreach_set("color", dyes(n).ravel())
    cu.attributes["position"].data.foreach_set("vector", pos.ravel())
    cu.attributes["radius"].data.foreach_set("value", rad.ravel())
    cu.update_tag()


def main():
    a = args()
    s, cu, ob, cam_data, plane, photo, glow = scene(a)
    points = 56
    if a.frames:
        os.makedirs(a.out, exist_ok=True)
        todo = [(f / FPS, os.path.join(a.out, f"f{f:04d}.png")) for f in range(a.frames[0], a.frames[1] + 1)]
    else:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        todo = [(a.t, a.out)]
    first = True
    for t, path in todo:
        if os.path.exists(path) and a.frames:
            continue  # resume an interrupted run
        began = time.time()
        set_fibres(cu, a.fibres, points, t, first)
        animate(t, ob, cam_data, plane, photo, glow)
        first = False
        s.render.filepath = os.path.abspath(path)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path} in {time.time() - began:.1f}s", flush=True)


if __name__ == "__main__":
    main()
