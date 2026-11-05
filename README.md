# Sauvegarde : test vidéo « claude-animated-shorts » (pont de Hammersmith)
Branche indépendante, sans lien avec l'application Storyit (aucun historique commun avec main).

- `save/new/` : fichiers écrits pour cette vidéo (story.ts, audio timeline/sfx/music, SCRIPT_FR.md, make_voice_elevenlabs.py, render_chunks.sh, Root.tsx)
- `save/patches/` : modifications par rapport à github.com/mromidev/claude-animated-shorts (templates/bridge/{Bridge.tsx,world.ts,cast.ts,toon.ts}, templates/audio/mix.py), format `diff -U1`
- `save.tar.xz` : la même chose en archive (sha256 cab17443254bcfc71cbb5ee67735f88614ada01f4af9e3091d8d28dccfb3cbbb)

## media/ (pour le test « voix FR sans recalage »)
- `video_sans_son.mp4` : la vidéo finale rendue (1080x1920, 60 s), sans piste audio
- `stem_music.flac`, `stem_sfx.flac` : musique et bruitages au gain du mix v1 (48 kHz). Pour la v2 : musique -4 dB.
- `cues.md` : feuille des sons de la v1
