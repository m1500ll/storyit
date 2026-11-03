import { useEffect, useRef, useState } from 'react';
import { productionService } from '@/services/production';
import type { RenderProgress } from '@/services/repository';

/**
 * While a story is rendering, keeps calling the render worker (one call at a time).
 * Each call advances the pipeline for up to ~95s server-side, then we wait a little and call again.
 */
export function useRenderLoop(storyId: string | undefined, active: boolean) {
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!storyId || !active || running.current) return;
    running.current = true;
    let cancelled = false;
    let failures = 0;
    (async () => {
      while (!cancelled) {
        try {
          const p = await productionService.tick(storyId);
          if (cancelled) break;
          setProgress(p);
          setError(null);
          failures = 0;
          if (p.finished) break;
        } catch (e) {
          failures++;
          setError(e instanceof Error ? e.message : 'Render error');
          if (failures >= 5) break;
        }
        await new Promise((r) => setTimeout(r, failures ? 8000 : 3000));
      }
      running.current = false;
    })();
    return () => { cancelled = true; };
  }, [storyId, active]);

  return { progress, error };
}
