import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, Modal } from '@/components/ui';

type Box = { x: number; y: number; w: number; h: number };

/** AI clipping: the customer draws the streamer's camera on a frame of the source video (when the AI misses it).
 *  Returns the box in source-video pixels. */
export function CamPicker({ open, src, time, onClose, onPick }: { open: boolean; src: string; time: number; onClose: () => void; onPick: (box: Box, size: { w: number; h: number }) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // draw the frame at `time`
  useEffect(() => {
    if (!open) return;
    setBox(null);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
    const draw = () => {
      const c = canvas.current;
      if (!c) return;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      setSize({ w: v.videoWidth, h: v.videoHeight });
    };
    v.onloadeddata = () => { v.currentTime = Math.max(0.1, time); };
    v.onseeked = draw;
    return () => { v.removeAttribute('src'); v.load(); };
  }, [open, src, time]);

  // pointer position in source pixels
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sw = size?.w ?? 1, sh = size?.h ?? 1;
    return { x: Math.min(sw, Math.max(0, ((e.clientX - r.left) / r.width) * sw)), y: Math.min(sh, Math.max(0, ((e.clientY - r.top) / r.height) * sh)) };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = at(e); setBox({ ...drag.current, w: 0, h: 0 }); };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const p = at(e), s = drag.current;
    setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const up = () => { drag.current = null; };
  const valid = !!box && !!size && box.w > size.w * 0.05 && box.h > size.h * 0.05;

  return (
    <Modal wide open={open} onClose={onClose} title="Où est la caméra du streamer ?"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button disabled={!valid} onClick={() => { if (box && size) onPick({ x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) }, size); }}>Valider la caméra</Button></>}>
      <p className="mb-3 text-sm text-zinc-400">Dessine un rectangle autour de la caméra (son visage) en glissant ton doigt ou ta souris. Le clip la mettra en haut, et le reste de l’image en dessous.</p>
      <div className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-black" style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '16 / 9' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="application" aria-label="Zone de sélection de la caméra">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
        {!size && <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">Chargement de l’image…</p>}
        {box && size && (
          <div className="pointer-events-none absolute border-2 border-fuchsia-400 bg-fuchsia-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{ left: `${(box.x / size.w) * 100}%`, top: `${(box.y / size.h) * 100}%`, width: `${(box.w / size.w) * 100}%`, height: `${(box.h / size.h) * 100}%` }} />
        )}
      </div>
      {box && !valid && <p className="mt-2 text-xs text-amber-300">Trace un rectangle un peu plus grand.</p>}
    </Modal>
  );
}
