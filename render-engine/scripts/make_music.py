# Original background tracks for the Creative Studio wizard (royalty-free: synthesized here, nothing sampled).
# Usage: python render-engine/scripts/make_music.py <out_dir>   -> <out_dir>/<id>.mp3 (64 s each, loopable)
# The ids must match MUSIC_TRACKS in supabase/functions/_shared/promptVideo.ts; files are served from public/music.
import os
import subprocess
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio"))
from dsp import SR, ns, rng, lp, hp, write_wav  # noqa: E402
import instruments as I  # noqa: E402

LEN = 64.0
TAU = 2 * np.pi


def buf():
    return np.zeros((2, ns(LEN) + SR * 4))


def put(b, x, t, g=1.0, pan=0.0):
    x = np.asarray(x)
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.vstack([x * l * 1.41, x * r * 1.41])
    i = ns(t)
    n = min(x.shape[1], b.shape[1] - i)
    if n > 0: b[:, i:i + n] += x[:, :n] * g


def kick(f0=55, dur=0.45, punch=1.0):
    t = np.arange(ns(dur)) / SR
    f = f0 + 90 * np.exp(-t / 0.035) * punch
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / (dur / 3.5))


def bass808(f, dur=0.9):
    t = np.arange(ns(dur)) / SR
    y = np.sin(TAU * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.03))) / SR) * np.exp(-t / (dur / 2.2))
    return np.tanh(2.2 * y) * 0.8


def hat(r, dur=0.06, open_=False):
    d = 0.32 if open_ else dur
    t = np.arange(ns(d)) / SR
    return hp(r.standard_normal(len(t)), 7000) * np.exp(-t / (d / 4)) * 0.5


def cowbell(f=560, dur=0.25):
    t = np.arange(ns(dur)) / SR
    y = (np.sign(np.sin(TAU * f * t)) + np.sign(np.sin(TAU * f * 1.48 * t))) * np.exp(-t / 0.06)
    return lp(y, 3000) * 0.25


def chord_pad(b, chords, beat, r, vel=0.35, warm=900):
    bar = beat * 4
    t, k = 0.0, 0
    while t < LEN:
        put(b, I.pad([I.m2f(m) for m in chords[k % len(chords)]], bar * 0.98, vel=vel, r=r, att=0.25, rel=0.6, warm=warm), t)
        t += bar; k += 1


def master(b, path):
    x = b[:, :ns(LEN)]
    x = np.tanh(1.3 * x / (np.abs(x).max() + 1e-9)) * 0.89
    fade = ns(0.03)
    x[:, :fade] *= np.linspace(0, 1, fade); x[:, -fade:] *= np.linspace(1, 0, fade)
    wav = path + ".wav"
    write_wav(wav, x)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "2", "-ar", "44100", "-b:a", "128k", path], check=True)
    os.remove(wav)


def phonk(r):  # 130 bpm, dark minor, 808 + cowbell melody
    b, beat = buf(), 60 / 130
    chord_pad(b, [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 48, 52]], beat, r, vel=0.18, warm=700)
    bell = [74, 72, 70, 69, 70, 72, 69, 65]
    for i in range(int(LEN / beat)):
        t = i * beat
        if i % 4 in (0, 3) or (i % 8 == 6): put(b, kick(48, 0.5), t, 0.9)
        if i % 4 == 2: put(b, I.snare(0.6, r, tune=1.1), t, 0.5)
        put(b, hat(r), t + beat / 2, 0.25, 0.3)
        if i % 2 == 0: put(b, bass808(I.m2f([38, 34, 36, 33][(i // 16) % 4])), t, 0.55)
        put(b, cowbell(I.m2f(bell[i % 8])), t, 0.35, -0.2)
    return b


def suspense(r):  # slow pulse, low strings, ticking
    b, beat = buf(), 60 / 90
    chord_pad(b, [[38, 45, 50], [38, 44, 50], [37, 44, 49], [38, 45, 51]], beat, r, vel=0.3, warm=500)
    for i in range(int(LEN / beat)):
        t = i * beat
        if i % 2 == 0: put(b, kick(42, 0.7, 0.4), t, 0.6)
        put(b, hat(r, 0.03), t, 0.12, 0.5)
        if i % 8 == 7: put(b, I.timpani(I.m2f(38), 0.5, r), t, 0.4)
        if i % 4 == 1: put(b, I.pluck(I.m2f([62, 63, 61, 62][(i // 4) % 4]), 0.4, r, bright=0.2), t, 0.25, 0.4)
    return b


def drame(r):  # emotional piano-like plucks over warm pads
    b, beat = buf(), 60 / 76
    chords = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]]
    chord_pad(b, chords, beat, r, vel=0.3, warm=1100)
    mel = [76, 74, 72, 71, 72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 74, 72]
    for i in range(int(LEN / beat)):
        t = i * beat
        ch = chords[(i // 4) % 4]
        for k, m in enumerate(ch[1:]): put(b, I.pluck(I.m2f(m + 12), 0.25, r, dur=1.6, bright=0.3), t + k * beat / 3, 0.25, -0.3 + 0.3 * k)
        if i % 2 == 0: put(b, I.pluck(I.m2f(mel[(i // 2) % 16]), 0.55, r, dur=2.0, bright=0.45), t, 0.4, 0.1)
    return b


def comique(r):  # bouncy pizzicato and tuba
    b, beat = buf(), 60 / 118
    prog = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]]
    mel = [72, 74, 76, 72, 77, 76, 74, 71, 72, 79, 77, 76, 74, 76, 72, 0]
    for i in range(int(LEN / beat)):
        t = i * beat
        ch = prog[(i // 4) % 4]
        put(b, I.brass(I.m2f(ch[0] - 12 if i % 2 == 0 else ch[2] - 24), beat * 0.6, 0.6, r), t, 0.35)
        put(b, I.pluck(I.m2f(ch[1] + 12), 0.4, r, dur=0.4), t + beat / 2, 0.3, 0.4)
        m = mel[i % 16]
        if m: put(b, I.pluck(I.m2f(m), 0.6, r, dur=0.5, bright=0.7), t, 0.4, -0.2)
        if i % 4 == 3: put(b, I.glock(I.m2f(84), 0.4, r), t + beat / 2, 0.2)
        put(b, I.brush(0.4, r), t + beat / 2, 0.3)
    return b


def epique(r):  # big drums, brass stabs, low pads
    b, beat = buf(), 60 / 100
    chord_pad(b, [[38, 45, 50, 57], [34, 41, 46, 53], [36, 43, 48, 55], [33, 40, 45, 52]], beat, r, vel=0.35, warm=800)
    for i in range(int(LEN / beat)):
        t = i * beat
        put(b, I.timpani(I.m2f(38 if i % 4 < 2 else 33), 0.7, r), t, 0.5)
        if i % 2 == 1: put(b, I.snare(0.7, r, tune=0.8), t, 0.35)
        if i % 8 == 0: put(b, I.cymbal(0.5, r), t, 0.25)
        if i % 4 == 0: put(b, I.brass(I.m2f([62, 58, 60, 57][(i // 4) % 4]), beat * 1.6, 0.7, r, kind="horn"), t, 0.35)
    return b


def lofi(r):  # mellow jazzy chords, soft kick and swing hats
    b, beat = buf(), 60 / 82
    chords = [[50, 53, 57, 60, 64], [43, 47, 50, 53, 57], [48, 52, 55, 59, 62], [45, 48, 52, 55, 59]]
    chord_pad(b, chords, beat, r, vel=0.25, warm=650)
    for i in range(int(LEN / beat)):
        t = i * beat
        if i % 4 in (0, 2) and not (i % 8 == 2): put(b, kick(50, 0.4, 0.5), t, 0.55)
        if i % 4 in (1, 3): put(b, I.brush(0.5, r, swish=True), t, 0.45)
        put(b, hat(r, 0.04), t + beat * 0.62, 0.15, 0.4)
        if i % 2 == 0: put(b, I.vibes(I.m2f(chords[(i // 4) % 4][3] + 12 + [0, 2, 3, 5][(i // 2) % 4]), 0.35, r), t, 0.25, -0.3)
    crackle = lp(rng(9).standard_normal(b.shape[1]) * (rng(10).random(b.shape[1]) > 0.9993), 4000) * 0.4
    b += crackle[None, :]
    return b


TRACKS = {"phonk-nuit": phonk, "suspense": suspense, "drame": drame, "comique": comique, "epique": epique, "lofi": lofi}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    only = sys.argv[2:] or list(TRACKS)
    for k in only:
        master(TRACKS[k](rng(abs(hash(k)) % 10_000)), os.path.join(out, f"{k}.mp3"))
        print("ok", k, flush=True)
