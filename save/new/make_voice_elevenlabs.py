# French narration with ElevenLabs (PAID service, run only with the owner's explicit approval).
# Reads the key from the ELEVENLABS_API_KEY environment variable (never from chat or a file).
# Uses /v1/text-to-speech/{voice}/with-timestamps: audio + character alignment -> voice.wav (48 kHz) + words.json.
# Usage: python make_voice_elevenlabs.py <SCRIPT_FR.md> <out_dir> <voice_id> [model_id]
import base64, json, os, re, subprocess, sys, urllib.request

script, out, voice = sys.argv[1], sys.argv[2], sys.argv[3]
model = sys.argv[4] if len(sys.argv) > 4 else "eleven_multilingual_v2"
key = os.environ.get("ELEVENLABS_API_KEY")
if not key:
    sys.exit("ELEVENLABS_API_KEY is not set")
text = open(script, encoding="utf-8").read().split("## Script")[1].strip()
text = " ".join(l.strip() for l in text.splitlines() if l.strip())
print(f"{len(text)} characters will be billed (about 1 credit per character on multilingual v2)")
body = json.dumps({"text": text, "model_id": model, "language_code": "fr",
                   "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True}}).encode()
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_192",
                             data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
res = json.load(urllib.request.urlopen(req, timeout=300))
os.makedirs(out, exist_ok=True)
mp3 = os.path.join(out, "voice_el.mp3")
open(mp3, "wb").write(base64.b64decode(res["audio_base64"]))
LEAD = 0.25  # silence before the first word, as in the English version
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af", f"adelay={int(LEAD * 1000)},aresample=48000", "-ac", "1",
                "-c:a", "pcm_s24le", os.path.join(out, "voice.wav")], check=True)
al = res["alignment"]
chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
# words = runs of letters (accents, apostrophes and hyphens included), timed from their first/last character
words, cur, line = [], None, 0
for c, s, e in zip(chars, st, en):
    if re.match(r"[\wÀ-ÿ'’-]", c):
        cur = [c, s, e] if cur is None else [cur[0] + c, cur[1], e]
    else:
        if cur:
            words.append({"word": cur[0], "start": round(cur[1] + LEAD, 3), "end": round(cur[2] + LEAD, 3)})
            cur = None
if cur:
    words.append({"word": cur[0], "start": round(cur[1] + LEAD, 3), "end": round(cur[2] + LEAD, 3)})
for w in words:
    w["s"], w["e"] = w["start"], w["end"]
json.dump(words, open(os.path.join(out, "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(out, "voice.wav")],
                           capture_output=True, text=True).stdout)
print(f"voice {dur:.2f} s, {len(words)} words, {len(words) / dur:.2f} words/s")
