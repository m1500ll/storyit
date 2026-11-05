# Picture timeline of "The Bridge Everyone Leaned On", mirrored (read-only) from src/videos/hammersmith/story.ts + cast.ts
# so every sound lands on its frame: shots, story time tau, the eights' stroke phase and position, the crowd's arrival
# and rush, the deck sway, the rowing boat, the crack.
import math
import json
import numpy as np

FPS = 30
TOTAL = 1800
DUR = TOTAL / FPS            # 60.0 s exactly
fr = lambda f: f / FPS
FLASH = fr(175)

# voice cues (s), same table as story.ts W
W = dict(thrilled=4.76, london=5.83, hammersmith=7.2, oxford=11.38, so=13.29, footpaths=14.6, road=15.93, gap=16.76,
         boats=18.13, rush=20.8, creak=22.53, sway=23.53, luckily=25.27, unluckily=27.02, watching=28.12, yousee=29.28,
         stand=31.78, crowd=34.38, pushed=36.06, lifts=37.41, ever=38.26, leans=39.78, same=41.31, tips=43.11,
         twelve2=43.98, oldbridge=47.33, stronger=49.27, eighty7=51.35, today=52.85, closed=54.15, cracks=56.51)

# id: (first frame, end frame, light, crowd)
SHOTS = {
    1: (0, 175, "day", "deck"), 2: (175, 399, "day", "deck"), 3: (399, 544, "day", "deck"), 4: (544, 676, "day", "deck"),
    5: (676, 758, "day", "deck"), 6: (758, 811, "day", "deck"), 7: (811, 878, "day", "owners"), 8: (878, 1148, "golden", "middle"),
    9: (1148, 1319, "golden", "rowboat"), 10: (1319, 1420, "golden", "edge"), 11: (1420, 1478, "day", "none"),
    12: (1478, 1585, "day", "tourists"), 13: (1585, TOTAL, "day", "today"),
}
XFADE = {8: 8, 9: 8, 10: 8, 11: 8, 12: 14, 13: 8}
BOATS_IN = {1, 2, 4, 5, 6}


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i, (a, b, *_r) in SHOTS.items():
        if a <= f < b:
            return i
    return 13


def tau_of(shot, t):
    return 21.6 + t if shot == 1 else t


def hh(i, s=0):
    """same hash as story.ts / cast.ts (IEEE doubles, so it reproduces the JS values)"""
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


def smooth(x):
    u = min(1.0, max(0.0, x))
    return u * u * (3 - 2 * u)


# ---- the eights: catch at stroke phase 0, 0.6 Hz, k = 0 Oxford (z -6.5), 1 Cambridge (z 6.0)
BOATS = [(-6.5, 0.0), (6.0, -3.5)]


def boat_x(tau, k):
    return 4.6 * (tau - 23.5) + BOATS[k][1]


def catches(t0, t1, k):
    """story times of every catch (blades in) for boat k between story times t0..t1"""
    out = []
    n0 = math.ceil((t0 * 0.6 + k * 0.17) - 1e-9)
    n = n0
    while True:
        tau = (n - k * 0.17) / 0.6
        if tau > t1:
            break
        if tau >= t0:
            out.append(tau)
        n += 1
    return out


# ---- the crowd: SPECTATORS from story.ts (arrival story time per person, rush start)
RUSH0 = 20.5


def spectators():
    out = []
    k = 0

    def add(x, z, arrive):
        i = len(out)
        out.append(dict(i=i, x=x, z=z, arrive=arrive, rush=RUSH0 + 0.5 * hh(i, 5)))
    z = -23.4
    while z <= 23.4 + 1e-9:
        for x in (-1.95, 1.95):
            add(x, z, 11.5 + 3.6 * hh(k + 1, 3)); k += 1
        z += 1.45
    z = -22.8
    while z <= 22.8 + 1e-9:
        for x in (-0.65, 0.65):
            add(x, z, 15.6 + 1.0 * hh(k + 1, 3)); k += 1
        z += 1.9
    z = -22.0
    while z <= 22.0 + 1e-9:
        add(0, z, 16.7 + 0.8 * hh(k + 1, 3)); k += 1
        z += 3.1
    return out


def sway(tau):
    pts = [(22.4, 0), (23.6, 0.25), (24.4, 1), (25.3, 0.7), (26.5, 0.15), (28, 0.05)]
    return float(np.interp(tau, [p[0] for p in pts], [p[1] for p in pts], left=0, right=0.05))


def rowboat_roll(t):
    s = smooth
    return -(0.07 * s((t - W["leans"] + 0.15) / 0.7) + 0.05 * s((t - W["same"]) / 1.4) + 0.3 * s((t - W["tips"] + 0.06) / 0.28))


def words(path):
    return json.load(open(path, encoding="utf-8"))
