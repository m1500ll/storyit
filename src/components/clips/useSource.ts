import { useCallback, useEffect, useState } from 'react';
import { sourceStore } from '@/services/sourceStore';

/** The project's source video from this browser, as a playable object URL. */
export function useSource(projectId: string | undefined) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!projectId) { setLoading(false); return; }
    sourceStore.get(projectId).then((f) => { if (!cancelled) { setFile(f); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const relink = useCallback(async (f: File) => {
    if (!projectId) return;
    await sourceStore.put(projectId, f);
    setFile(f);
  }, [projectId]);

  return { file, url, loading, relink };
}
