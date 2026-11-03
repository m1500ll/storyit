import { Clapperboard, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { assembleEpisode, type AssemblyProgress, spokenLine } from '@/lib/assemble';
import { slug } from '@/lib/export';
import type { StoryWithScenes } from '@/types/domain';
import { Button, Card, ProgressBar } from '../ui';

const STEP_LABEL: Record<AssemblyProgress['step'], string> = {
  loading: 'Loading the video editor…',
  scene: 'Editing scene',
  joining: 'Joining scenes…',
};

/** Assembles the rendered clips + voice-over + captions into one 9:16 MP4, in the browser. */
export function FinalVideoPanel({ story }: { story: StoryWithScenes }) {
  const ready = story.scenes.filter((s) => s.video_url);
  const allReady = ready.length === story.scenes.length && story.scenes.length > 0;
  const [progress, setProgress] = useState<AssemblyProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const build = async () => {
    setError(null);
    try {
      const blob = await assembleEpisode(story.scenes.map((s) => ({
        clipUrl: s.video_url!, audioUrl: s.audio_url ?? null, caption: spokenLine(s.dialogue) ?? s.narration, duration: s.duration_seconds,
      })), setProgress);
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card className="mt-4">
      <p className="label flex items-center gap-1.5"><Clapperboard className="h-3 w-3" /> Final video</p>
      {url ? (
        <>
          <video src={url} controls playsInline className="mt-3 aspect-[9/16] w-full rounded-xl bg-black" />
          <Button className="mt-3 w-full" onClick={() => { const a = Object.assign(document.createElement('a'), { href: url, download: `${slug(story.title)}.mp4` }); a.click(); }}>
            <Download className="h-4 w-4" /> Download MP4
          </Button>
          <button onClick={build} className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">Rebuild after changes</button>
        </>
      ) : progress ? (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-zinc-200"><Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            {STEP_LABEL[progress.step]}{progress.step === 'scene' ? ` ${progress.current}/${progress.total}…` : ''}</p>
          <div className="mt-3"><ProgressBar value={progress.step === 'loading' ? 0 : progress.current} max={progress.total} /></div>
          <p className="mt-2 text-[11px] text-zinc-500">Keep this tab open. Usually 1–3 minutes.</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs text-zinc-500">
            {allReady ? '9:16 MP4 with voice-over and captions, ready to post.' : `${ready.length}/${story.scenes.length} clips rendered. The final video unlocks when every scene has its clip.`}
          </p>
          <Button className="mt-3 w-full" onClick={build} disabled={!allReady}>Build final video</Button>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-coral-300">{error}</p>}
    </Card>
  );
}
