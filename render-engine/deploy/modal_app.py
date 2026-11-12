# Storyit render worker on Modal (https://modal.com): pay-per-second machines that start when a short is queued.
# - api /wake: HTTPS endpoint the `animated-studio` Edge Function calls after queueing a job
#   (RENDER_WORKER_URL = https://<workspace>--storyit-render-api.modal.run/wake, RENDER_WORKER_TOKEN as Bearer).
# - poll:  every 5 minutes, in case a wake-up was missed.
# - drain: claims queued shorts one by one and produces them (worker/pipeline.ts).
# - drain_dub: claims queued video translations (dub_jobs) and produces them (dub/dub.py); api /wake-dub starts it.
# - drain_prompt: claims queued Prompt Studio videos (prompt_videos) and produces them (promptvideo/run.py): OpenAI images,
#   xAI Grok Imagine animation, ffmpeg montage; api /wake-prompt starts it. Light machine: the heavy work is done by the APIs.
# Rendering: software WebGL (swangle) on 32 CPU cores by default: proven, ~15-25 min per 60 s short.
# GPU option: deploy with DEPLOY_GPU=1 (needs a payment method on Modal), then set RENDER_MODE=gpu in the secret to
# render on an L4 with ANGLE/EGL (faster; verify one render first).
# Secrets (Modal secret "storyit-render"): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
#   ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE, RENDER_WORKER_TOKEN.
# Deploy:  pip install modal && modal setup && modal deploy render-engine/deploy/modal_app.py
import os
import pathlib
import subprocess

import modal

HERE = pathlib.Path(__file__).resolve().parent.parent  # render-engine/
CHROME_DEPS = ["libnss3", "libdbus-1-3", "libatk1.0-0", "libatk-bridge2.0-0", "libgbm1", "libasound2", "libxrandr2",
               "libxkbcommon0", "libxfixes3", "libxcomposite1", "libxdamage1", "libpango-1.0-0", "libcairo2", "libcups2",
               "libdrm2", "libxshmfence1", "libegl1", "libgles2", "fonts-liberation"]

# base layers (system, Node, Python libs): no project code, so a code change never rebuilds them
base = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "curl", "ca-certificates", "gnupg", *CHROME_DEPS)
    .run_commands("curl -fsSL https://deb.nodesource.com/setup_22.x | bash -", "apt-get install -y nodejs")
    .pip_install("numpy==2.3.*", "scipy==1.16.*", "pillow==11.*", "fastapi[standard]")
)


def with_code(img):
    """the project (render-engine/) on top of an image, with its Node dependencies and the Remotion browser"""
    return (
        img.add_local_dir(str(HERE), "/app", copy=True, ignore=["node_modules", "out", ".rtmp", "**/__pycache__"])
        .run_commands("cd /app && npm ci --no-audit --no-fund", "cd /app && npx remotion browser ensure")
        .env({"PYTHON": "python3", "REMOTION_GL": "swangle", "RENDER_CHUNKS": "4", "RENDER_CONCURRENCY": "4"})
    )


image = with_code(base)

# video translation (dub/dub.py): the base plus Demucs (voice / music separation, model baked in) and OpenCV, then the
# code. The model file is checked against the SHA-256 prefix in its name (8726e21a), so it is the genuine file even when
# its host's certificate is broken (it expired in Nov 2026): first a normal download, then one without the certificate
# check, and the build fails if the checksum does not match.
DEMUCS = "https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/955717e8-8726e21a.th"
DEMUCS_DIR = "/root/.cache/torch/hub/checkpoints"
dub_image = with_code(
    base.pip_install("torch==2.5.1", "torchaudio==2.5.1", index_url="https://download.pytorch.org/whl/cpu")
    .pip_install("demucs==4.0.1", "soundfile==0.12.*", "opencv-python-headless==4.10.*")
    .run_commands(
        f"mkdir -p {DEMUCS_DIR} && (curl -fsSL -o {DEMUCS_DIR}/955717e8-8726e21a.th {DEMUCS} || curl -fsSLk -o {DEMUCS_DIR}/955717e8-8726e21a.th {DEMUCS})",
        f"sha256sum {DEMUCS_DIR}/955717e8-8726e21a.th | grep -q '^8726e21a'",
        "python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"",
    )
)

app = modal.App("storyit-render", image=image)
secret = modal.Secret.from_name("storyit-render")


def _drain():
    env = dict(os.environ)
    if env.get("RENDER_MODE") == "gpu":
        env["REMOTION_GL"] = "angle-egl"
        env["RENDER_CHUNKS"] = "2"
        env["RENDER_CONCURRENCY"] = "4"
    subprocess.run(["npx", "tsx", "worker/pipeline.ts"], cwd="/app", env=env, check=True)


@app.function(secrets=[secret], cpu=32.0, memory=32768, timeout=2 * 60 * 60, max_containers=2)
def drain_cpu():
    _drain()


# The GPU worker is deployed only when DEPLOY_GPU=1 at deploy time (Modal requires a payment method for GPUs).
if os.environ.get("DEPLOY_GPU") == "1":
    @app.function(secrets=[secret], gpu="L4", cpu=8.0, memory=32768, timeout=2 * 60 * 60, max_containers=2)
    def drain_gpu():
        _drain()


@app.function(image=dub_image, secrets=[secret], cpu=16.0, memory=16384, timeout=60 * 60, max_containers=2)
def drain_dub():
    subprocess.run(["python3", "dub/dub.py"], cwd="/app", env=dict(os.environ), check=True)


@app.function(secrets=[secret], cpu=4.0, memory=8192, timeout=2 * 60 * 60, max_containers=3)
def drain_prompt():
    subprocess.run(["python3", "promptvideo/run.py"], cwd="/app", env=dict(os.environ), check=True)


def _start():
    gpu = os.environ.get("RENDER_MODE") == "gpu" and "drain_gpu" in globals()
    (globals()["drain_gpu"] if gpu else drain_cpu).spawn()


@app.function(secrets=[secret])
@modal.asgi_app()
def api():
    from fastapi import FastAPI, Header, HTTPException

    web = FastAPI()

    @web.post("/wake")
    def wake_route(authorization: str = Header(default="")):
        if authorization != f"Bearer {os.environ['RENDER_WORKER_TOKEN']}":
            raise HTTPException(status_code=401)
        _start()
        return {"started": True}

    @web.post("/wake-dub")
    def wake_dub_route(authorization: str = Header(default="")):
        if authorization != f"Bearer {os.environ['RENDER_WORKER_TOKEN']}":
            raise HTTPException(status_code=401)
        drain_dub.spawn()
        return {"started": True}

    @web.post("/wake-prompt")
    def wake_prompt_route(authorization: str = Header(default="")):
        if authorization != f"Bearer {os.environ['RENDER_WORKER_TOKEN']}":
            raise HTTPException(status_code=401)
        drain_prompt.spawn()
        return {"started": True}

    return web


@app.function(secrets=[secret], schedule=modal.Period(minutes=5))
def poll():
    import json
    import urllib.request

    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/animated_projects?status=eq.queued&select=id&limit=1"
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if json.load(r):
            _start()
    req = urllib.request.Request(os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/dub_jobs?status=eq.queued&select=id&limit=1",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if json.load(r):
            drain_dub.spawn()
    req = urllib.request.Request(os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/prompt_videos?status=eq.queued&select=id&limit=1",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if json.load(r):
            drain_prompt.spawn()
