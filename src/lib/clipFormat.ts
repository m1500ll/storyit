/** AI clipping: small display helpers. */
export const formatDuration = (s: number) => {
  const total = Math.max(0, Math.round(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export const formatSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} Go` : `${Math.max(1, Math.round(b / 1e6))} Mo`);

/** Safe file name from a clip title. */
export const fileNameFor = (title: string) => `${title.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'clip'}.mp4`;
