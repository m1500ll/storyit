# Video translation worker: claims queued dub_jobs and produces each one end to end.
#  1. download the customer's upload, normalise it to 1080x1920 / 30 fps
#  2. separate the voice from the music and effects (Demucs htdemucs, two stems)
#  3. transcribe the voice with word timings (ElevenLabs Scribe)
#  4. translate sentence by sentence so each one fits its original time slot (Claude), shorten what does not fit
#  5. record the new voice sentence by sentence (ElevenLabs), place each at its original start (speed-up <= 15 %)
#  6. mix: original music and effects (ducked a little under the new voice) + the new voice at the old voice level
#  7. optional: erase burned-in captions (white letters with a dark outline) and add translated one-word captions
#  8. add the result to the customer's library; any failure refunds the credits
# Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE.
import base64, json, math, os, re, shutil, subprocess, sys, tempfile, time, traceback, urllib.error, urllib.parse, urllib.request, uuid
from multiprocessing import Pool

import numpy as np
import soundfile as sf

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER = os.environ.get("MODAL_TASK_ID", "dub-" + uuid.uuid4().hex[:6])
MODEL = os.environ.get("DUB_MODEL", "claude-sonnet-5-5")
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # render-engine/
SR = 44100
W, H, FPS = 1080, 1920, 30
LANG_NAMES = {"fr": "French", "en": "English", "es": "Spanish", "de": "German", "it": "Italian", "pt": "Portuguese"}
CPS = 14.5  # characters per second a narrator speaks comfortably (budget for each translated sentence)


def log(job, *a):
    print(f"[dub {job[:8]}]", *a, flush=True)


def http(method, url, body=None, headers=None, timeout=120, raw=False):
    data = None
    h = dict(headers or {})
    if body is not None and not isinstance(body, (bytes, bytearray)):
        data = json.dumps(body).encode(); h.setdefault("Content-Type", "application/json")
    elif body is not None:
        data = body
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = r.read()
            return out if raw else (json.loads(out) if out else None)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url.split('?')[0]} -> {e.code}: {e.read()[:300].decode(errors='replace')}")


def sb(method, path, body=None, prefer=None, raw=False):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{SB}{path}", body, h, raw=raw)


def setjob(jid, **fields):
    sb("PATCH", f"/rest/v1/dub_jobs?id=eq.{jid}", fields, prefer="return=minimal")


def run(*cmd, cwd=None):
    subprocess.run(cmd, check=True, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def probe(path):
    out = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path]))
    v = next((s for s in out["streams"] if s.get("codec_type") == "video"), {})
    a = any(s.get("codec_type") == "audio" for s in out["streams"])
    return float(out["format"]["duration"]), int(v.get("width", 0)), int(v.get("height", 0)), a


def load(path, ch=1, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", path] + (["-filter:a", af] if af else []) + ["-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.check_output(cmd), np.float32).reshape(-1, ch)


# ---------------------------------------------------------------- speech
def eleven(path, body=None, files=None, raw=False, timeout=300):
    key = os.environ["ELEVENLABS_API_KEY"]
    if files:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in (body or {}).items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for k, (name, data, ctype) in files.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        return http("POST", f"https://api.elevenlabs.io{path}", b"".join(parts), {"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={boundary}"}, timeout, raw)
    return http("POST", f"https://api.elevenlabs.io{path}", body, {"xi-api-key": key}, timeout, raw)


def transcribe(vocals_mp3):
    with open(vocals_mp3, "rb") as f: data = f.read()
    r = eleven("/v1/speech-to-text", {"model_id": "scribe_v1", "timestamps_granularity": "word", "diarize": "false", "tag_audio_events": "false"},
               files={"file": ("voice.mp3", data, "audio/mpeg")})
    words = [w for w in r.get("words", []) if w.get("type") == "word"]
    segs, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?…]$", w["text"]) or (len(cur) >= 28 and re.search(r"[,;:]$", w["text"])): segs.append(cur); cur = []
    if cur: segs.append(cur)
    out = []
    for i, s in enumerate(segs):
        nxt = segs[i + 1][0]["start"] if i + 1 < len(segs) else s[-1]["end"] + 1.2
        out.append({"i": i, "start": s[0]["start"], "end": s[-1]["end"], "slot": max(0.6, nxt - s[0]["start"]), "src": " ".join(w["text"] for w in s)})
    return r.get("language_code", ""), out


def tts(text, voice, lang):
    body = {"text": text, "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5"), "language_code": lang,
            "voice_settings": {"stability": 0.4, "similarity_boost": 0.75, "style": 0.5, "use_speaker_boost": True}}
    r = eleven(f"/v1/text-to-speech/{urllib.parse.quote(voice)}/with-timestamps?output_format=mp3_44100_128", body)
    return base64.b64decode(r["audio_base64"]), r["alignment"]


# ---------------------------------------------------------------- translation
def claude(prompt, max_tokens=8000):
    r = http("POST", "https://api.anthropic.com/v1/messages", {"model": MODEL, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
             {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"}, timeout=300)
    text = "".join(b.get("text", "") for b in r["content"] if b.get("type") == "text")
    m = re.search(r"\[[\s\S]*\]", text)
    if not m: raise RuntimeError("translation: no JSON array in the reply")
    return json.loads(m.group(0))


def translate(segs, lang, short_ids=None, prev=None):
    target = LANG_NAMES[lang]
    rows = [{"i": s["i"], "seconds": round(s["slot"], 2), "max_chars": int(s["slot"] * CPS * (0.8 if short_ids else 1.0)), "text": s["src"]}
            for s in segs if short_ids is None or s["i"] in short_ids]
    ask = ("Shorten these translations so each fits max_chars (they were too long to say in time). Keep the meaning and the tone.\n"
           f"Previous translations: {json.dumps({i: prev[i] for i in short_ids}, ensure_ascii=False)}\n") if short_ids else ""
    prompt = (f"You dub a short vertical video into {target}. Translate each sentence so it can be SPOKEN in the same time as the original: "
              f"stay under max_chars, keep the storyteller's tone, rhythm and punctuation (pauses), keep names and numbers, write numbers the way a "
              f"narrator says them, natural spoken {target}, no notes. Sentences continue each other: keep a sentence that was cut in two cut the same way.\n"
              f"{ask}Reply with only a JSON array of objects {{\"i\": number, \"text\": string}}, same i values.\n\n{json.dumps(rows, ensure_ascii=False)}")
    out = claude(prompt)
    return {int(o["i"]): str(o["text"]).strip() for o in out if "i" in o and "text" in o}


# ---------------------------------------------------------------- captions (erase burned-in text)
def _erase_chunk(args):
    import cv2
    src, dst, start, dur = args
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)); k9 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    k25 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)); k41 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    bands = [(int(H * 0.45), int(H * 0.86), False), (int(H * 0.08), int(H * 0.45), True)]
    k15 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)); k101 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (161, 161))
    f = 0
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        title_time = start + f / FPS < 5.0                             # hook titles sit at the top during the first seconds
        for y0, y1, top in bands:
            part = img[y0:y1]
            b, g, r = [part[:, :, i].astype(np.int16) for i in range(3)]
            white = ((b > 205) & (g > 205) & (r > 205) & (np.abs(r - b) < 30)).astype(np.uint8)
            dark = ((b < 70) & (g < 60) & (r < 75)).astype(np.uint8)
            m = white & cv2.dilate(dark, k41)                          # white fill that touches an ink outline = letters
            if top and title_time:                                     # title styles: yellow marker / kicker, dark letters on it
                yl = ((r > 190) & (g > 150) & (b < 110)).astype(np.uint8)
                near = cv2.dilate(yl, k101) if yl.any() else yl          # the title's white words sit around the marker
                m = m | yl | (dark & cv2.dilate(yl, k15)) | (white & near)
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k3)
            if not m.any(): continue
            m = m | (dark & cv2.dilate(m, k25))                       # and their outline
            m = cv2.dilate(m, k9) * 255
            img[y0:y1] = cv2.inpaint(part, m, 5, cv2.INPAINT_TELEA)
        enc.stdin.write(img.tobytes()); f += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    return dst


def erase_captions(src, dst, dur, tmp):
    n = max(1, min(16, os.cpu_count() or 4))
    step = dur / n
    parts = [(src, os.path.join(tmp, f"er{k:02d}.mp4"), k * step, step + (1.0 / FPS if k < n - 1 else 5)) for k in range(n)]
    with Pool(n) as p: outs = p.map(_erase_chunk, parts)
    lst = os.path.join(tmp, "er.txt")
    with open(lst, "w") as f: f.writelines(f"file '{o}'\n" for o in outs)
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", dst)


# ---------------------------------------------------------------- one job
def produce(job):
    jid, uid, lang = job["id"], job["user_id"], job["target_language"]
    tmp = tempfile.mkdtemp(prefix="dub-")
    t0 = time.time()
    try:
        step = lambda s, p: setjob(jid, step=s, progress=p)
        step("download", 5)
        raw = sb("GET", f"/storage/v1/object/library/{urllib.parse.quote(job['source_path'])}", raw=True)
        src = os.path.join(tmp, "src" + os.path.splitext(job["source_path"])[1]); open(src, "wb").write(raw)
        dur, w, h, has_audio = probe(src)
        if not has_audio: raise UserError("La vidéo n'a pas de son : il n'y a rien à traduire.")
        if dur > float(job["seconds"]) * 1.1 + 2: raise UserError("La vidéo est plus longue que la durée payée.")
        # vertical 1080x1920, 30 fps: fill the frame (crop what is outside)
        norm = os.path.join(tmp, "norm.mp4")
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}",
            "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", "-an", norm)
        wav = os.path.join(tmp, "src.wav")
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-ac", "2", "-ar", str(SR), wav)

        step("separate", 15)
        run(sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", os.path.join(tmp, "sep"), wav)
        vocals = os.path.join(tmp, "sep", "htdemucs", "src", "vocals.wav")
        music_p = os.path.join(tmp, "sep", "htdemucs", "src", "no_vocals.wav")
        vmp3 = os.path.join(tmp, "vocals.mp3"); run("ffmpeg", "-v", "error", "-y", "-i", vocals, "-b:a", "128k", vmp3)

        step("transcribe", 30)
        src_lang, segs = transcribe(vmp3)
        if not segs: raise UserError("Aucune voix n'a été détectée dans la vidéo.")
        log(jid, f"{len(segs)} sentences ({src_lang}) -> {lang}")

        step("translate", 40)
        tr = translate(segs, lang)
        missing = [s["i"] for s in segs if not tr.get(s["i"])]
        if missing: tr.update(translate([s for s in segs if s["i"] in missing], lang))

        step("voice", 50)
        voice = job.get("voice_id") or os.environ["ELEVENLABS_DEFAULT_VOICE"]
        audio = {}
        def record(ids):
            for s in segs:
                if s["i"] not in ids: continue
                mp3, al = tts(tr[s["i"]], voice, lang)
                p = os.path.join(tmp, f"seg{s['i']:03d}.mp3"); open(p, "wb").write(mp3)
                audio[s["i"]] = (p, al, probe(p)[0])
        record({s["i"] for s in segs})
        long_ = [s["i"] for s in segs if audio[s["i"]][2] > s["slot"] * 1.12]
        if long_:  # one round: shorter wording for what cannot be said in time
            tr.update(translate([s for s in segs if s["i"] in long_], lang, short_ids=long_, prev=tr))
            record(set(long_))

        step("mix", 65)
        music, _ = sf.read(music_p, dtype="float32"); vocal_src, _ = sf.read(vocals, dtype="float32")
        n = len(music)
        v = np.zeros(n + SR * 5, np.float32); words, prev_end = [], 0.0
        for li, s in enumerate(segs):
            p, al, d = audio[s["i"]]
            tempo = min(1.15, d / max(0.3, s["slot"] - 0.05)) if d > s["slot"] - 0.05 else 1.0
            seg = load(p, 1, f"atempo={tempo:.3f}" if tempo > 1.001 else None)[:, 0]
            start = max(s["start"], prev_end + 0.06); i0 = int(start * SR)
            v[i0:i0 + len(seg)] += seg[:len(v) - i0]; prev_end = start + len(seg) / SR
            cur = None
            for k, c in enumerate(al["characters"]):
                if re.match(r"[\w'’-]", c):
                    a_, b_ = start + al["character_start_times_seconds"][k] / tempo, start + al["character_end_times_seconds"][k] / tempo
                    cur = {"word": c, "start": a_, "end": b_, "line": li} if cur is None else {**cur, "word": cur["word"] + c, "end": b_}
                elif cur: words.append(cur); cur = None
            if cur: words.append(cur)
        total = max(n / SR, prev_end + 0.3)
        v = v[:int(total * SR)]
        music = np.pad(music, ((0, max(0, len(v) - len(music))), (0, 0)))[:len(v)]
        rms = lambda x: float(np.sqrt(np.mean(x[np.abs(x) > 1e-3] ** 2))) if np.any(np.abs(x) > 1e-3) else 1e-3
        v *= rms(vocal_src.mean(1) if vocal_src.ndim > 1 else vocal_src) / rms(v)
        env = np.convolve(np.abs(v), np.ones(int(SR * 0.15)) / (SR * 0.15), "same")
        duck = 1 - (1 - 10 ** (-6 / 20)) * np.clip(env / (np.percentile(env[env > 1e-4], 50) + 1e-9), 0, 1)
        mix = music * duck[:, None] + np.stack([v, v], 1)
        mix /= max(1.0, float(np.abs(mix).max()) / 0.95)
        mixp = os.path.join(tmp, "mix.wav"); sf.write(mixp, mix, SR)

        out = os.path.join(tmp, "out.mp4")
        if job.get("replace_captions", True):
            step("captions", 75)
            erased = os.path.join(tmp, "erased.mp4"); erase_captions(norm, erased, dur, tmp)
            props = os.path.join(tmp, "props.json")
            json.dump({"spec": {"version": 1, "title": job.get("title") or "", "language": lang, "script": [tr[s["i"]] for s in segs], "duration": round(total, 2)},
                       "words": words}, open(props, "w"), ensure_ascii=False)
            seq = os.path.join(tmp, "seq")
            subprocess.run(["npx", "remotion", "render", "src/index.ts", "TextLayer", seq, "--sequence", "--image-format=png", f"--props={props}",
                            f"--concurrency={min(8, os.cpu_count() or 4)}", "--log=error"], cwd=APP, check=True)
            first = sorted(os.listdir(seq))[0]
            digits = len(re.search(r"(\d+)\.png$", first).group(1))
            pat = os.path.join(seq, re.sub(r"\d+\.png$", f"%0{digits}d.png", first))
            step("encode", 90)
            run("ffmpeg", "-v", "error", "-y", "-i", erased, "-framerate", str(FPS), "-i", pat, "-i", mixp, "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass[v]",
                "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out)
        else:
            step("encode", 90)
            run("ffmpeg", "-v", "error", "-y", "-i", norm, "-i", mixp, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out)

        step("library", 96)
        aid = str(uuid.uuid4()); path = f"{uid}/{aid}.mp4"; data = open(out, "rb").read()
        http("POST", f"{SB}/storage/v1/object/library/{path}", data, {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "video/mp4"}, timeout=600)
        title = f"{(job.get('title') or 'Vidéo traduite')[:180]} ({lang.upper()})"
        sb("POST", "/rest/v1/media_assets", {"id": aid, "user_id": uid, "title": title, "notes": "Traduite avec Storyit", "tags": ["translated", lang],
              "storage_path": path, "mime": "video/mp4", "size_bytes": len(data), "duration_seconds": round(probe(out)[0], 2), "width": W, "height": H, "status": "available"},
           prefer="return=minimal")
        setjob(jid, status="done", step="done", progress=100, video_path=path, finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        log(jid, f"done in {(time.time() - t0) / 60:.1f} min")
    except Exception as e:
        detail = (traceback.format_exc() + (getattr(e, "stderr", b"") or b"").decode(errors="replace")[-1500:])[-4000:]
        log(jid, "FAILED", detail)
        msg = str(e) if isinstance(e, UserError) else "La traduction n'a pas pu être faite."
        setjob(jid, status="failed", error=msg, error_detail=detail, finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        if job.get("credits_charged", 0) > 0:
            try:
                sb("POST", "/rest/v1/rpc/grant_credits", {"p_user_id": uid, "p_amount": job["credits_charged"], "p_type": "refund",
                                                         "p_description": "Traduction vidéo — remboursement (non produite)"})
                setjob(jid, credits_charged=0)
            except Exception as e2:
                log(jid, "REFUND FAILED", e2)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class UserError(Exception):
    pass


def main():
    while True:
        job = sb("POST", "/rest/v1/rpc/claim_dub_job", {"p_worker": WORKER})
        if not job or not job.get("id"): break
        produce(job)


if __name__ == "__main__":
    main()
