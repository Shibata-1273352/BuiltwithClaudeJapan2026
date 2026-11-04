"""The score of TSUMUGI, composed by Claude as code.

The theme is four notes, one for each of the four threads and for each character of 風雷神門:

    風 言  E      雷 時  A      神 間  G      門 場  D

A is the gold thread, and the top of the phrase. In 1878 the gold thread snaps and the phrase is
played with its A missing. In 1960 a solo violin leans on B and falls to A: the note comes back.

  score/.venv/bin/python score/compose.py
"""

import json
import os

import numpy as np
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, HighShelfFilter, Limiter, Pedalboard

from engine import SR, Mix, band, curve, lowpass, midi, noise, one_shot, sampled, string

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "out", "score")
THEME = ["E4", "A4", "G4", "D4"]

CELLO = "Strings/Cello Section/susvib/*_v1_*.wav"
CELLO_F = "Strings/Cello Section/susvib/*_v3_*.wav"
VIOLA = "Strings/Viola Section/susvib/*v1*.wav"
VIOLINS = "Strings/Violin Section/susVib/*v1*.wav"
SOLO = "Strings/Solo Violin/Arco Vib/*_p.wav"


def strings(mix, at, dur, notes, gain=0.3, attack=1.0, release=1.6):
    """A chord for the section, each voice breathing in slightly after the last."""
    for i, name in enumerate(notes):
        n = midi(name)
        pattern = CELLO if n < 55 else VIOLA if n < 64 else VIOLINS
        x = sampled(pattern, n, dur, gain=gain, attack=attack, release=release, take=i, offset=0.3)
        # a section breathes: it grows through the note and eases at the end of the bow
        x = x * curve(len(x), [(0, 0.6), (dur * 0.62, 1.0), (dur + release, 0.72)])
        mix.add(
            x,
            at + 0.07 * i,
            send=0.5,
            pan=(i / max(1, len(notes) - 1) - 0.5) * 0.7,
        )


def solo(mix, at, lean, hold, gain):
    """The appoggiatura: B leans, and melts into A with no gap in the bow."""
    mix.add(sampled(SOLO, midi("B5"), lean, gain=gain * 0.9, attack=0.35, release=0.42, offset=0.5), at, send=0.6, pan=0.15, label="solo B")
    mix.add(sampled(SOLO, midi("A5"), hold, gain=gain, attack=0.4, release=1.4, offset=0.5), at + lean - 0.04, send=0.6, pan=0.15, label="solo A")


def motif(mix, at, gaps, gain=0.5, skip=None, pan=-0.1):
    """The four notes; skip one to leave a hole where it belongs."""
    t = at
    rng = np.random.default_rng(int(at * 10))
    for i, (name, gap) in enumerate(zip(THEME, gaps)):
        if i != skip:
            lean = 1.0 if i == 1 else 0.82  # the phrase leans on its top note
            mix.add(string(midi(name), gain=gain * lean, seed=11 + i), t + rng.normal(0, 0.012), send=0.32, pan=pan, label=name)
        t += gap


def room(seconds, level=0.0016):
    """Air in a room, until the real room tone is recorded. Never digital silence."""
    return lowpass(noise(seconds, 8), 900) * level


def opening(tl):
    o = tl["opening"]
    L = o["lettersIn"]
    land = [L + w[1] + w[2] * 0.6 for w in o["write"]]
    land[1] = o["strike"]
    end = o["duration"]
    m = Mix(end)
    m.add(room(end), 0, send=0)

    # 緩: floss in the dark. One string, then the silk breathing
    m.add(string(midi("E4"), gain=0.1, seed=21), 0.4, send=0.5, label="first pluck")
    air = band(noise(2.2, 2), 2500, 9000) * curve(int(2.2 * SR), [(0, 0), (1.0, 0.012), (1.7, 0.012), (2.15, 0.05), (2.2, 0)])
    m.add(air, 0, send=0.2)
    m.add(sampled(CELLO, midi("D2"), 1.5, gain=0.26, attack=1.0, release=0.2, offset=0.4), 0.5, send=0.35)

    # 急: the thread is pulled away, and stops dead on the cut
    n = int(0.55 * SR)
    rise = band(noise(0.55, 3), 400, 7000) * curve(n, [(0, 0), (0.5, 0.1), (0.55, 0)])
    m.add(rise, 1.68, send=0.15, pan=0.4, label="pull")

    # 風: a breath, the first note, high strings like wind
    wind = band(noise(1.4, 5), 700, 3200) * curve(int(1.4 * SR), [(0, 0), (0.5, 0.012), (1.0, 0.008), (1.4, 0)])
    m.add(wind, L + 0.05, send=0.4, pan=-0.3)
    m.add(string(midi("E4"), gain=0.15, seed=11), L + 0.3, send=0.45, pan=-0.2, label="風 E")
    m.add(sampled(VIOLINS, midi("E5"), 0.8, gain=0.05, attack=0.4, release=0.3, offset=0.3), L + 0.3, send=0.6)

    # 雷: everything at once
    s = o["strike"]
    m.add(one_shot("Percussion/BDrumNewhit_v7_rr1_Sum.wav", 0.42, rate=0.78), s, send=0.3, label="雷 strike")
    m.add(one_shot("Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", 0.5, rate=0.8), s, send=0.35)
    m.add(one_shot("Percussion/gongHit_f.wav", 0.07, rate=0.8)[: int(1.6 * SR)] * curve(int(1.6 * SR), [(0, 1), (0.5, 0.35), (1.6, 0)]), s, send=0.22)
    m.add(string(midi("A4"), gain=0.42, seed=12, soft=0.9), s, send=0.4, label="雷 A")
    m.add(string(midi("A3"), gain=0.26, seed=13, soft=0.9), s, send=0.4)
    m.add(sampled(CELLO_F, midi("A2"), 0.7, gain=0.16, attack=0.03, release=0.7, offset=0.3), s, send=0.4)
    thunder = lowpass(noise(1.2, 6), 130) * curve(int(1.2 * SR), [(0, 0.09), (0.15, 0.05), (1.2, 0)])
    m.add(thunder, s + 0.03, send=0.3)

    # 神: after the thunder, one soft note alone
    m.add(string(midi("G4"), gain=0.14, seed=13), land[2], send=0.55, pan=0.2, label="神 G")

    # 門: the weight of the gate
    m.add(string(midi("D4"), gain=0.2, seed=14), land[3], send=0.45, label="門 D")
    m.add(one_shot("Percussion/Timpani/Timpani1_Hit_v1_rr1_Sum.wav", 0.34, rate=0.7), land[3], send=0.4)
    m.add(sampled(CELLO_F, midi("D2"), 1.0, gain=0.12, attack=0.08, release=0.8, offset=0.3), land[3], send=0.4)

    # the lantern lights: the first full chord of the film, and a solo line leaning into A
    a = o["lanternIn"][0]
    strings(m, a - 0.25, 2.4, ["D2", "A2", "D3", "A3", "F#4", "A4", "E5"], gain=0.33, attack=1.2, release=1.5)
    solo(m, a + 0.7, 0.62, 1.3, 0.75)

    # the held breath before the strike, and the fall to near silence before the first word
    duck = [(0, 1), (s - 0.3, 1), (s - 0.2, 0.3), (s - 0.01, 0.3), (s, 1), (s + 0.6, 1), (s + 1.1, 0.82), (a - 0.3, 0.82), (a + 0.8, 1), (end - 1.0, 1), (end, 0.32)]
    return m, m.render(duck)


def theme():
    """The arc of the whole film in thirty seconds: statement, the gap, the return."""
    end = 30
    m = Mix(end)
    m.add(room(end), 0, send=0)
    gaps = [1.25, 1.35, 1.3, 1.6]
    strings(m, 0.6, 9.5, ["D2", "A2"], gain=0.16, attack=2.5, release=2.4)
    motif(m, 1.0, gaps, gain=0.42)
    motif(m, 6.6, [1.1, 1.2, 1.15, 1.4], gain=0.46, pan=0.1)
    strings(m, 6.4, 4.2, ["D3", "A3", "E4"], gain=0.09, attack=1.8, release=2)

    # 1878: the gold note does not come. The chord under it thins out
    strings(m, 11.7, 3.4, ["B1", "F#3"], gain=0.13, attack=1.4, release=1.6)
    motif(m, 12.0, [1.3, 1.6, 1.3, 1.6], gain=0.38, skip=1)

    # 間: two seconds of room, then the violin leans on B and gives the note back
    solo(m, 19.0, 1.0, 2.6, 1.0)

    # the whole phrase with everything under it
    gaps = [1.2, 1.25, 1.35, 1.8]
    t = 21.6
    for chord, gap in zip(
        (["A2", "E3", "A3", "C#4"], ["F#2", "D3", "A3", "D4"], ["G2", "D3", "B3", "D4"], ["D2", "A2", "F#3", "A3", "D4"]), gaps
    ):
        strings(m, t - 0.25, gap + (2.2 if chord[0] == "D2" else 0.25), chord, gain=0.15, attack=0.55, release=1.1 if chord[0] != "D2" else 2.4)
        t += gap
    motif(m, 21.6, gaps, gain=0.46)
    m.add(string(midi("D5"), gain=0.24, seed=16), 27.4, send=0.55, label="last note")
    return m, m.render()


def master(x, name, peak_db=-1.5):
    """One fixed gain, never a dynamic normaliser: the distance between quiet and loud is the point."""
    bus = Pedalboard([
        HighpassFilter(28),
        Compressor(threshold_db=-20, ratio=1.5, attack_ms=35, release_ms=280),
        HighShelfFilter(cutoff_frequency_hz=9000, gain_db=1.2),
        Limiter(threshold_db=-1.0, release_ms=80),
    ])
    x = bus(x.T.copy(), SR).T
    mid, side = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2 * 0.72
    x = np.stack([mid + side, mid - side], axis=1)
    x = x * (10 ** (peak_db / 20) / np.abs(x).max())
    sf.write(os.path.join(OUT, f"{name}.wav"), x, SR, subtype="PCM_24")


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(ROOT, "timeline.json")) as f:
        tl = json.load(f)
    for name, build in (("opening", lambda: opening(tl)), ("theme", theme)):
        m, audio = build()
        master(audio, name)
        print(name, m.hits)


main()
