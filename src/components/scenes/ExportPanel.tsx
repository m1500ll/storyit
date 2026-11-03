import { Captions, FileJson, FileText, Send } from 'lucide-react';
import { download, slug, toJson, toPromptSheet, toSrt } from '@/lib/export';
import type { StoryWithScenes } from '@/types/domain';
import { Card } from '../ui';

export function ExportPanel({ story }: { story: StoryWithScenes }) {
  const name = slug(story.title);
  const approved = Boolean(story.approved_at);
  const items = [
    { icon: Captions, label: 'Subtitles (.srt)', onClick: () => download(`${name}.srt`, toSrt(story), 'application/x-subrip') },
    { icon: FileText, label: 'Prompt sheet (.md)', onClick: () => download(`${name}-prompts.md`, toPromptSheet(story), 'text/markdown') },
    { icon: FileJson, label: 'Storyboard (.json)', onClick: () => download(`${name}.json`, toJson(story), 'application/json') },
  ];

  return (
    <Card className="mt-4">
      <p className="label">Export</p>
      <div className="mt-3 space-y-1">
        {items.map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-zinc-300 transition hover:bg-line/[0.04] hover:text-zinc-100">
            <Icon className="h-4 w-4 text-zinc-500" />{label}
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-line/5 pt-3">
        <button disabled className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-zinc-500" title={approved ? 'Coming soon' : 'Approve the episode first'}>
          <span className="flex items-center gap-2.5"><Send className="h-4 w-4" />Publish to TikTok</span>
          <span className="rounded-full bg-line/5 px-2 py-0.5 text-[10px]">Soon</span>
        </button>
      </div>
    </Card>
  );
}
