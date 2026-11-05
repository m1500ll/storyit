# Every sound effect + ambience bed of "The Bridge Everyone Leaned On" as a cue list timed to the picture
# (timeline.py), rendered into one stereo SFX stem. Same level convention as the bridge template: each EVENT has a
# "naive" level (LU relative to the voice stem, as the event's max momentary loudness) placed SFX_DB = -6 dB under it;
# ambience BEDS (integrated loudness) are not reduced. All generators come from the template's sfx_gen.py.
import math
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, shelf, pan, st, place, fades, widen, make_ir, convolve_st,
                 momentary_max, integrated, colored, smooth_noise, modal)
import sfx_gen as G
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0
W = T.W


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None, cut=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send, self.cut = kind, p, extra, lpf, send, cut
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


def cues():
    C = []
    R = rng(1870)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append
    fl = T.FLASH

    # ------------------------------------------------ ambience beds
    def amb_day(dur, river=0.5, flags=0.25, seed=1, traffic=0.0):
        def g():
            r = rng(seed)
            n = ns(dur)
            x = G.breeze(dur, r, 1.0, 0.15, 850)
            rv = bp(colored(n, r, 0.8), 180, 1800, 1) * river * (0.8 + 0.2 * smooth_noise(n, r, 0.3))
            x += st(rv)
            x += pan(G.bird_chirps(dur, r, 0.45, "sparrow") * 0.08, 0.5)
            x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.05, -0.6)
            x += pan(G.flag_flutter(dur, r) * flags, 0.3)
            if traffic:   # today: a far city hum (no cars on this bridge, plenty elsewhere)
                x += st(lp(colored(n, r, 1.6), 380, 2) * traffic * (0.85 + 0.15 * smooth_noise(n, r, 0.2)))
            return fades(x, 0.4, 0.6), 0.0
        return g
    add(Cue(0.0, "amb_day", "race day by the river: breeze, river, sparrows, tower flags (shots 1-7)", _cut(amb_day(29.3, 0.6), 29.3, 0.3, 0.5),
            -29, "bed", send=0.0))
    add(Cue(29.1, "amb_golden", "golden-hour calm: soft breeze, blackbirds, crickets, distant river (shots 8-10)",
            _cut(lambda: (_golden(18.4, rng(43)), 0.0), 18.4, 0.5, 0.4), -29, "bed", send=0.0))
    add(Cue(38.1, "amb_water", "close water around the rowing boat: lapping, sloshes, drips (shot 9)",
            _cut(lambda: (G.water_bed(6.0, rng(41), 0.7, 0.6), 0.0), 6.0, 0.35, 0.4), -24, "bed", send=0.0))
    add(Cue(47.2, "amb_town", "town day air: breeze, sparrows, bunting, river (shots 11-12)", _cut(amb_day(5.7, 0.45, 0.35, seed=45), 5.7, 0.4, 0.3),
            -29, "bed", send=0.0))
    add(Cue(52.75, "amb_today", "today: breeze, river, a far city hum (shot 13)", _cut(amb_day(7.25, 0.45, 0.2, seed=46, traffic=0.5), 7.25, 0.3, 1.2),
            -28, "bed", send=0.0))

    # ------------------------------------------------ the eights: oar catches (blades in) + drive swish, when on screen
    for k, (bz, lead) in enumerate(T.BOATS):
        for shot in sorted(T.BOATS_IN):
            a, b = T.shot_t(shot)
            for tau in T.catches(T.tau_of(shot, a), T.tau_of(shot, b), k):
                t = tau - 21.6 if shot == 1 else tau
                if t < a or t >= b - 0.05:
                    continue
                d = _boat_cam_dist(shot, t, tau, k)
                g = -14.0 * math.log10(max(d, 4) / 4)
                if shot == 1 and t > 4.2:
                    g -= 4
                add(Cue(t, "oar_catch", f"{'Oxford' if k == 0 else 'Cambridge'}: eight blades bite the water + drive swish (shot {shot}, {d:.0f} m)",
                        (lambda r=rr(): (_oar_catch(r), 0.0)), -12, extra=max(g, -16), lpf=float(np.clip(15000 * (4 / max(d, 4)) ** 0.5, 2200, 15000)),
                        send=0.15, p=0.25 if k else -0.25, group="oars", cut=fl + 0.02 if shot == 1 else None))
        add(Cue(T.shot_t(2)[0] + 6.0 - 0.2 * k, "cox_call", "cox calling the stroke (far)", (lambda r=rr(): (_cox(r), 0.0)), -18, lpf=3500, send=0.3,
                p=0.4 if k else -0.4, group="cox"))

    # ------------------------------------------------ crowd: murmur that grows as the deck fills, footsteps arriving
    add(Cue(0.0, "crowd_hook", "packed deck in the flash-forward: 'whoa's as it sways, nervous murmur",
            lambda: (_murmur(fl + 0.1, rng(11), 28) * 0.8, 0.0), -10, lpf=4200, send=0.3, cut=fl + 0.02))
    add(Cue(1.2, "whoas_hook", "crowd 'whoa!' as the deck swings (hook)", lambda: (_whoas(rng(12)), 0.0), -9, send=0.25, cut=fl + 0.02))
    add(Cue(fl, "town_murmur", "townsfolk on both banks waiting for the race (shot 2)", lambda: (_murmur(7.2, rng(21), 18), 0.0), -14, lpf=3400, send=0.35))
    add(Cue(W["oxford"] - 1.2, "bank_cheer", "banks cheer the crews on 'the best free seat'", lambda: (_cheer(2.6, rng(22), 18), 0.0), -9, lpf=4600, send=0.35))
    add(Cue(W["so"] - 0.2, "deck_murmur", "the deck fills: murmur swelling from a handful of voices to a packed crowd (shot 3)",
            lambda: (_murmur(4.9, rng(31), 30) * np.interp(tt(4.9), [0, 1.5, 3.5, 4.9], [0.25, 0.55, 1.0, 1.0])[None, :], 0.0), -12, lpf=3800, send=0.3))
    for t0, n_, lvl, desc in [(W["footpaths"] - 0.3, 14, -14, "footpaths fill"), (W["road"] - 0.2, 22, -12, "then the road"), (W["gap"] - 0.15, 30, -11, "every last gap")]:
        add(Cue(t0, "crowd_steps", f"crowd footsteps on the planks: {desc}", (lambda r=rr(), n_=n_: (_steps(1.3, r, n_), 0.0)), lvl, send=0.2, group="crowd_steps"))
    add(Cue(W["boats"] - 0.1, "race_murmur", "crowd excited as the boats appear (shot 4)", lambda: (_murmur(2.7, rng(41), 30), 0.0), -10, lpf=4200, send=0.3))
    add(Cue(W["rush"] - 0.15, "rush", "twelve thousand people rush to one rail: running feet, hurrahs, 'there they are!'",
            lambda: (_rush(rng(42)), 0.0), -4, send=0.25))
    add(Cue(W["rush"] + 0.6, "rush_cheer", "cheering at the upstream rail", lambda: (_cheer(1.9, rng(43), 26), 0.0), -8, lpf=5000, send=0.3))

    # ------------------------------------------------ the chains creak, the deck sways
    add(Cue(W["creak"] - 0.12, "chain_creak", "'The chains creak': long iron groan + timber creak (crowd goes quiet)",
            lambda: (_over(G.chain_groan(1.3, rng(225), 0.7, 1.0, 18, 26, beats=[0.1, 0.6], t0=0.0), G.creak(0.8, rng(226), 50, 90, G.TIMBER, rough=0.2) * 0.6, 0.25), 0.0),
            -2, p=-0.35, send=0.18))
    for k in range(5):
        tm = 22.4 + (0.25 + k / 2) / 0.95 + 0.2
        if tm < W["sway"] - 0.2 or tm > 26.6:
            continue
        a = T.sway(tm)
        add(Cue(tm, "sway_creak", f"the deck swings (0.95 Hz): creak + chain groan at each extreme (sway {a:.2f})",
                (lambda r=rr(), a=a: (G.creak(0.5, r, 50, 85, G.TIMBER, [(0, 0), (0.4, 1), (0.8, 0.6), (1, 0)], 0.2, 0.04) * (0.5 + 0.5 * a), 0.1)), -6,
                extra=6 * math.log10(max(a, 0.15)), p=0.3 if k % 2 else -0.3, lpf=8000, send=0.25, group="sway_creak"))
    add(Cue(W["sway"] + 0.15, "sway_groan", "chains groaning through the sway", lambda: (G.chain_groan(1.9, rng(236), 0.8, 0.4, 16, 22, beats=[0.2, 0.75, 1.3], t0=0.0), 0.0),
            -7, p=-0.3, send=0.18))
    add(Cue(W["sway"] + 0.35, "whoas", "crowd: 'whoa!' as the deck swings under them", lambda: (_whoas(rng(237)), 0.0), -6, send=0.25))
    add(Cue(W["luckily"] + 0.6, "relief_cheer", "relief: the crowd cheers the crews rowing away (shot 6)", lambda: (_cheer(1.8, rng(251), 22), 0.0), -10, lpf=4800, send=0.35))

    # ------------------------------------------------ explanation (golden): the deck tilts under one-sided load
    add(Cue(W["crowd"] - 0.05, "group_steps", "the small crowd shuffles to one side", lambda: (_steps(0.9, rng(343), 16), 0.0), -12, send=0.2))
    add(Cue(W["pushed"] - 0.05, "tilt_creak", "deck tilting down on the loaded side: long low timber creak",
            lambda: (G.creak(1.3, rng(360), 40, 70, G.TIMBER, [(0, 0), (0.25, 1), (0.8, 0.7), (1, 0)], 0.2, 0.04), 0.1), -8, p=0.3, send=0.25))
    add(Cue(W["lifts"] - 0.05, "lift_creak", "the other side lifts: chain strain (higher creak)",
            lambda: (G.creak(0.7, rng(374), 140, 230, G.CHAIN, [(0, 0), (0.3, 1), (1, 0)], 0.12, 0.03) * 0.8, 0.1), -12, p=-0.3, send=0.25))

    # ------------------------------------------------ rowing boat analogy
    for tm in (38.4, 39.25, 40.9, 41.7, 42.45):
        add(Cue(tm, "boat_knock", "rowing boat rocking: wooden knock + water slap on the hull", (lambda r=rr(): (_hull_knock(r), 0.0)), -15, p=0.1, send=0.2,
                group="boat_knock"))
    add(Cue(W["leans"] - 0.05, "lean_creak", "everyone leans over one side: thwart creak + boat dips", lambda: (G.creak(0.55, rng(397), 120, 200, G.WOOD, rough=0.15) * 0.8, 0.0),
            -10, p=-0.2, send=0.2))
    add(Cue(W["tips"] - 0.02, "tip_splash", "'now it tips': the low gunwale ships water - slap + splash + 'whoa!'s",
            lambda: (_tip(rng(431)), 0.0), -2, p=-0.25, send=0.2))
    add(Cue(W["tips"] + 0.72, "hat_plop", "top hat lands in the water: plop + bubbles", lambda: (_plop(rng(432)), 0.0), -12, p=-0.35, send=0.2))

    # ------------------------------------------------ callback (edge) + the new bridge
    add(Cue(W["twelve2"] + 0.1, "edge_groan", "loaded edge again: slow chain groan under the crowd", lambda: (G.chain_groan(3.0, rng(440), 0.4, 0.8, 16, 24, beats=[0.3, 1.35, 2.4], t0=0.0), 0.0),
            -12, p=-0.3, send=0.2))
    add(Cue(W["twelve2"], "edge_murmur", "nervous murmur on the loaded edge", lambda: (_murmur(3.2, rng(441), 20) * 0.7, 0.0), -16, lpf=3600, send=0.3))
    add(Cue(W["stronger"] - 0.15, "opening_cheer", "1887: the new bridge opens - hurrahs, applause swell", lambda: (_cheer(3.2, rng(492), 26), 0.0), -8, lpf=5000, send=0.35))
    add(Cue(W["stronger"] + 0.3, "opening_steps", "the first crowd strolls onto the new bridge", lambda: (_steps(3.0, rng(493), 30) * 0.7, 0.0), -15, send=0.2))

    # ------------------------------------------------ today: strollers, the closed road end, the crack
    add(Cue(W["today"] - 0.05, "today_steps", "today: people strolling across, out of step", lambda: (_steps(3.6, rng(529), 22) * 0.8, 0.0), -15, send=0.2))
    add(Cue(W["today"] + 0.2, "today_murmur", "today: light chatter on the footways", lambda: (_murmur(3.4, rng(530), 10), 0.0), -18, lpf=3600, send=0.3))
    add(Cue(W["closed"] + 0.6, "bike_bell", "a bicycle bell at the barrier (the road is shut, the footway is not)", lambda: (_bell(rng(542)), 0.0), -14, p=0.35, send=0.25))
    add(Cue(W["cracks"], "crack", "'Cracks.': sharp masonry crack + grit trickle (on the kick)", lambda: (_crack(rng(565)), 0.0), -2, p=-0.1, send=0.2))

    # ------------------------------------------------ camera-move / transition whooshes
    for f, desc in [(115, "cut up to the chain"), (335, "cut down to the crews"), (474, "drop to deck level"), (618, "cut onto the deck for the rush"),
                    (702, "cut to the end-on wide"), (840, "push to the owners"), (949, "closer, end-on"), (1235, "closer on the boat"),
                    (1620, "cut to the barrier"), (1731, "crane out, ending")]:
        add(Cue(T.fr(f), "whoosh_cam", f"camera {desc}", (lambda r=rr(): (G.whoosh(0.6, r, 0.09, 330, 2000, 0.8, 0.18, 0.15), 0.09)), -13, send=0.12))
    for f, desc in [(878, "crossfade to golden light"), (1148, "crossfade to the rowing boat"), (1319, "crossfade back to the loaded edge"),
                    (1420, "crossfade to the empty piers"), (1478, "dissolve: the new bridge on the same piers"), (1585, "crossfade to today")]:
        add(Cue(T.fr(f), "whoosh_xfade", desc, (lambda r=rr(): (G.whoosh(0.8, r, 0.32, 300, 1600, 0.9, 0.22, 0.1), 0.32)), -13, send=0.15))
    add(Cue(fl, "flash_whoosh", "reverse swell into the white flash (frame 175) + soft low whoomp", lambda: _flash(rng(175)), -5, send=0.2))
    return C


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


def _boat_cam_dist(shot, t, tau, k):
    """rough lens -> boat distance (m) from the story.ts framings"""
    x = T.boat_x(tau, k)
    z = T.BOATS[k][0]
    cams = {1: (-23, 2.1, -12.5), 4: (17, 1.6, -13), 5: (-6.4, 9.8, 2.5), 6: (30, 4.2, 14)}
    if shot == 2:
        c = (17, 13, -52) if t < 11.2 else (x + 11, 1.7, -15.5)
    elif shot == 5 and t >= 23.4:
        c = (-5.5, 8.6, -46)
    elif shot == 4 and t >= 20.6:
        c = (2.3, 7.8, -14.5)
    else:
        c = cams[shot]
    return math.dist(c, (x, 0.5, z))


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


# ================================================================ render
def render(v_ref, on_event=None):
    """v_ref = integrated loudness of the voice stem (stereo). Returns (stereo stem, cue list with measured levels)."""
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        x = pan(x, c.p) if x.ndim == 1 else x
        if c.cut is not None:
            k = ns(c.cut - (c.t - anchor))
            if 0 < k < x.shape[1]:
                x = fades(x[:, :k], 0.0, 0.02)
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
        if on_event:
            on_event(c, x, t0)
        if c.send > 0:
            G._place_mono(send, c.send * x.mean(0), t0)
    valley = make_ir(1.1, 77, pre=0.01, hf=1.6, early=[(0.09, 0.45, -0.5), (0.14, 0.3, 0.6), (0.23, 0.2, -0.2)])
    out += 0.55 * convolve_st(send, valley)
    out = hp(out, 25, 2)
    end = ns(T.DUR - 0.12)
    out[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 2
    return out, C
