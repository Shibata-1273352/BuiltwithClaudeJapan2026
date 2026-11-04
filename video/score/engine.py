"""A small score renderer: a sampler for the CC0 VSCO 2 CE instruments, the app's plucked string, and
a timeline to place them on. Everything is placed in seconds, so a note can land on a picture cut.
"""

import glob
import os
import re
from functools import lru_cache

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
S = os.path.join(HERE, "samples")
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi(name):
    m = re.fullmatch(r"([A-G]#?)(-?\d)", name)
    return NOTE[m[1]] + 12 * (int(m[2]) + 1)


def hz(n):
    return 440 * 2 ** ((n - 69) / 12)


@lru_cache(maxsize=None)
def bank(pattern):
    """{midi: [paths]} for the samples a glob finds, reading the note from the file name."""
    out = {}
    for p in sorted(glob.glob(os.path.join(S, pattern))):
        m = re.search(r"_([A-G]#?)(\d)_", os.path.basename(p))
        if m:
            out.setdefault(midi(m[1] + m[2]), []).append(p)
    if not out:
        raise FileNotFoundError(pattern)
    return out


@lru_cache(maxsize=None)
def load(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x[:, :2], sr


def resampled(x, ratio):
    """Reads x faster by ratio: pitch and speed together, as a tape would."""
    n = int(len(x) / ratio)
    pos = np.arange(n) * ratio
    idx = np.arange(len(x))
    return np.stack([np.interp(pos, idx, x[:, c]) for c in range(2)], axis=1).astype(np.float32)


def skip_silence(x, floor=0.004):
    hit = np.nonzero(np.abs(x).max(axis=1) > floor)[0]
    return x[max(0, hit[0] - 200) :] if len(hit) else x


def sampled(pattern, note, dur, gain=1.0, attack=0.02, release=0.4, take=0, offset=0.0):
    """One note: the nearest sample, shifted to pitch, shaped to dur seconds."""
    b = bank(pattern)
    nearest = min(b, key=lambda k: abs(k - note))
    x, sr = load(b[nearest][take % len(b[nearest])])
    x = resampled(skip_silence(x), sr / SR * 2 ** ((note - nearest) / 12))
    x = x[int(offset * SR) :]
    total = int((dur + release) * SR)
    x = x[:total]
    env = np.ones(len(x), np.float32)
    a = min(len(x), max(1, int(attack * SR)))
    env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    r = min(len(x), int(release * SR))
    env[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return x * env[:, None] * gain


def one_shot(path, gain=1.0, rate=1.0):
    x, sr = load(os.path.join(S, path))
    return resampled(skip_silence(x), sr / SR * rate) * gain


def pluck(note, seconds=3.2, gain=1.0, seed=1, damp=0.998, soft=0.5):
    """The app's string (feel.ts, pluckSamples): a noise burst in a delay line, averaged as it goes
    round. The line is rounded to whole samples there; here the result is retuned, and it rings
    longer, because a score has more time than a tap on a thread."""
    f = hz(note)
    period = max(2, round(SR / f))
    n = int(SR * seconds)
    s = seed
    buf = np.empty(period)
    for i in range(period):
        s = (s * 16807) % 2147483647
        buf[i] = (s / 2147483647) * 2 - 1
    # a finger, not a pick: the burst is softened before it enters the string
    b, a = signal.butter(1, min(0.99, soft * 6000 / (SR / 2)))
    buf = signal.lfilter(b, a, np.concatenate([buf, buf]))[period:]
    out = np.empty(n)
    for k in range(0, n, period):
        out[k : k + period] = buf[: min(period, n - k)]
        buf = 0.5 * (buf + np.roll(buf, -1)) * damp
    out = np.interp(np.arange(n) * (period * f / SR), np.arange(n), out)
    # the body of an instrument: two soft resonances, like the wood of a koto
    for centre, q, level in ((240, 3, 0.5), (620, 4, 0.3)):
        b, a = signal.iirpeak(centre / (SR / 2), q)
        out = out + level * signal.lfilter(b, a, out)
    out *= np.minimum(1, np.arange(n) / 40)
    out *= np.cos(np.linspace(0, np.pi / 2, n)) ** 0.5
    out = out / (np.abs(out).max() + 1e-9) * gain
    return np.stack([out, out], axis=1).astype(np.float32)


def string(note, gain=1.0, seed=1, soft=0.5, seconds=3.2):
    """The voice of the score: the app's string, doubled a hair sharp across the stereo field, with
    a real harp underneath for the body a delay line cannot give."""
    a = pluck(note, seconds, 1.0, seed, soft=soft)[:, 0]
    b = pluck(note + 0.06, seconds, 1.0, seed + 7, soft=soft)[:, 0]
    x = np.stack([0.72 * a + 0.34 * b, 0.46 * a + 0.62 * b], axis=1)
    harp = sampled("Strings/Harp/*.wav", int(round(note)), seconds * 0.7, gain=0.75, attack=0.002, release=seconds * 0.3)
    n = min(len(x), len(harp))
    x[:n] += harp[:n]
    return x / (np.abs(x).max() + 1e-9) * gain


def noise(seconds, seed=0):
    return np.random.default_rng(seed).normal(0, 1, (int(seconds * SR), 2)).astype(np.float32)


def band(x, lo, hi):
    sos = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def lowpass(x, f):
    return signal.sosfilt(signal.butter(2, f / (SR / 2), output="sos"), x, axis=0).astype(np.float32)


def curve(n, points):
    """Gain over n samples from (seconds, gain) points."""
    t = np.arange(n) / SR
    return np.interp(t, [p[0] for p in points], [p[1] for p in points]).astype(np.float32)[:, None]


def hall(seconds=2.9, seed=4):
    """A synthetic impulse response: a large wooden hall, darker as it decays."""
    n = int(seconds * SR)
    ir = noise(seconds, seed) * np.exp(-np.arange(n) / (SR * seconds / 6.5))[:, None]
    bright = lowpass(ir, 6500)
    dark = lowpass(ir, 1800)
    mix = np.linspace(0, 1, n)[:, None]
    ir = bright * (1 - mix) + dark * mix
    ir = np.concatenate([np.zeros((int(0.024 * SR), 2), np.float32), ir])
    return ir / np.sqrt((ir**2).sum(axis=0))


class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.dry = np.zeros((self.n, 2), np.float32)
        self.wet = np.zeros((self.n, 2), np.float32)
        self.hits = []

    def add(self, x, at, send=0.25, pan=0.0, label=None):
        """Place x at a time in seconds; pan -1 left, 1 right; send is how much reaches the hall."""
        i = int(at * SR)
        if i >= self.n:
            return
        x = x[: self.n - i]
        g = np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)], np.float32) * np.sqrt(2)
        self.dry[i : i + len(x)] += x * g
        self.wet[i : i + len(x)] += x * g * send
        if label:
            self.hits.append((label, round(at, 3)))

    def render(self, duck=None):
        wet = signal.fftconvolve(self.wet, hall(), axes=0)[: self.n].astype(np.float32)
        # no bass in the hall: it is what makes a mix sound muddy
        wet = signal.sosfilt(signal.butter(2, 170 / (SR / 2), "high", output="sos"), wet, axis=0).astype(np.float32)
        out = self.dry + wet * 1.3
        if duck:
            out = out * curve(self.n, duck)
        return out
