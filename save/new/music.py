# Original score for "The Bridge Everyone Leaned On": a jaunty regatta-day brass band in Bb major, 120 bpm, built with
# the bridge template's instruments (instruments.py) and band helpers (oom-pah, snare patterns, rolls, melody voices).
# Sections follow the picture: hook tutti that droops on "not thrilled" | button on the white flash | story march as the
# deck fills (band thickens footpaths -> road -> gaps) | race drive when the boats appear, crescendo on the rush |
# DEAD STOP on "The chains creak" | sway: timpani + low brass wobbling at the deck's 0.95 Hz | relief button on
# "Luckily" | silence for the deadpan, tuba "wah-wah" after "watching too" | golden explanation pad + vibes | rocking
# 6/8 music-box for the rowing boat, cut by the tip | low pad for the callback | soft march -> 1887 fanfare |
# lazy swung "today" version | DEAD STOP before "Cracks.", two deadpan low notes after it.
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp
import instruments as I
import timeline as T

N = ns(T.DUR)
Q = 0.5
W = T.W

# theme (bar, beat, quarters, midi): an original regatta tune
THEME = [
    (1, 0, .5, 77), (1, .5, .5, 82), (1, 1, 1, 86), (1, 2, .75, 84), (1, 2.75, .25, 82), (1, 3, 1, 81),
    (2, 0, 1.5, 82), (2, 1.5, .5, 77), (2, 2, 1, 79), (2, 3, 1, 81),
    (3, 0, .5, 82), (3, .5, .5, 84), (3, 1, 1, 86), (3, 2, .5, 87), (3, 2.5, .5, 86), (3, 3, 1, 84),
    (4, 0, 2, 81), (4, 2, .5, 77), (4, 2.5, .5, 79), (4, 3, 1, 81),
    (5, 0, .5, 77), (5, .5, .5, 82), (5, 1, 1, 86), (5, 2, .75, 89), (5, 2.75, .25, 87), (5, 3, 1, 86),
    (6, 0, .5, 87), (6, .5, .5, 86), (6, 1, .5, 84), (6, 1.5, .5, 82), (6, 2, 1, 84), (6, 3, 1, 79),
    (7, 0, .75, 81), (7, .75, .25, 82), (7, 1, 1, 84), (7, 2, .5, 86), (7, 2.5, .5, 84), (7, 3, 1, 81),
    (8, 0, 1, 82), (8, 1, .5, 77), (8, 1.5, .5, 74), (8, 2, 2, 70),
]
CHB = {1: ["Bb"] * 4, 2: ["Bb", "Bb", "F", "F"], 3: ["Eb", "Eb", "Bb", "Bb"], 4: ["F", "F", "F7", "F7"],
       5: ["Bb"] * 4, 6: ["Eb", "Eb", "Cm", "Cm"], 7: ["F", "F", "F7", "F7"], 8: ["Bb"] * 4}
CH = {
    "Bb": dict(oom=(34, 41), pah=[53, 58, 62], hi=[58, 62, 65]),
    "F": dict(oom=(41, 36), pah=[53, 57, 60], hi=[57, 60, 65]),
    "F7": dict(oom=(41, 36), pah=[51, 57, 60], hi=[57, 60, 63]),
    "Cm": dict(oom=(36, 43), pah=[55, 60, 63], hi=[60, 63, 67]),
    "Eb": dict(oom=(39, 46), pah=[55, 58, 63], hi=[58, 63, 67]),
    "Gm": dict(oom=(43, 38), pah=[55, 58, 62], hi=[58, 62, 67]),
    "F#o7": dict(oom=(42, 42), pah=[54, 57, 60, 63], hi=[57, 60, 63]),
}
F = I.m2f

SECTIONS = [
    ("hook", 0.0, T.FLASH), ("story", T.FLASH, 18.0), ("race", 18.0, 22.5), ("sway", 22.5, 25.2), ("relief", 25.2, 27.0),
    ("deadpan", 27.0, 29.2), ("explain", 29.2, 38.2), ("rowboat", 38.2, 43.9), ("callback", 43.9, 47.3), ("rebuild", 47.3, 52.8),
    ("today", 52.8, 56.45), ("end", 56.45, T.DUR),
]
SILENT = ("deadpan",)


def theme(t_bar1, bars=range(1, 9), transpose=0, swing=False, late=0.0):
    ev = []
    for (b, beat, d, m) in THEME:
        if b not in bars:
            continue
        bb = beat
        if swing:
            fl = np.floor(beat); fr_ = beat - fl
            bb = fl + (2 / 3 if fr_ in (0.5, 0.75) else (1 / 3 if fr_ == 0.25 else fr_))
        ev.append((t_bar1 + (b - bars[0]) * 4 * Q + bb * Q + late, d * Q, m + transpose))
    return sorted(ev)


class Band:
    def __init__(self):
        self.tr, self.send, self.cues = {}, {}, []

    def track(self, name, send):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N)); self.send[name] = send
        return self.tr[name]

    def add(self, name, x, t, p=0.0, g=1.0, send=0.15):
        if t < 0 or t >= T.DUR:
            return
        place(self.track(name, send), pan(x, p) if np.ndim(x) == 1 else x, t, g)


R = rng(1870)


def _r():
    return rng(int(R.integers(1 << 30)))


def oompah(b, t_bar, chords, vel=0.6, every=True, pah_vel=0.4, bounce=False):
    for beat in range(4):
        c = CH[chords[beat]]
        t = t_bar + beat * Q
        if bounce:
            lo = c["oom"][0] if c["oom"][0] >= 36 else c["oom"][0] + 12
            b.add("tuba", I.brass(F(lo), 0.2, vel, _r(), "tuba", scoop=-30), t, -0.1)
            b.add("tuba", I.brass(F(lo + 12), 0.16, vel * 0.85, _r(), "tuba", scoop=-45), t + Q / 2, -0.1)
        elif every or beat in (0, 2):
            m = c["oom"][beat % 2]
            b.add("tuba", I.brass(F(m), 0.3, vel * (1.0 if beat in (0, 2) else 0.88), _r(), "tuba"), t, -0.1)
        if every:
            for k, m in enumerate(c["pah"]):
                b.add("pah", I.brass(F(m), 0.15, pah_vel, _r(), "horn", scoop=-12), t + Q / 2 + 0.004 * k, 0.32 - 0.12 * k)
        elif beat in (1, 3):
            for k, m in enumerate(c["pah"]):
                b.add("pah", I.brass(F(m), 0.17, pah_vel, _r(), "horn", scoop=-12), t + 0.004 * k, 0.32 - 0.12 * k)


SN = {"light": [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1], "march": [3, 0, 1, 1, 2, 0, 1, 0, 3, 0, 1, 1, 2, 0, 1, 0],
      "drive": [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1]}


def snare_bar(b, t_bar, pat, vel, steps=range(16), cres=0.0):
    for s in steps:
        v = SN[pat][s]
        if not v:
            continue
        t = t_bar + s * Q / 4
        vv = vel * (1 + cres * s / 16) * {1: 0.5, 2: 0.9, 3: 0.95}[v] * R.uniform(0.93, 1.05)
        if v == 3:
            b.add("snare", I.snare(vv * 0.4, _r()), t - 0.026, 0.05)
        b.add("snare", I.snare(vv, _r()), t + R.normal(0, 0.002), 0.05)


def roll(b, t0, t1, v0, v1, accent=None, at=None):
    for t, v in I.snare_roll(t0, t1, v0, v1, _r()):
        b.add("snare", I.snare(v, _r(), dur=0.14, buzz=True), t, 0.05)
    if accent:
        at = t1 if at is None else at
        b.add("snare", I.snare(accent, _r()), at, 0.05)


def melody(b, name, notes, vel, transpose=0, fn="glock", p=0.0, gate=0.9):
    for (t, d, m) in notes:
        m = m + transpose
        if fn == "glock":
            x = I.glock(F(m), vel * R.uniform(0.92, 1.05), _r())
        elif fn == "fife":
            x = I.fife(F(m), d * gate, vel * R.uniform(0.94, 1.04), _r())
        elif fn == "vibes":
            x = I.vibes(F(m), vel * R.uniform(0.92, 1.05), _r(), dur=max(1.2, d + 0.8), damp=d + 0.35)
        elif fn == "musicbox":
            x = I.musicbox(F(m), vel * R.uniform(0.92, 1.05), _r())
        elif fn == "cornet":
            x = I.brass(F(m), d * gate, vel * R.uniform(0.94, 1.04), _r(), "horn", scoop=-10)
        b.add(name, x, t, p)


def stop_at(b, t, keep=(), fade=0.012):
    m = np.ones(N)
    a = ns(t)
    m[a:a + ns(fade)] = np.linspace(1, 0, ns(fade))
    m[a + ns(fade):] = 0
    for k in b.tr:
        if k not in keep:
            b.tr[k] *= m[None, :]


def build():
    b = Band()
    for name, send in [("fife", 0.16), ("glock", 0.22), ("cornet", 0.16), ("tuba", 0.10), ("pah", 0.18), ("snare", 0.13), ("cymbal", 0.16),
                       ("stab", 0.16), ("timpani", 0.18), ("pad", 0.25), ("vibes", 0.26), ("musicbox", 0.26), ("pluck", 0.18), ("brush", 0.12),
                       ("triangle", 0.25)]:
        b.track(name, send)

    # ============ HOOK 0 - 5.83: tutti theme bars 1-2, the band droops under "not thrilled", button on the flash
    h = theme(0.0, bars=[1, 2])
    melody(b, "fife", h, 0.6, 0, "fife", 0.25)
    melody(b, "glock", h, 0.45, 12, "glock", -0.35)
    for bar in (1, 2):
        oompah(b, (bar - 1) * 2.0, CHB[bar], 0.66, True, 0.42)
        snare_bar(b, (bar - 1) * 2.0, "march", 0.6, steps=range(16) if bar == 1 else range(12))
    b.add("cymbal", I.cymbal(0.45, _r()), 0.0, 0.0)
    for k, m in enumerate([46, 45, 44, 43, 41]):          # tuba droops chromatically under "The bridge was not thrilled"
        b.add("tuba", I.brass(F(m), 0.42, 0.6, _r(), "tuba", fall=-60 if k == 4 else 0.0), 4.0 + k * 0.36, -0.1)
    b.add("timpani", I.timpani(F(41), 0.35, _r(), dur=1.6), 4.7, -0.1)
    b.cues.append((0.0, "hook: regatta theme bars 1-2 tutti (fife, glock, tuba/after-beats, snare)"))
    b.cues.append((4.0, "the band droops: tuba sinks chromatically under 'The bridge was not thrilled about it.'"))
    cut = np.ones(N); a, z = ns(T.FLASH - 0.03), ns(T.FLASH + 0.015); cut[a:z] = np.linspace(1, 0, z - a); cut[z:] = 0
    for k in b.tr:
        b.tr[k] *= cut[None, :]
    for m in [46, 53, 58, 62, 65]:
        b.add("stab", I.brass(F(m), 0.2, 0.75, _r(), "stab", scoop=-15), T.FLASH, (m - 56) / 20)
    b.add("cymbal", I.cymbal(0.4, _r(), dur=1.2), T.FLASH, 0.0)
    b.cues.append((T.FLASH, "Bb button + clash exactly on the white flash (frame 175)"))

    # ============ STORY 6.25 - 18: theme on glock + fife, the band thickens as the deck fills
    s0 = 6.25
    roll(b, 5.95, 6.24, 0.15, 0.4, accent=0.45, at=s0)
    a14 = theme(s0, bars=[1, 2, 3, 4])
    melody(b, "glock", a14, 0.36, 12, "glock", -0.35)
    melody(b, "fife", a14, 0.42, 0, "fife", 0.25)
    for bar in range(1, 5):
        tb = s0 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.48, False, 0.32)
        snare_bar(b, tb, "light", 0.34)
    b.cues.append((s0, "story: theme bars 1-4, light (glock + fife, tuba on 1/3, horns on 2/4)"))
    s1 = s0 + 8.0    # 14.25: bars 5-6 fuller as the footpaths fill, bar 7 on "Then the road", bar 8 = "every last gap"
    a58 = theme(s1, bars=[5, 6])
    melody(b, "glock", a58, 0.48, 12, "glock", -0.35)
    melody(b, "cornet", a58, 0.5, 0, "cornet", 0.15)
    b.add("cymbal", I.cymbal(0.35, _r()), s1, 0.0)
    for bar in (5, 6):
        tb = s1 + (bar - 5) * 2
        oompah(b, tb, CHB[bar], 0.62, True, 0.42)
        snare_bar(b, tb, "march", 0.55)
    oompah(b, 18.25 - 2.0, ["Eb", "Eb", "F7", "F7"], 0.62, True, 0.44)  # 16.25: turnaround on "every last gap"
    snare_bar(b, 16.25, "march", 0.58)
    b.cues.append((s1, "full band, theme bars 5-6 with cornet as the footpaths fill; Eb-F7 turnaround on 'every last gap'"))

    # ============ RACE 18.25 - 22.5: drive (bouncing tuba, snare drive), crescendo on the rush, DEAD STOP at 22.5
    r0 = 18.25
    rc = theme(r0, bars=[1, 2], transpose=0)
    melody(b, "cornet", rc, 0.58, 0, "cornet", 0.15)
    melody(b, "glock", rc, 0.5, 12, "glock", -0.35)
    b.add("cymbal", I.cymbal(0.45, _r()), r0, 0.0)
    for bar in (1, 2):
        tb = r0 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.7, True, 0.48, bounce=True)
        snare_bar(b, tb, "drive", 0.55 + 0.05 * bar, cres=0.3)
    roll(b, 22.25, 22.5, 0.5, 0.9)
    b.cues.append((r0, "race: theme on cornet, bouncing tuba octaves, snare drive (boats appear 18.13, rush 20.8)"))
    stop_at(b, 22.5)
    b.cues.append((22.5, "DEAD STOP on 'The chains creak' - only the chains are heard"))

    # ============ SWAY 23.4 - 25.2: timpani + low brass wobbling at the deck's sway (0.95 Hz)
    for k in range(4):
        tm = 23.45 + k / 0.95 * 0.5
        b.add("timpani", I.timpani(F(36 if k % 2 else 34), 0.45 + 0.08 * k, _r(), dur=1.0), tm, -0.1)
        b.add("tuba", I.brass(F(34 if k % 2 else 35), 0.45, 0.4, _r(), "soft", scoop=-30), tm, -0.1)
    b.add("pad", I.pad([F(m) for m in [42, 54, 57, 60]], 1.9, 0.4, _r(), att=0.3, rel=0.4), 23.4, 0.0)
    b.cues.append((23.45, "sway: timpani + low brass wobbling with the deck, dim7 pad"))

    # ============ RELIEF 25.25: warm Bb button + short tutti tag, out by 26.9
    for m in [46, 53, 58, 62, 65, 70]:
        b.add("stab", I.brass(F(m), 0.5, 0.55, _r(), "horn", scoop=-10), W["luckily"] - 0.02, (m - 56) / 22)
    b.add("cymbal", I.cymbal(0.3, _r(), dur=1.4), W["luckily"] - 0.02, 0.0)
    tag = [(25.75, .25, 77), (26.0, .25, 82), (26.25, .5, 86)]
    melody(b, "glock", tag, 0.45, 12, "glock", -0.35)
    b.add("tuba", I.brass(F(34), 0.4, 0.55, _r(), "tuba"), 26.25, -0.1)
    b.cues.append((W["luckily"], "relief: warm Bb chord + glock tag on 'Luckily, the bridge held.'"))

    # ============ DEADPAN: silence through "Unluckily, the owners were watching too.", then a tuba wah-wah
    for k, (m, d) in enumerate([(41, 0.28), (40, 0.28), (39, 0.28), (38, 0.7)]):
        b.add("tuba", I.brass(F(m), d, 0.62, _r(), "tuba", scoop=-25, fall=-80 if k == 3 else 0.0), 28.68 + k * 0.3, -0.1)
    b.cues.append((28.68, "silence for the deadpan, then a tuba 'wah-wah-wah-waaah' after 'watching too.'"))

    # ============ EXPLAIN 29.4 - 38.1 (golden): warm pad, vibes pendulum; tilts on "pushed down" / "lifts"
    ex = [(29.4, 31.7, [46, 58, 62, 65]), (31.7, 34.3, [39, 58, 63, 67]), (34.3, 36.0, [41, 57, 60, 65]), (36.0, 38.15, [43, 58, 62, 67])]
    for (ta, tb_, ms) in ex:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.5, _r(), att=0.5 if ta < 29.5 else 0.3, rel=0.5), ta, 0.0)
        b.add("tuba", I.brass(F(ms[0] - 12 if ms[0] > 40 else ms[0]), tb_ - ta - 0.05, 0.28, _r(), "soft", scoop=-8), ta + 0.05, -0.1)
    for k, m in enumerate([86, 82, 86, 82, 87, 82, 87, 84]):
        b.add("vibes", I.vibes(F(m), 0.42, _r(), dur=1.4, damp=0.7, trem_depth=0.12), 29.5 + k * 1.0, -0.25 if k % 2 else 0.25)
    b.add("tuba", I.brass(F(41), 0.9, 0.5, _r(), "tuba", fall=-300), W["pushed"], -0.1)        # "pushed down": slide down
    for j, m in enumerate([89, 94, 98]):                                                       # "lifts": glock up
        b.add("glock", I.glock(F(m), 0.4 + 0.06 * j, _r()), W["lifts"] + 0.1 * j, 0.3)
    b.cues.append((29.4, "golden explanation: warm pad Bb - Eb - F - Gm, vibes pendulum"))
    b.cues.append((W["pushed"], "tuba slides down on 'pushed down', glock run up on 'lifts'"))

    # ============ ROWBOAT 38.3 - 43.1: rocking 6/8 music box + pizzicato, cut on "tips" with a timpani + cymbal splash
    beat = 0.32
    rb = [(38.3 + k * beat * 3, ch) for k, ch in enumerate(["Bb", "Bb", "Eb", "Bb", "F", "F", "Bb", "F7", "Bb", "F7", "Bb", "Bb", "F7", "F7", "F7"])]
    tune = [82, 86, 89, 87, 86, 84, 82, 81, 82, 84, 86, 89, 91, 93, 94]
    for k, (tb_, ch) in enumerate(rb):
        if tb_ >= W["tips"] - 0.05:
            break
        b.add("pluck", I.pluck(F(CH[ch]["oom"][0] + 12), 0.75, _r(), dur=0.8), tb_, -0.05)
        for j in (1, 2):
            for mm in CH[ch]["hi"][1:]:
                b.add("pluck", I.pluck(F(mm), 0.35, _r(), dur=0.45, bright=0.6), tb_ + j * beat, 0.25)
        b.add("musicbox", I.musicbox(F(tune[k]), 0.6, _r()), tb_, 0.2)
        if k % 2:
            b.add("musicbox", I.musicbox(F(tune[k] - 3), 0.45, _r()), tb_ + 2 * beat, 0.2)
    stop_at(b, W["tips"] - 0.02, keep=())
    b.add("timpani", I.timpani(F(34), 0.8, _r(), dur=2.0), W["tips"], -0.1)
    b.add("cymbal", I.cymbal(0.5, _r(), dur=2.0), W["tips"], 0.0)
    b.cues.append((38.3, "rowing boat: rocking 6/8 music box + pizzicato, the tune climbs as they lean"))
    b.cues.append((W["tips"], "cut on 'tips': timpani + cymbal splash"))

    # ============ CALLBACK 44 - 47.2: low suspended pad + slow timpani
    b.add("pad", I.pad([F(m) for m in [41, 53, 57, 60, 63]], 3.3, 0.45, _r(), att=0.6, rel=0.6), 44.0, 0.0)
    for k in range(3):
        b.add("timpani", I.timpani(F(41), 0.3, _r(), dur=1.2), 44.3 + k * 1.05, -0.1)
    b.cues.append((44.0, "callback: low F7sus pad, slow timpani"))

    # ============ REBUILD 47.5 - 52.8: soft march (bars 1-2), 1887 fanfare on "a stronger one opened", full bars 3-4
    rb0 = 47.5
    m12 = theme(rb0, bars=[1, 2])
    melody(b, "glock", m12, 0.32, 12, "glock", -0.35)
    melody(b, "fife", m12, 0.38, 0, "fife", 0.25)
    for bar in (1,):
        oompah(b, rb0, CHB[1], 0.45, False, 0.3)
        snare_bar(b, rb0, "light", 0.3)
    fan = W["stronger"] + 0.15
    for m in [46, 53, 58, 62, 65, 70]:
        b.add("stab", I.brass(F(m), 0.35, 0.7, _r(), "stab", scoop=-12), fan, (m - 56) / 22)
    b.add("cymbal", I.cymbal(0.5, _r()), fan, 0.0)
    b.add("timpani", I.timpani(F(34), 0.6, _r()), fan, -0.1)
    m34 = theme(49.5, bars=[3, 4])
    melody(b, "cornet", [n for n in m34 if n[0] >= fan + 0.2], 0.55, 0, "cornet", 0.15)
    melody(b, "glock", [n for n in m34 if n[0] >= fan + 0.2], 0.45, 12, "glock", -0.35)
    for bar in (3, 4):
        tb = 49.5 + (bar - 3) * 2
        oompah(b, tb, CHB[bar], 0.6, True, 0.42)
        snare_bar(b, tb, "march", 0.5, steps=range(16) if bar == 3 else range(12))
    b.cues.append((rb0, "rebuild: soft march"))
    b.cues.append((fan, "1887 fanfare (Bb stab + cymbal + timpani) on 'a stronger one opened', full band bars 3-4"))

    # ============ TODAY 53.0 - 56.45: lazy swung version (vibes, walking pizz bass, brushes), DEAD STOP before "Cracks."
    tn = theme(53.0, bars=[1, 2], swing=True, late=0.025)
    melody(b, "vibes", tn, 0.6, 0, "vibes", -0.25)
    walk = [46, 50, 53, 50, 41, 45, 46, 48]
    for k, m in enumerate(walk):
        b.add("pluck", I.pluck(F(m), 0.85, _r(), dur=0.9), 53.0 + k * Q, -0.05)
    for k in range(7):
        t = 53.0 + k * Q
        b.add("brush", I.brush(0.55 if k % 2 else 0.35, _r(), dur=0.42, swish=True), t - 0.05, 0.1)
        b.add("brush", I.brush(0.35, _r()), t + Q * 2 / 3, 0.15)
    for (t, c) in [(53.5, "Bb"), (54.5, "Bb"), (55.5, "F")]:
        for mm in CH[c]["hi"]:
            b.add("vibes", I.vibes(F(mm), 0.22, _r(), dur=0.9, damp=0.3, trem_depth=0.2), t + 0.02, 0.3)
    b.cues.append((53.0, "today: relaxed swung version, vibes melody, walking pizzicato bass, brushes"))
    stop_at(b, 56.42)
    b.cues.append((56.42, "DEAD STOP just before 'Cracks.'"))

    # ============ END: two deadpan low notes after the crack, then the river takes over
    b.add("pluck", I.pluck(F(41), 0.9, _r(), dur=0.9), 57.35, -0.05)
    b.add("pluck", I.pluck(F(34), 0.95, _r(), dur=1.6), 57.85, -0.05)
    b.add("tuba", I.brass(F(34), 0.9, 0.45, _r(), "soft", scoop=-20), 57.85, -0.1)
    b.add("triangle", I.triangle(0.2, _r(), dur=1.0), 57.85, 0.3)
    b.cues.append((57.35, "two deadpan low notes (F, Bb) after the crack; rings out under the crane"))
    end = np.ones(N); a = ns(59.4); end[a:] = np.linspace(1, 0, N - a) ** 1.5
    for k in b.tr:
        b.tr[k] *= end[None, :]
    return b


TARGET = {
    "fife": -3.0, "glock": -6.0, "cornet": -2.0, "tuba": -2.5, "pah": -7.5, "snare": -5.5, "cymbal": -11.0,
    "stab": -3.0, "timpani": -5.0, "pad": -3.5, "vibes": -2.0, "musicbox": -1.5, "pluck": -4.0, "brush": -13.0, "triangle": -15.0,
}


def render(b, ref=-20.0):
    hall = make_ir(1.5, 7, pre=0.018, hf=1.4)
    dry = np.zeros((2, N))
    wet = np.zeros((2, N))
    levels = {}
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -6) - L)
        levels[k] = (round(L, 1), round(ref + TARGET.get(k, -6), 1))
        x = x * g
        b.tr[k] = x
        dry += x
        wet += b.send[k] * x
    out = dry + 0.7 * convolve_st(wet.mean(0), hall)
    out = hp(out, 30, 2)
    return out, levels
