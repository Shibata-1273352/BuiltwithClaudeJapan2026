"""Stitch paths for the title: TSUMUGI set in Shippori Mincho, laid as satin stitch like 風雷神門.

Coordinates are screen pixels of the 1920x1080 film, so title.py and the composition agree.

  score/.venv/bin/python render/prep_title.py
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

TEXT = "TSUMUGI"
S = 3  # mask pixels per screen pixel
SIZE = 176  # screen px
TRACK = 0.2  # letter spacing, in em
CENTRE = (960, 470)
COUNT, POINTS = 30000, 24

rng = np.random.default_rng(17)
font = ImageFont.truetype("public/fonts/ShipporiMincho-Bold.ttf", SIZE * S)
widths = [font.getlength(c) for c in TEXT]
total = sum(widths) + TRACK * SIZE * S * (len(TEXT) - 1)
W, H = 1920 * S, 1080 * S
mask = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask)
letter = np.zeros((H, W), np.int16) - 1
x = CENTRE[0] * S - total / 2
for i, c in enumerate(TEXT):
    one = Image.new("L", (W, H), 0)
    ImageDraw.Draw(one).text((x, CENTRE[1] * S), c, font=font, fill=255, anchor="lm")
    letter[np.asarray(one) > 128] = i
    x += widths[i] + TRACK * SIZE * S
ink = letter >= 0
Image.fromarray((ink * 255).astype(np.uint8)).resize((1920, 1080)).save("public/title-mask.png")

ys, xs = np.nonzero(ink)
paths, owner = [], []
while len(paths) < COUNT:
    k = rng.integers(0, len(xs))
    px, py = float(xs[k]), float(ys[k])
    ang = np.radians(62 + rng.normal(0, 3.5))
    dx, dy = np.cos(ang), np.sin(ang)
    reach = []
    for sign in (-1, 1):
        d = 0.0
        while d < 120:
            i, j = int(py + sign * (d + 1.5) * dy), int(px + sign * (d + 1.5) * dx)
            if not (0 <= i < H and 0 <= j < W) or not ink[i, j]:
                break
            d += 1.5
        reach.append(d)
    if reach[0] + reach[1] < 5:
        continue
    u = np.linspace(-reach[0], reach[1], POINTS)
    bow = 0.8 * np.sin(np.linspace(0, np.pi, POINTS)) * rng.normal(0, 1)
    paths.append(np.stack([px + u * dx - bow * dy, py + u * dy + bow * dx], 1) / S)
    owner.append(letter[int(py), int(px)])
paths = np.array(paths, dtype=np.float32)
np.savez("public/title.npz", paths=paths, letters=np.array(owner))
print("stitches", paths.shape, "ink px", int(ink.sum()), "width", round(total / S))
