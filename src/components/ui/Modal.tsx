import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** wider sheet (e.g. a video frame to draw on) */
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  // rendered on <body>: inside a card with a backdrop blur, a fixed overlay would be trapped in that card
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`surface relative max-h-[92vh] w-full overflow-y-auto p-6 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-line/5 hover:text-zinc-200" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-zinc-400">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
