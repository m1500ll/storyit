# The whole soundtrack of one VideoSpec, synthesized: ambience beds per shot light, camera whooshes, the spec's sound
# cues and effects, an original score arranged on the narration (mood, dead stops, buttons), and the final mix
# (voice gain only, music ducked under speech and kept well below the voice, SFX at the template's -6 dB event rule,
# -15 LUFS integrated, <= -1 dBTP). Usage: python spec_audio.py <timeline.json> <voice.wav> <out_dir>
# timeline.json is written by worker/timeline.ts from the spec + word timings (all times in seconds).
import json
import os
import sys
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, pan, st, place, fades, widen, make_ir, convolve_st, colored, smooth_noise,
                 integrated, momentary_max, true_peak, read_wav, write_wav, modal)
import sfx_gen as G
import instruments as I
import sfx_kit as K

TL = json.load(open(sys.argv[1]))
VOICE, OUT = sys.argv[2], sys.argv[3]
DUR = float(TL["duration"])
N = ns(DUR)
R = rng(int(TL.get("seed", 1870)))
rr = lambda: rng(int(R.integers(1 << 30)))
F = I.m2f
TARGET_LUFS, CEIL = -15.0, -1.2
MUSIC_LU = float(TL.get("music", {}).get("level", -17.0))  # music vs voice (owner feedback: keep it low)
SFX_DB = -6.0


def lufs(x):
    v = integrated(x)
    return v if np.isfinite(v) else -99.0


# ================================================================ voice
v, sr = read_wav(VOICE)
assert sr == SR, sr
v = v[0] if v.shape[0] == 1 else v.mean(0)
voice = np.zeros(N)
voice[: min(N, len(v))] = v[:N]
voice = st(voice)
V_REF = lufs(voice)
words = TL["words"]


def speech_env(depth=-3.0, pre=0.08, post=0.12, att=0.07, rel=0.45):
    ctrl = 1000
    nc = int(DUR * ctrl) + 2
    va = np.zeros(nc)
    for w in words:
        va[max(0, int((w["start"] - pre) * ctrl)): int((w["end"] + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env, e = np.zeros(nc), 0.0
    for i in range(nc):
        tgt = va[i]
        e += (tgt - e) * (ka if tgt > e else kr)
        env[i] = e
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)


# ================================================================ sfx
sfx = np.zeros((2, N))
send = np.zeros(N)


def put(x, t, naive, kind="event", p=0.0, lpf=None, rev=0.15, anchor=0.0):
    """place a generated sound at t (s): events at naive-6 LU vs the voice (max momentary), beds at naive (integrated)"""
    x = np.asarray(x, float)
    x = pan(x, p) if x.ndim == 1 else x
    cur = momentary_max(x) if kind == "event" else integrated(x)
    tgt = V_REF + naive + (SFX_DB if kind == "event" else 0.0)
    if np.isfinite(cur):
        x = x * dbg(tgt - cur)
    if lpf:
        x = lp(x, lpf, 1)
    t0 = max(0.0, t - anchor)
    place(sfx, x, t0)
    if rev > 0:
        G._place_mono(send, rev * x.mean(0), t0)


def amb_day(dur, r, river):
    n = ns(dur)
    x = G.breeze(dur, r, 1.0, 0.15, 850)
    if river:
        x += st(bp(colored(n, r, 0.8), 180, 1800, 1) * 0.55 * (0.8 + 0.2 * smooth_noise(n, r, 0.3)))
    x += pan(G.bird_chirps(dur, r, 0.45, "sparrow") * 0.08, 0.5)
    x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.05, -0.6)
    x += pan(G.flag_flutter(dur, r) * 0.2, 0.3)
    return x


def whistle(r, blasts=(0.35,)):
    """a referee's pea whistle: a ~2.9 kHz tone trilled by the pea (25-35 Hz), one short blast per entry"""
    out = []
    for d in blasts:
        n = ns(d); t = np.arange(n) / SR
        f0 = 2850 + 120 * r.random()
        trill = 0.55 + 0.45 * np.sin(2 * np.pi * (27 + 8 * r.random()) * t)
        x = np.sin(2 * np.pi * f0 * t + 0.8 * np.sin(2 * np.pi * 30 * t)) * trill + 0.15 * np.sin(4 * np.pi * f0 * t)
        x *= np.minimum(1, t / 0.012) * np.minimum(1, (d - t) / 0.04)
        out += [x, np.zeros(ns(0.12))]
    return st(np.concatenate(out) * 0.5)


def kick(r):
    """a boot on a ball: a short low thump (~85 Hz falling) with a leather click on top"""
    d = 0.25; n = ns(d); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (85 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 22)
    click = bp(colored(n, r, 0.0), 1800, 5000, 1) * np.exp(-t * 180) * 0.6
    return st(body + click)


def amb_stadium(dur, r):
    """a full stadium: a wide crowd bed with slow swells, a few distant chants and horns"""
    x = K._murmur(dur, r, 40) * 0.9
    n = ns(dur)
    swell = 0.75 + 0.25 * smooth_noise(n, r, 0.15)
    x = x * swell
    x += st(bp(colored(n, r, 1.0), 200, 1400, 1) * 0.25)
    return x


shots = TL["shots"]
for i, s in enumerate(shots):
    a, b = s["start"], s["end"]
    if b - a < 0.3:
        continue
    fin = max(0.05, s.get("xfade", 0) / 30 / 2)
    if TL.get("stadium"):
        bed = amb_stadium(b - a + 0.4, rr())
    else:
        bed = K._golden(b - a + 0.4, rr()) if s["light"] == "golden" else amb_day(b - a + 0.4, rr(), TL.get("river", True))
    put(fades(bed, fin, 0.35), a - fin, -29, kind="bed", rev=0.0)
    if s.get("crowd", 0) >= 10:  # a visible crowd murmurs under the shot
        put(K._murmur(b - a, rr(), min(28, s["crowd"] // 4 + 6)), a, -16, kind="bed", lpf=3600, rev=0.3)
    for t in s.get("cuts", []):
        put(G.whoosh(0.6, rr(), 0.09, 330, 2000, 0.8, 0.18, 0.15), t, -13, anchor=0.09, rev=0.12)
    if s.get("xfade") and i > 0:
        put(G.whoosh(0.8, rr(), 0.32, 300, 1600, 0.9, 0.22, 0.1), a, -13, anchor=0.32, rev=0.15)
    if "eights" in s.get("show", []):  # oar catches every stroke while the crews are on screen
        t = a + 0.3
        while t < b - 0.2:
            put(K._oar_catch(rr()), t, -16, p=-0.2, rev=0.15)
            t += 1 / 0.6

if TL.get("flash") is not None:
    y, anchor = K._flash(rr())
    put(y, TL["flash"], -5, anchor=anchor, rev=0.2)


def gen_cue(kind, dur, r):
    if kind == "cheer": return K._cheer(max(1.2, dur), r, 24)
    if kind == "murmur": return K._murmur(max(1.0, dur), r, 16)
    if kind == "whoa": return K._whoas(r)
    if kind == "creak": return G.creak(max(0.4, min(dur, 1.4)), r, 50, 90, G.TIMBER, rough=0.2)
    if kind == "chain_groan": return G.chain_groan(max(0.8, dur), r, 0.6, 1.0, 18, 26, beats=[0.1, 0.6], t0=0.0)
    if kind == "splash": return K._tip(r)
    if kind == "crack": return K._crack(r)
    if kind == "steps": return K._steps(max(0.8, dur), r, 20)
    if kind == "bell": return K._bell(r)
    if kind == "knock": return K._hull_knock(r)
    if kind == "whistle": return whistle(r, (0.35,) if (dur or 0) < 1.6 else (0.25, 0.25, 0.7))  # dur >= 1.6: the final whistle
    if kind == "kick": return kick(r)
    return G.whoosh(0.6, r, 0.09, 330, 2000, 0.8, 0.18, 0.15)


LEVEL = {"cheer": -8, "murmur": -14, "whoa": -6, "creak": -6, "chain_groan": -6, "splash": -2, "crack": -2, "steps": -12, "bell": -14, "knock": -15, "whoosh": -13, "whistle": -9, "kick": -8}
for c in TL.get("cues", []):
    put(gen_cue(c["kind"], c.get("dur", 1.5), rr()), c["t"], c.get("level", LEVEL.get(c["kind"], -10)), p=c.get("pan", 0.0), rev=0.2)
for e in TL.get("fx", []):  # effect cards get their sound automatically
    k = {"crack": "crack", "splash": "splash", "creak": "creak", "burst": "knock"}.get(e["kind"])
    if k:
        put(gen_cue(k, 1.2, rr()), e["t"], LEVEL[k] + (2 if k == "creak" else 0), p=-0.2, rev=0.2)

valley = make_ir(1.1, 77, pre=0.01, hf=1.6, early=[(0.09, 0.45, -0.5), (0.14, 0.3, 0.6), (0.23, 0.2, -0.2)])
sfx += 0.55 * convolve_st(send, valley)
sfx = hp(sfx, 25, 2)

# ================================================================ music
Q = 0.5
THEME = [  # the regatta tune from the Hammersmith short (bar, beat, quarters, midi)
    (1, 0, .5, 77), (1, .5, .5, 82), (1, 1, 1, 86), (1, 2, .75, 84), (1, 2.75, .25, 82), (1, 3, 1, 81),
    (2, 0, 1.5, 82), (2, 1.5, .5, 77), (2, 2, 1, 79), (2, 3, 1, 81),
    (3, 0, .5, 82), (3, .5, .5, 84), (3, 1, 1, 86), (3, 2, .5, 87), (3, 2.5, .5, 86), (3, 3, 1, 84),
    (4, 0, 2, 81), (4, 2, .5, 77), (4, 2.5, .5, 79), (4, 3, 1, 81),
]
CHB = {1: ["Bb"] * 4, 2: ["Bb", "Bb", "F", "F"], 3: ["Eb", "Eb", "Bb", "Bb"], 4: ["F", "F", "F7", "F7"]}
CH = {"Bb": dict(oom=(34, 41), pah=[53, 58, 62], hi=[58, 62, 65]), "F": dict(oom=(41, 36), pah=[53, 57, 60], hi=[57, 60, 65]),
      "F7": dict(oom=(41, 36), pah=[51, 57, 60], hi=[57, 60, 63]), "Eb": dict(oom=(39, 46), pah=[55, 58, 63], hi=[58, 63, 67])}
tracks = {}
SEND = {"fife": 0.16, "glock": 0.22, "tuba": 0.10, "pah": 0.18, "snare": 0.13, "cymbal": 0.16, "stab": 0.16, "timpani": 0.18,
        "pad": 0.25, "vibes": 0.26, "pluck": 0.18, "brush": 0.12}
BAL = {"fife": -3.0, "glock": -6.0, "tuba": -2.5, "pah": -7.5, "snare": -5.5, "cymbal": -11.0, "stab": -3.0, "timpani": -5.0,
       "pad": -3.5, "vibes": -2.0, "pluck": -4.0, "brush": -13.0}


def add(name, x, t, p=0.0):
    if t < 0 or t >= DUR:
        return
    if name not in tracks:
        tracks[name] = np.zeros((2, N))
    place(tracks[name], pan(x, p) if np.ndim(x) == 1 else x, t)


def bar(tb, k, style):
    """one bar of the arrangement starting at tb; k = bar index in the tune (0..3)"""
    ch = CHB[k + 1]
    notes = [(tb + beat * Q, d * Q, m) for (b, beat, d, m) in THEME if b == k + 1]
    if style == "march":
        for t, d, m in notes:
            add("fife", I.fife(F(m), d * 0.9, 0.45, rr()), t, 0.25)
            add("glock", I.glock(F(m + 12), 0.35, rr()), t, -0.35)
        for beat in range(4):
            c = CH[ch[beat]]
            add("tuba", I.brass(F(c["oom"][beat % 2]), 0.3, 0.55, rr(), "tuba"), tb + beat * Q, -0.1)
            for j, m in enumerate(c["pah"]):
                add("pah", I.brass(F(m), 0.15, 0.36, rr(), "horn", scoop=-12), tb + beat * Q + Q / 2 + 0.004 * j, 0.3 - 0.12 * j)
            add("snare", I.snare(0.45 if beat % 2 == 0 else 0.3, rr()), tb + beat * Q, 0.05)
    elif style == "comedy":  # lighter: pizzicato bass, vibes melody, brushes
        for t, d, m in notes:
            add("vibes", I.vibes(F(m), 0.5, rr(), dur=max(1.0, d + 0.6), damp=d + 0.3), t, -0.2)
        for beat in range(4):
            c = CH[ch[beat]]
            add("pluck", I.pluck(F(c["oom"][beat % 2] + 12), 0.8, rr(), dur=0.6), tb + beat * Q, -0.05)
            add("brush", I.brush(0.4, rr(), dur=0.35, swish=beat % 2 == 0), tb + beat * Q, 0.1)
    elif style == "warm":
        root = CH[ch[0]]
        add("pad", I.pad([F(m) for m in [root["oom"][0] + 12] + root["hi"]], 4 * Q, 0.45, rr(), att=0.4, rel=0.5), tb, 0.0)
        add("vibes", I.vibes(F(notes[0][2] if notes else 82), 0.4, rr(), dur=1.4, damp=0.7, trem_depth=0.12), tb, 0.2)
        add("vibes", I.vibes(F(notes[-1][2] if notes else 86), 0.35, rr(), dur=1.4, damp=0.7, trem_depth=0.12), tb + 2 * Q, -0.2)
    elif style == "tension":
        add("pad", I.pad([F(m) for m in [42, 54, 57, 60]], 4 * Q, 0.4, rr(), att=0.3, rel=0.4), tb, 0.0)
        for beat in (0, 2):
            add("timpani", I.timpani(F(34 if beat == 0 else 36), 0.4, rr(), dur=1.0), tb + beat * Q, -0.1)


def stab(t, big=False):
    for m in ([46, 53, 58, 62, 65, 70] if big else [46, 53, 58, 62, 65]):
        add("stab", I.brass(F(m), 0.25, 0.7, rr(), "stab", scoop=-14), t, (m - 56) / 22)
    add("cymbal", I.cymbal(0.4, rr(), dur=1.2), t, 0.0)


mood = TL.get("music", {}).get("mood", "regatta_march")
day_style = {"regatta_march": "march", "light_comedy": "comedy", "tension": "tension", "warm": "warm"}[mood]
stops = sorted(TL.get("music", {}).get("stops", []))
buttons = sorted(TL.get("music", {}).get("buttons", []))
flash = TL.get("flash")
last_word = words[-1]["end"] if words else DUR - 2
# segments: the music restarts on bar lines at each shot start after a flash / stop, styled by the shot's light
silent_until = -1.0
t = 0.0
bar_k = 0
shot_light = lambda tt_: next((s["light"] for s in shots if s["start"] <= tt_ < s["end"]), "day")
while t < min(DUR - 1.0, last_word + 0.3):
    if any(sp <= t < sp + 0.01 for sp in stops):
        pass
    nxt_stop = next((sp for sp in stops if sp > t - 1e-6), None)
    if t < silent_until:
        t = next((s["start"] for s in shots if s["start"] >= silent_until), DUR)
        bar_k = 0
        continue
    if nxt_stop is not None and nxt_stop < t + 4 * Q:  # the bar would cross a dead stop: silence until the next shot
        silent_until = nxt_stop + 0.8
        t = nxt_stop
        continue
    bar(t, bar_k % 4, "warm" if shot_light(t) == "golden" else day_style)
    t += 4 * Q
    bar_k += 1
for b_ in buttons:
    stab(b_)
if flash is not None:
    stab(flash, big=True)
# the end: one warm chord after the last word, ringing out
add("pad", I.pad([F(m) for m in [46, 58, 62, 65]], 2.0, 0.5, rr(), att=0.05, rel=1.2), min(DUR - 2.2, last_word + 0.35), 0.0)
add("pluck", I.pluck(F(34), 0.9, rr(), dur=1.6), min(DUR - 2.2, last_word + 0.35), -0.05)

hall = make_ir(1.5, 7, pre=0.018, hf=1.4)
music = np.zeros((2, N))
wet = np.zeros((2, N))
for k, x in tracks.items():
    L = integrated(x)
    if not np.isfinite(L):
        continue
    x = x * dbg(-20 + BAL.get(k, -6) - L)
    music += x
    wet += SEND.get(k, 0.15) * x
music = hp(music + 0.7 * convolve_st(wet.mean(0), hall), 30, 2)
# hard stops: the music is cut exactly on every dead stop
for sp in stops:
    a = ns(sp)
    music[:, a: a + ns(0.012)] *= np.linspace(1, 0, min(ns(0.012), max(0, N - a)))[None, :]
    nxt = next((s["start"] for s in shots if s["start"] >= sp + 0.8), DUR)
    music[:, a + ns(0.012): ns(nxt) - 1] = 0
music = music * dbg(speech_env())[None, :]
Lm = lufs(music)
if Lm > -98:
    music = music * dbg(V_REF + MUSIC_LU - Lm)
end = ns(DUR - 1.5)
music[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 1.5

# ================================================================ master
def limiter(x, ceil_db=CEIL, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    kr = 1 - np.exp(-1 / (rel * SR))
    g2 = np.empty(n)
    g = 1.0
    for k in range(n):  # one-pole release
        g = min(g1[k], g + (1 - g) * kr)
        g2[k] = g
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :]


mix0 = voice + music + sfx
G_ = TARGET_LUFS - lufs(mix0)
for _ in range(5):
    y = limiter(mix0 * dbg(G_))
    L = lufs(y)
    if abs(L - TARGET_LUFS) < 0.05:
        break
    G_ += TARGET_LUFS - L
y = fades(y, 0.0, 0.03)
os.makedirs(OUT, exist_ok=True)
write_wav(os.path.join(OUT, "mix.wav"), y)
report = {"lufs": round(lufs(y), 2), "true_peak": round(true_peak(y), 2), "voice": round(lufs(voice * dbg(G_)), 1),
          "music": round(lufs(music * dbg(G_)), 1), "sfx": round(lufs(sfx * dbg(G_)), 1), "duration": DUR}
json.dump(report, open(os.path.join(OUT, "audio_report.json"), "w"))
print(json.dumps(report))
