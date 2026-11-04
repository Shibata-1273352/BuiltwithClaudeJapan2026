"""From the CC0 lantern photo: a day-for-night grade, and stitch paths for 風雷神門.

The grade only darkens and tints; nothing in the photograph is painted or moved. The stitch paths
follow the real brush strokes, so the gold silk lands exactly on the letters of the photo.

  score/.venv/bin/python render/prep_letters.py
"""

import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

SRC = os.path.expanduser("~/tsumugi-data/samples/kaminarimon_cc0.jpg")
CROP = (0, 610, 1600, 1610)  # the lantern and its letters, above the crowd and the name plate
# 風雷神門 only: the date column runs left of this line
LETTERS = [(668, 660), (1040, 660), (1040, 1600), (572, 1600)]
TOP, BOTTOM = 672, 1580  # the four characters, for the writing order

rng = np.random.default_rng(11)
img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32) / 255


def polygon(points):
    m = Image.new("L", (img.shape[1], img.shape[0]), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.asarray(m) > 0


# --- day for night ---------------------------------------------------------------------------
# the outline of the paper, by hand: colour alone loses the letters and their white edges
lantern = polygon([
    (400, 720), (640, 668), (880, 678), (1062, 760), (1122, 950), (1132, 1200), (1092, 1450),
    (962, 1602), (780, 1652), (560, 1632), (360, 1562), (230, 1432), (184, 1250), (208, 1020), (290, 830),
])
lantern = ndi.gaussian_filter(lantern.astype(np.float32), 34) > 0.5  # round off the hand-drawn corners
soft = ndi.gaussian_filter(lantern.astype(np.float32), 7)[..., None]

h, w = lantern.shape
yy, xx = np.mgrid[0:h, 0:w]
spill = np.exp(-(((xx - 650) / 760.0) ** 2 + ((yy - 1120) / 700.0) ** 2))[..., None]
luma = img @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
# blown-out daylight goes to the dusk of the concept image; the lantern's light reaches the beams
sky = (luma > 0.82)[..., None]
dusk = np.array([0.055, 0.078, 0.149], dtype=np.float32)  # night, #0e1426
around = img * np.array([0.4, 0.32, 0.42], dtype=np.float32) * (0.1 + 0.9 * spill**1.5)
sky = ndi.gaussian_filter(sky.astype(np.float32)[..., 0], 12)[..., None]
glow = np.array([0.34, 0.1, 0.05], dtype=np.float32) * spill**3
around = around * (1 - sky) + (dusk + glow * 0.5) * sky
# the paper lit from inside: brighter at the centre, deeper at the edge
inner = np.exp(-(((xx - 640) / 430.0) ** 2 + ((yy - 1130) / 430.0) ** 2))[..., None]
lit = img * np.array([1.12, 0.9, 0.82], dtype=np.float32) * (0.62 + 0.62 * inner)
out = around * (1 - soft) + lit * soft
x0, y0, x1, y1 = CROP
Image.fromarray((np.clip(out, 0, 1)[y0:y1, x0:x1] * 255).astype(np.uint8)).save("public/lantern-dusk.png")

# --- stitch paths ----------------------------------------------------------------------------
red_ = img[..., 0] > img[..., 1] * 1.5  # paper
ink = ~red_ & (luma < 0.62) & polygon(LETTERS) & lantern
ink = ndi.binary_opening(ink, iterations=3)
labels, _ = ndi.label(ink)
sizes = np.bincount(labels.ravel())
ink = (sizes[labels] > 3000) & (labels > 0)  # drop glare specks and the mark below 門
# which character each brush mark belongs to, by its centre: strokes are never split between colours
labels, count = ndi.label(ink)
centres = np.array(ndi.center_of_mass(ink, labels, range(1, count + 1)))[:, 0]
char_of = np.concatenate([[0], np.digitize((centres - TOP) / (BOTTOM - TOP), [0.23, 0.47, 0.71])])
print("brush marks", count, "per character", np.bincount(char_of[1:], minlength=4))
Image.fromarray((ink[y0:y1, x0:x1] * 255).astype(np.uint8)).save("public/letters-mask.png")

# satin stitch: parallel threads laid across the letter, each cut by its edge, so the outline stays
# as sharp as the brush made it and the silk catches the light in one direction
COUNT, POINTS = 26000, 24
h, w = ink.shape
ys, xs = np.nonzero(ink)
paths, chars = [], []
while len(paths) < COUNT:
    k = rng.integers(0, len(xs))
    x, y = float(xs[k]), float(ys[k])
    ang = np.radians(62 + rng.normal(0, 3.5))
    dx, dy = np.cos(ang), np.sin(ang)
    reach = []
    for sign in (-1, 1):
        d = 0.0
        while d < 90:
            i, j = int(y + sign * (d + 1.5) * dy), int(x + sign * (d + 1.5) * dx)
            if not (0 <= i < h and 0 <= j < w) or not ink[i, j]:
                break
            d += 1.5
        reach.append(d)
    if reach[0] + reach[1] < 6:
        continue
    u = np.linspace(-reach[0], reach[1], POINTS)
    bow = 0.8 * np.sin(np.linspace(0, np.pi, POINTS)) * rng.normal(0, 1)
    paths.append(np.stack([x + u * dx - bow * dy, y + u * dy + bow * dx], 1))
    chars.append(char_of[labels[int(y), int(x)]])
paths = np.array(paths, dtype=np.float32)

# reading order: top to bottom, with a little scatter so a character fills rather than wipes
order = (paths[:, :, 1].mean(axis=1) - TOP) / (BOTTOM - TOP)
np.savez("public/letters.npz", paths=paths, order=order.astype(np.float32), chars=np.array(chars), crop=np.array(CROP))
print("stitches", paths.shape, "ink px", int(ink.sum()), "lantern px", int(lantern.sum()))
