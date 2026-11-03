import { useEffect, useRef, useState } from 'react';

/** True while the element is (mostly) on screen. Used to play/pause preview loops. */
export function useInView<T extends Element>(threshold = 0.5) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}
