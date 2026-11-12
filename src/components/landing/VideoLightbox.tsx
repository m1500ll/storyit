import { X } from 'lucide-react';
import { useEffect } from 'react';
import { posterSrc, videoSrc, type ShowcaseVideo } from '@/data/showcase';
import { useLang } from '@/lib/lang';

/** Full episode with sound. Escape / backdrop closes. */
export function VideoLightbox({ video, onClose }: { video: ShowcaseVideo | null; onClose: () => void }) {
  const fr = useLang() === 'fr';
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [video, onClose]);

  if (!video) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overscroll-contain bg-black/90 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose}>
      <div className="relative w-full max-w-[min(420px,calc((100vh-6rem)*9/16))]" onClick={(e) => e.stopPropagation()}>
        <video src={videoSrc(video.slug)} poster={posterSrc(video.slug)} controls autoPlay playsInline
          className="aspect-[9/16] w-full rounded-2xl bg-black object-cover shadow-2xl" />
        <p className="mt-3 text-center text-sm font-medium text-zinc-100">{video.title}</p>
        <p className="text-center text-xs text-zinc-500">{fr ? 'Créée avec Storyit' : 'Made with Storyit'} · {video.format}</p>
        <button onClick={onClose} aria-label={fr ? 'Fermer la vidéo' : 'Close video'} className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-ink-950 shadow-lg sm:-right-12 sm:top-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
