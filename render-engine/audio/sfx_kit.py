# Reusable synthesized sound helpers (crowds, water, wood, metal, transitions), built on sfx_gen.py / dsp.py.
# Extracted from the Hammersmith short's cue list so spec_audio.py can place them from any VideoSpec.
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, shelf, pan, st, place, fades, widen, make_ir, convolve_st,
                 momentary_max, integrated, colored, smooth_noise, modal)
import sfx_gen as G


# ================================================================ helpers for composite cues
def _cut(gen, dur, fin, fout):
    def g():
        x, a = gen()
        return fades(x, fin, fout), a
    return g


def _over(a, b, t):
    """mono b laid over mono a from t seconds"""
    y = np.zeros(max(len(a), ns(t) + len(b)))
    y[:len(a)] += a
    y[ns(t):ns(t) + len(b)] += b
    return y


def _oar_catch(r):
    d = 0.6
    t = tt(d)
    y = np.zeros(ns(d))
    for i in range(8):   # eight blades, a few ms apart
        tm = abs(r.normal(0, 0.012))
        k = ns(tm)
        b = G.bubbles(0.25, r, 260, 300, 1800, (0.004, 0.015), np.exp(-tt(0.25) / 0.05)) * 0.5
        sl = bp(r.standard_normal(ns(0.25)), 300, 3500, 1) * np.exp(-tt(0.25) / 0.02) * 0.6
        y[k:k + ns(0.25)] += (b + sl)[: len(y) - k]
    swish = bp(r.standard_normal(ns(d)), 500, 2500, 1) * np.clip(t / 0.08, 0, 1) * np.exp(-t / 0.18) * 0.35
    clunk = modal(d, [(r.uniform(300, 420), 0.6, 0.02), (r.uniform(900, 1300), 0.3, 0.01)], r) * 0.4
    return widen(y + swish + clunk, r, 9, 0.5)


def _cox(r):
    out = np.zeros(ns(1.2))
    for k in range(3):
        h = G.hurrah(r, r.uniform(230, 280), 1.2, True)
        G._place_mono(out, h * 0.7, k * 0.33)
    return out


def _golden(dur, r):
    n = ns(dur)
    x = G.breeze(dur, r, 0.7, 0.1, 650)
    x += st(lp(bp(colored(n, r, 0.8), 150, 1400, 1), 1200) * 0.35)
    x += pan(G.bird_chirps(dur, r, 0.35, "blackbird") * 0.06, -0.5)
    x += pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.04, 0.6)
    x += widen(G.crickets(dur, r, 3) * 0.008, r, 9, 1.0)
    return x


def _flash(r):
    dur = 0.75
    y = G.whoosh(dur, r, 0.33, 500, 4200, 0.9, 0.09, 0.4)
    t = tt(dur)
    boom = np.where(t > 0.33, np.exp(-(t - 0.33) / 0.12) * np.sin(2 * np.pi * 62 * (t - 0.33)), 0) * 0.8
    return widen(y + boom, r, 12, 0.9), 0.33


def _murmur(dur, r, voices):
    n = ns(dur)
    out = np.zeros((2, n))
    for v in range(voices):
        kind = r.uniform()
        base, scale = ((r.uniform(95, 140), r.uniform(0.95, 1.05)) if kind < 0.45 else
                       (r.uniform(175, 235), r.uniform(1.12, 1.2)) if kind < 0.85 else (r.uniform(260, 330), r.uniform(1.25, 1.35)))
        y = G.babble(dur, r, base, scale, r.uniform(3.6, 4.8), r.uniform(0.55, 0.8), fmax=3400)
        y = lp(y, r.uniform(2200, 3600), 1) * r.uniform(0.3, 1.0)
        out += pan(y, r.uniform(-0.85, 0.85))
    return fades(out, 0.25, 0.6)


def _cheer(dur, r, voices=26):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for v in range(voices):
        kid = v % 6 == 5
        base = r.uniform(270, 340) if kid else (r.uniform(105, 160) if v % 2 else r.uniform(180, 250))
        scale = 1.3 if kid else (1.0 if v % 2 else 1.15)
        for rep in range(1 + int(r.uniform() < 0.4)):
            h = G.hurrah(r, base * r.uniform(0.97, 1.05), scale, kid)
            tm = r.uniform(0.05, max(0.1, dur * 0.35)) + rep * r.uniform(0.6, 0.9)
            if tm < dur - 0.3:
                place(out, pan(lp(h, 4000, 1) * r.uniform(0.35, 1.0), r.uniform(-0.9, 0.9)), tm)
    env = np.interp(t, [0, 0.3, 0.8, dur * 0.6, dur], [0.0, 0.5, 1.0, 0.7, 0.0])
    out += G.applause(dur, r, 40, env) * 0.8
    return fades(out, 0.05, 0.4)


def _steps(dur, r, n_):
    out = np.zeros((2, ns(dur + 0.3)))
    for k in range(int(n_ * dur * 1.6)):
        s = G.stroll_step(r, r.uniform(0.3, 1.0)) * r.uniform(0.25, 1.0)
        place(out, pan(shelf(s, 1500, 3.0, "high"), r.uniform(-0.8, 0.8)), r.uniform(0, dur))
    return fades(out, 0.1, 0.3)


def _rush(r):
    out = np.zeros((2, ns(1.6)))
    place(out, _steps(1.2, r, 60), 0.0)
    for v in range(10):
        w = G.whoa(r, dur=r.uniform(0.3, 0.45))
        place(out, pan(w * r.uniform(0.3, 0.8), r.uniform(-0.8, 0.8)), r.uniform(0.05, 0.5))
    for v in range(8):
        h = G.hurrah(r, r.uniform(110, 240), r.uniform(1.0, 1.18))
        place(out, pan(lp(h, 4000, 1) * r.uniform(0.3, 0.7), r.uniform(-0.8, 0.8)), r.uniform(0.3, 0.9))
    return fades(out, 0.02, 0.3)


def _whoas(r):
    out = np.zeros((2, ns(0.9)))
    for v in range(11):
        w = G.whoa(r, dur=r.uniform(0.35, 0.55))
        place(out, pan(w * r.uniform(0.4, 1.0), r.uniform(-0.8, 0.8)), r.uniform(0.0, 0.25))
    return out


def _hull_knock(r):
    d = 0.5
    knock = modal(d, [(r.uniform(140, 190), 1.0, 0.05), (r.uniform(380, 520), 0.6, 0.03), (r.uniform(900, 1200), 0.25, 0.015)], r)
    slap = bp(r.standard_normal(ns(d)), 300, 2500, 1) * np.exp(-tt(d) / 0.04) * 0.5
    bub = G.bubbles(d, r, 120, 300, 1400, (0.005, 0.02), np.exp(-tt(d) / 0.12)) * 0.5
    return knock + slap + bub


def _tip(r):
    out = np.zeros((2, ns(2.0)))
    s = G.splash_big(r)
    place(out, pan(lp(s, 7000, 1) * 0.6, -0.2), 0.0)
    place(out, pan(_hull_knock(r) * 1.4, 0.0), 0.0)
    for v in range(4):
        w = G.whoa(r, base=r.uniform(120, 220), dur=r.uniform(0.35, 0.5))
        place(out, pan(w * r.uniform(0.5, 0.9), r.uniform(-0.6, 0.6)), r.uniform(0.0, 0.12))
    return out


def _plop(r):
    d = 0.8
    t = tt(d)
    plop = np.exp(-t / 0.05) * np.sin(2 * np.pi * (500 + 900 * np.exp(-t / 0.02)) * t) * 0.6
    bub = G.bubbles(d, r, 60, 400, 1600, (0.006, 0.02), np.exp(-t / 0.25)) * 0.6
    return plop + bub


def _bell(r):
    d = 1.0
    return _over(modal(d, [(2950, 0.9, 0.35), (4130, 0.6, 0.25), (6210, 0.3, 0.12)], r), modal(0.8, [(2950, 0.6, 0.3), (4130, 0.4, 0.2)], r), 0.18)


def _crack(r):
    d = 1.0
    t = tt(d)
    y = np.zeros(ns(d))
    for i in range(6):
        tm = i * 0.007 + (abs(r.normal(0, 0.012)) if i else 0.0)
        md = [(r.uniform(900, 1800), 1.0, 0.01), (r.uniform(2200, 4200), 0.7, 0.005), (r.uniform(4500, 8000), 0.4, 0.003)]
        k = modal(0.12, md, r) + hp(r.standard_normal(ns(0.12)), 1500) * np.exp(-tt(0.12) / 0.003)
        G._place_mono(y, k * (1.0 if i == 0 else r.uniform(0.3, 0.7)), tm)
    thud = np.exp(-t / 0.12) * np.sin(2 * np.pi * 70 * t) * 0.9
    grit = G.bubbles(d, r, 300 * np.exp(-t / 0.3) + 5, 2500, 7000, (0.001, 0.004), np.exp(-t / 0.35)) * 0.25
    return y + thud + grit


