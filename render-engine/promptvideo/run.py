# Prompt Studio → finished video worker: claims queued prompt_videos and produces each one end to end.
#  1. character reference sheet (OpenAI image API, from the project's sheet prompt)
#  2. one first-frame image per clip, drawn with the sheet attached so the characters stay the same (image edits)
#  3. each image is animated by xAI Grok Imagine with the clip's Grok prompt (dialogue, shots, sound), in parallel
#  4. montage: clips butted together, silences longer than 0.2 s at the joins cut, 0.5 s kept after the last word
#  5. the video goes to the customer's library (and the cover, when the project has one, next to it); any failure refunds
# Keys: the image and video keys are read from the `prompt-videos` Edge Function (worker_keys, RENDER_WORKER_TOKEN),
# so they live only in the Edge Function secrets. Other secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import base64, json, os, re, shutil, subprocess, tempfile, time, traceback, urllib.error, urllib.parse, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER = os.environ.get("MODAL_TASK_ID", "pv-" + uuid.uuid4().hex[:6])
W, H, FPS = 1080, 1920, 30
MAX_BYTES = 45 * 1024 * 1024   # Supabase storage refuses uploads above 50 MB
IMG_W, IMG_H = 1024, 1536          # the OpenAI portrait size; cropped to 9:16 (864x1536) before animation
GAP_KEEP, END_KEEP = 0.1, 0.5      # silence kept at each join / after the very last word
VIDEO_TIMEOUT = 25 * 60            # one Grok clip may take this long at most
OPENAI = "https://api.openai.com/v1"
XAI = "https://api.x.ai/v1"


class UserError(Exception):
    pass


def log(job, *a):
    print(f"[pv {job[:8]}]", *a, flush=True)


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
        raise RuntimeError(f"{method} {url.split('?')[0]} -> {e.code}: {e.read()[:600].decode(errors='replace')}")


def retry(fn, tries=3, wait=8):
    for k in range(tries):
        try:
            return fn()
        except Exception as e:  # network hiccups and 429/5xx: try again a little later
            msg = str(e)
            if k == tries - 1 or re.search(r"-> 4(00|01|03|04|22)\b", msg): raise
            time.sleep(wait * (k + 1))


def sb(method, path, body=None, prefer=None, raw=False, headers=None, timeout=120):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", **(headers or {})}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{SB}{path}", body, h, raw=raw, timeout=timeout)


def setjob(jid, **fields):
    sb("PATCH", f"/rest/v1/prompt_videos?id=eq.{jid}", fields, prefer="return=minimal")


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def upload(bucket, path, data, mime):
    sb("POST", f"/storage/v1/object/{bucket}/{path}", data, headers={"Content-Type": mime, "x-upsert": "true"}, timeout=600)


def signed(bucket, path, seconds=3 * 3600):
    out = sb("POST", f"/storage/v1/object/sign/{bucket}/{path}", {"expiresIn": seconds})
    return SB + "/storage/v1" + out["signedURL"]


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def keys():
    out = http("POST", f"{SB}/functions/v1/prompt-videos", {"action": "worker_keys"},
               {"Authorization": f"Bearer {os.environ['RENDER_WORKER_TOKEN']}", "apikey": KEY}, timeout=30)
    if not out.get("openai") or not out.get("xai"): raise RuntimeError("image or video key missing in the Edge Function secrets")
    return out["openai"], out["xai"]


# ---------------------------------------------------------------- images (OpenAI)
def multipart(fields, files):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, (name, data, mime) in files:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def draw(okey, plan, prompt, ref=None):
    """one portrait PNG; with `ref` (the sheet PNG) the characters are drawn from that reference"""
    def call():
        if ref is None:
            out = http("POST", f"{OPENAI}/images/generations", {"model": plan["image_model"], "prompt": prompt, "size": f"{IMG_W}x{IMG_H}",
                                                               "quality": plan["image_quality"], "n": 1, "moderation": "low"},
                       {"Authorization": f"Bearer {okey}"}, timeout=360)
        else:
            body, ctype = multipart({"model": plan["image_model"], "prompt": prompt, "size": f"{IMG_W}x{IMG_H}", "quality": plan["image_quality"], "n": "1", "moderation": "low"},
                                    [("image[]", ("sheet.png", ref, "image/png"))])
            out = http("POST", f"{OPENAI}/images/edits", body, {"Authorization": f"Bearer {okey}", "Content-Type": ctype}, timeout=360)
        return base64.b64decode(out["data"][0]["b64_json"])
    # the output-stage safety check is partly random (the same prompt can pass on a second try): 3 attempts
    for attempt in range(3):
        try:
            return retry(call)
        except RuntimeError as e:
            if "moderation" not in str(e).lower() and "safety" not in str(e).lower():
                raise
            if attempt == 2:
                raise UserError("Une image a été refusée par le filtre de sécurité. Modifiez la scène concernée puis relancez.")
            time.sleep(3)


def to_916(png, dst):
    """center-crop the 2:3 portrait to 9:16 (what Grok animates and what the final video is)"""
    src = dst + ".src.png"
    open(src, "wb").write(png)
    run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "crop=trunc(ih*9/16/2)*2:ih", dst)
    return open(dst, "rb").read()


# ---------------------------------------------------------------- animation (xAI Grok Imagine)
def animate(xkey, plan, clip, image_url, dst, label):
    body = {"model": plan["video_model"], "prompt": clip["grok_prompt"], "image": {"url": image_url},
            "duration": int(clip["seconds"]), "resolution": plan["resolution"], "aspect_ratio": "9:16"}
    hdr = {"Authorization": f"Bearer {xkey}"}
    sub = retry(lambda: http("POST", f"{XAI}/videos/generations", body, hdr, timeout=120))
    rid = sub.get("request_id") or sub.get("id")
    if not rid: raise RuntimeError(f"no request id from the video API: {json.dumps(sub)[:300]}")
    t0 = time.time()
    while True:
        time.sleep(6)
        st = retry(lambda: http("GET", f"{XAI}/videos/{rid}", None, hdr, timeout=60))
        status = (st.get("status") or "").lower()
        url = (st.get("video") or {}).get("url") or st.get("url")
        if url and status in ("", "done", "completed", "succeeded"):
            open(dst, "wb").write(retry(lambda: http("GET", url, None, None, timeout=300, raw=True)))
            return
        if status in ("failed", "expired", "error", "cancelled"):
            reason = json.dumps(st)[:400]
            if re.search(r"moderat|safety|policy", reason, re.I):
                raise UserError(f"Le clip {label} a été refusé par le filtre de sécurité de l’animation. Modifiez-le puis relancez.")
            raise RuntimeError(f"clip {label} {status}: {reason}")
        if time.time() - t0 > VIDEO_TIMEOUT: raise RuntimeError(f"clip {label} still not ready after {VIDEO_TIMEOUT // 60} min")


# ---------------------------------------------------------------- montage
def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]).strip())


def has_audio(path):
    return bool(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path]).strip())


def speech_bounds(path, dur):
    """first and last moment with sound (silence = below -38 dB for 0.2 s or more)"""
    if not has_audio(path): return 0.0, dur
    err = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", "silencedetect=noise=-38dB:d=0.2", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    first = ends[0] if starts and starts[0] <= 0.05 and ends else 0.0
    last = dur
    if starts and (len(ends) < len(starts) or ends[-1] >= dur - 0.05): last = starts[-1]
    if last - first < 0.5: return 0.0, dur
    return first, last


def montage(clips, out, tmp):
    parts = []
    for i, src in enumerate(clips):
        dur = duration(src)
        a, b = speech_bounds(src, dur)
        start = max(0.0, a - GAP_KEEP) if i > 0 else 0.0                   # the hook keeps its very first frame
        end = min(dur, b + (END_KEEP if i == len(clips) - 1 else GAP_KEEP))
        part = os.path.join(tmp, f"part{i}.mp4")
        audio = [] if has_audio(src) else ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
        amap = "0:a:0" if not audio else "1:a:0"   # Grok clips also carry a cover picture: take the first video stream only
        run("ffmpeg", "-v", "error", "-y", "-i", src, *audio, "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1",
            "-map", "0:v:0", "-map", amap, "-af", "aresample=48000", "-ac", "2",
            # bitrate cap keeps a ~80 s film well under the 50 MB storage upload limit
            "-c:v", "libx264", "-crf", "20", "-maxrate", "3500k", "-bufsize", "7000k", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", part)
        parts.append(part)
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out)
    if os.path.getsize(out) > MAX_BYTES:   # safety net: re-encode to a size that fits
        kbps = max(800, int(MAX_BYTES * 8 / 1000 / max(1.0, duration(out))) - 200)
        big = out + ".big.mp4"
        os.replace(out, big)
        run("ffmpeg", "-v", "error", "-y", "-i", big, "-c:v", "libx264", "-b:v", f"{kbps}k", "-maxrate", f"{kbps}k",
            "-bufsize", f"{kbps * 2}k", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", out)


# ---------------------------------------------------------------- one job
def produce(job):
    jid, uid, plan = job["id"], job["user_id"], job["plan"]
    tmp = tempfile.mkdtemp(prefix="pv-")
    base = f"{uid}/pv/{jid}"
    t0 = time.time()

    def step(name, pct):
        setjob(jid, step=name, progress=pct)
        log(jid, name, pct)

    try:
        if job.get("attempts", 1) > 1:
            raise UserError("La génération a été interrompue. Vos crédits ont été rendus : relancez la vidéo.")
        okey, xkey = keys()
        n = len(plan["clips"])

        step("sheet", 5)
        sheet = draw(okey, plan, plan["sheet_prompt"])
        upload("renders", f"{base}/sheet.png", sheet, "image/png")

        step("images", 10)
        done = [0]

        def frame(i):
            png = to_916(draw(okey, plan, plan["clips"][i]["image_prompt"], ref=sheet), os.path.join(tmp, f"img{i}.png"))
            upload("renders", f"{base}/img{i}.png", png, "image/png")
            done[0] += 1
            setjob(jid, progress=10 + round(25 * done[0] / n))
            return signed("renders", f"{base}/img{i}.png")

        with ThreadPoolExecutor(4) as ex:
            urls = list(ex.map(frame, range(n)))
        cover = None
        if plan.get("cover_prompt"):
            try:
                cover = draw(okey, plan, plan["cover_prompt"], ref=sheet)
                upload("renders", f"{base}/cover.png", cover, "image/png")
            except Exception as e:  # the cover is a bonus: never fail the video for it
                log(jid, "cover skipped", e); cover = None

        step("animation", 36)
        done[0] = 0
        files = [os.path.join(tmp, f"clip{i}.mp4") for i in range(n)]

        def clip(i):
            animate(xkey, plan, plan["clips"][i], urls[i], files[i], i + 1)
            upload("renders", f"{base}/clip{i}.mp4", open(files[i], "rb").read(), "video/mp4")
            done[0] += 1
            setjob(jid, progress=36 + round(50 * done[0] / n))

        with ThreadPoolExecutor(min(n, 9)) as ex:
            list(ex.map(clip, range(n)))

        step("montage", 88)
        out = os.path.join(tmp, "final.mp4")
        montage(files, out, tmp)

        step("library", 96)
        aid = str(uuid.uuid4()); path = f"{uid}/{aid}.mp4"; data = open(out, "rb").read()
        upload("library", path, data, "video/mp4")
        sb("POST", "/rest/v1/media_assets", {"id": aid, "user_id": uid, "title": (plan.get("title") or "Vidéo Prompt Studio")[:200],
                                             "notes": "Créée avec le Prompt Studio Storyit", "tags": ["prompt-studio", plan["quality"]],
                                             "storage_path": path, "mime": "video/mp4", "size_bytes": len(data),
                                             "duration_seconds": round(duration(out), 2), "width": W, "height": H, "status": "available"},
           prefer="return=minimal")
        setjob(jid, status="done", step="done", progress=100, video_path=path, asset_id=aid,
               cover_path=f"{base}/cover.png" if cover else None, finished_at=now())
        log(jid, f"done in {(time.time() - t0) / 60:.1f} min")
    except Exception as e:
        detail = (traceback.format_exc() + (getattr(e, "stderr", b"") or b"").decode(errors="replace")[-1500:])[-4000:]
        log(jid, "FAILED", detail)
        msg = str(e) if isinstance(e, UserError) else "La vidéo n'a pas pu être créée. Vos crédits ont été rendus."
        setjob(jid, status="failed", error=msg, error_detail=detail, finished_at=now())
        if job.get("credits_charged", 0) > 0:
            try:
                sb("POST", "/rest/v1/rpc/grant_credits", {"p_user_id": uid, "p_amount": job["credits_charged"], "p_type": "refund",
                                                         "p_description": "Vidéo Prompt Studio — remboursement (non produite)"})
                setjob(jid, credits_charged=0)
            except Exception as e2:
                log(jid, "REFUND FAILED", e2)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    while True:
        job = sb("POST", "/rest/v1/rpc/claim_prompt_video", {"p_worker": WORKER})
        if not job or not job.get("id"): break
        produce(job)


if __name__ == "__main__":
    main()
