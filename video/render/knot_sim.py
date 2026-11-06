"""Bridge 2, the physics: two cords woven into a knot and drawn tight.

Each cord is a chain of beads that keeps its length, resists bending and cannot pass through itself or
the other cord, so the knot tightens by sliding and pinching, as a real one does. The layout is a
Josephine knot (the awaji-musubi of gift cords): eight crossings, each going over then under.

Writes out/knot-sim.npy for render/knot.py, and a contact sheet with --sheet.

  score/.venv/bin/python render/knot_sim.py --sheet out/look/knot-sim.png
"""

import argparse
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

with open("timeline.json") as f:
    KNOT = json.load(f)["bridges"]["knot"]
FPS = 30
FRAMES = round(KNOT["duration"] * FPS)
TIGHT = KNOT["tighten"]
SUBSTEPS = 60
ITERATIONS = 14

R = 0.0135  # radius of a cord
H = 0.0125  # spacing of the beads
SCALE = 0.42  # of the layout
LAYOUT = [(-3.0, 0.15), (-1.3, 0.16), (-0.68, 0), (-0.36, -0.36), (0.2, -0.56), (0.72, -0.34), (0.88, 0), (0.72, 0.34), (0.2, 0.56), (-0.36, 0.36), (-0.68, 0), (-1.3, -0.16), (-3.0, -0.15)]
PULL = 0.24  # how far each end is drawn out
BEND = 0.03  # stiffness, as a share of the way to straight per pass
FLAT = 0.012  # the pull back into the plane of the knot
RECEDE = 0.62  # how far the ends lie behind the knot, for depth of field


def spline(points, step):
    p = np.array(points, float)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    t = np.linspace(0, 1, 200, endpoint=False)[:, None]
    fine = [0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t**2 + (3 * b - a - 3 * c + d) * t**3) for a, b, c, d in zip(p, p[1:], p[2:], p[3:])]
    fine = np.vstack(fine)
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(fine, axis=0).T))])
    even = np.arange(0, s[-1], step)
    return np.stack([np.interp(even, s, fine[:, 0]), np.interp(even, s, fine[:, 1])], axis=1)


def crossings(a, b, same):
    """Index pairs where the two polylines cross in the plane."""
    tree = cKDTree(b)
    found = []
    for i in range(len(a) - 1):
        for j in tree.query_ball_point(a[i], 3 * H):
            if j >= len(b) - 1 or (same and j < i + 20):
                continue
            p, r, q, s = a[i], a[i + 1] - a[i], b[j], b[j + 1] - b[j]
            d = r[0] * s[1] - r[1] * s[0]
            if abs(d) < 1e-12:
                continue
            u = ((q - p)[0] * s[1] - (q - p)[1] * s[0]) / d
            v = ((q - p)[0] * r[1] - (q - p)[1] * r[0]) / d
            if 0 <= u < 1 and 0 <= v < 1:
                found.append((i, j))
    return found


def weave(gold, blue):
    """Depth along each cord: over, under, over, walking along it."""
    passes = {0: [], 1: []}  # cord: (index, crossing id)
    x = 0
    for i, j in crossings(gold, gold, True):
        passes[0] += [(i, x), (j, x)]
        x += 1
    for i, j in crossings(blue, blue, True):
        passes[1] += [(i, x), (j, x)]
        x += 1
    for i, j in crossings(gold, blue, False):
        passes[0].append((i, x))
        passes[1].append((j, x))
        x += 1
    assert x == 8, f"{x} crossings"
    depth = [np.zeros(len(gold)), np.zeros(len(blue))]
    over = {}
    for cord, first in ((0, 1), (1, None)):
        walk = sorted(passes[cord])
        if first is None:  # the first gold crossing on this walk sets the phase
            i, c = next((i, c) for i, c in walk if c in over)
            first = -over[c] * (1 if walk.index((i, c)) % 2 == 0 else -1)
        for n, (i, c) in enumerate(walk):
            sign = first * (1 if n % 2 == 0 else -1)
            if c in over:
                assert over[c] == -sign, "the weave does not alternate"
            over[c] = sign
            depth[cord] += -sign * 1.15 * R * np.exp(-(((np.arange(len(depth[cord])) - i) * H / 0.05) ** 2))
    return depth


def start():
    gold = spline([(x * SCALE, z * SCALE) for x, z in LAYOUT], H)
    blue = gold * np.array([-1, 1])
    dg, db = weave(gold, blue)
    return [np.stack([c[:, 0], d, c[:, 1]], axis=1) for c, d in ((gold, dg), (blue, db))]


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (6 * u - 15) + 10)


def drawn(t):
    """How far the ends have travelled: a long draw, then the last of it all at once."""
    return PULL * (0.72 * ease(t / TIGHT * 0.9) + 0.28 * ease((t - TIGHT + 0.55) / 0.55))


def simulate():
    cords = start()
    n = len(cords[0])
    p = np.concatenate(cords)
    idx = np.arange(2 * n)
    cord = idx // n
    v = np.zeros_like(p)
    first = [0, n - 1, n, 2 * n - 1]
    home = p[first].copy()
    side = np.array([-1, -1, 1, 1], float)
    leg = np.array([1, -1, 1, -1], float)
    even = [np.array([i for i in range(c * n, (c + 1) * n - 1) if i % 2 == k]) for c in (0, 1) for k in (0, 1)]
    links = [np.concatenate([even[0], even[2]]), np.concatenate([even[1], even[3]])]
    inner = np.concatenate([np.arange(2, n - 2), np.arange(n + 2, 2 * n - 2)])

    def step(t, dt):
        nonlocal p, v
        before = p.copy()
        p = p + v * dt
        e = drawn(t) / PULL
        ends = home.copy()
        ends[:, 0] += side * PULL * e
        ends[:, 1] = RECEDE
        ends[:, 2] = leg * (abs(home[0, 2]) + (1.15 * R - abs(home[0, 2])) * e)
        pairs = cKDTree(p).query_pairs(2.6 * R, output_type="ndarray")
        a = b = np.zeros(0, int)
        if len(pairs):
            a, b = pairs[:, 0], pairs[:, 1]
            keep = (cord[a] != cord[b]) | (np.abs(a - b) > 2 * R / H + 2)
            a, b = a[keep], b[keep]
        for _ in range(ITERATIONS):
            for link in links:
                d = p[link + 1] - p[link]
                length = np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
                shift = 0.5 * (length - H) * d / length
                p[link] += shift
                p[link + 1] -= shift
            p[inner] += BEND * (p[inner - 1] + p[inner + 1] - 2 * p[inner])
            if len(a):
                d = p[b] - p[a]
                length = np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
                shift = 0.5 * np.maximum(0, 2 * R - length) * d / length
                np.add.at(p, a, -shift)
                np.add.at(p, b, shift)
            p[first] = ends
        p[:, 1] -= FLAT * p[:, 1] * np.exp(-((p[:, 0] / 0.32) ** 2))
        v = 0.3 * (p - before) / dt

    frames = []
    dt = 1 / (FPS * SUBSTEPS)
    for k in range(800):
        step(0, dt)
    for f in range(FRAMES):
        for k in range(SUBSTEPS):
            step(f / FPS + k * dt, dt)
        frames.append(p.reshape(2, n, 3).astype(np.float32).copy())
        if f % 20 == 0:
            stretch = np.linalg.norm(np.diff(p[:n], axis=0), axis=1).max() / H
            tree = cKDTree(p)
            pairs = tree.query_pairs(2 * R)
            near = min([np.linalg.norm(p[a] - p[b]) for a, b in pairs if cord[a] != cord[b]] or [9])
            print(f"frame {f}: stretch {stretch:.3f}, closest {near / (2 * R):.2f} of contact", flush=True)
    return np.stack(frames)


def sheet(sim, path):
    cols, w, h = 3, 640, 360
    picks = np.linspace(0, len(sim) - 1, 6).round().astype(int)
    im = Image.new("RGB", (cols * w, 2 * h), "#04050a")
    for k, f in enumerate(picks):
        tile = Image.new("RGB", (w, h), "#04050a")
        d = ImageDraw.Draw(tile)
        zoom, rad = w / 1.0, R * w / 1.0
        beads = [(y, x, z, rgb) for c, rgb in ((0, (226, 182, 90)), (1, (127, 166, 216))) for x, y, z in sim[f, c]]
        for y, x, z, rgb in sorted(beads, key=lambda b: -b[0]):
            shade = 0.5 + 0.5 * np.clip(1 - (y + 0.03) / 0.07, 0, 1)
            cx, cy = w / 2 + x * zoom, h / 2 - z * zoom
            d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=tuple(int(v * shade) for v in rgb))
        d.text((8, 8), f"f{f}", fill="white")
        im.paste(tile, ((k % cols) * w, (k // cols) * h))
    im.save(path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet")
    a = ap.parse_args()
    sim = simulate()
    np.save("out/knot-sim.npy", sim)
    if a.sheet:
        sheet(sim, a.sheet)
