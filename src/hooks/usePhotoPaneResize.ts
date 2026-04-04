import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

type Direction = 'horizontal' | 'vertical';

const STORAGE_KEY_W = 'travel-replay-photo-pane-ratio';
const STORAGE_KEY_H = 'travel-replay-photo-pane-ratio-v';
const DEFAULT_RATIO_W = 0.37;
const DEFAULT_RATIO_H = 0.45;
const MIN_W = 280;
const MIN_H = 120;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function readRatio(key: string, def: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0.05 && n < 0.95) return n;
    }
  } catch { /* ignore */ }
  return def;
}

function saveRatio(key: string, r: number) {
  try { localStorage.setItem(key, String(r)); } catch { /* ignore */ }
}

export function usePhotoPaneResize(
  asideRef: RefObject<HTMLElement | null>,
  direction: Direction,
) {
  const isVert = direction === 'vertical';
  const storageKey = isVert ? STORAGE_KEY_H : STORAGE_KEY_W;
  const defaultRatio = isVert ? DEFAULT_RATIO_H : DEFAULT_RATIO_W;
  const minPx = isVert ? MIN_H : MIN_W;

  const getContainer = () =>
    isVert ? window.innerHeight : window.innerWidth;

  const clampPx = (px: number) => {
    const container = getContainer();
    return clamp(px, minPx, Math.floor(container * 0.85));
  };

  const [sizePx, setSizePx] = useState(() => {
    const container = getContainer();
    return clampPx(readRatio(storageKey, defaultRatio) * container);
  });

  const dragRef = useRef<{ startPos: number; startSize: number } | null>(null);
  const latestRef = useRef(sizePx);
  latestRef.current = sizePx;
  const dirRef = useRef(direction);
  dirRef.current = direction;

  useEffect(() => {
    const container = getContainer();
    const ratio = readRatio(storageKey, defaultRatio);
    setSizePx(clamp(ratio * container, minPx, Math.floor(container * 0.85)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  useEffect(() => {
    let raf: number | null = null;
    const onResize = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (dragRef.current) return;
        const container = dirRef.current === 'vertical'
          ? window.innerHeight : window.innerWidth;
        const ratio = latestRef.current / (container || 1);
        const min = dirRef.current === 'vertical' ? MIN_H : MIN_W;
        const next = clamp(ratio * container, min, Math.floor(container * 0.85));
        setSizePx(next);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  // ── Shared drag logic ─────────────────────────────────────────────

  const beginDrag = useCallback(
    (clientX: number, clientY: number) => {
      const el = asideRef.current;
      const rect = el?.getBoundingClientRect();
      const curVert = dirRef.current === 'vertical';
      const actualSize = curVert
        ? (rect?.height ?? latestRef.current)
        : (rect?.width ?? latestRef.current);
      const startPos = curVert ? clientY : clientX;
      dragRef.current = { startPos, startSize: actualSize };

      document.body.style.cursor = curVert ? 'ns-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';

      if (el) {
        if (curVert) {
          el.style.height = `${actualSize}px`;
        } else {
          el.style.width = `${actualSize}px`;
        }
      }
    },
    [asideRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      beginDrag(e.clientX, e.clientY);
    },
    [beginDrag],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      beginDrag(t.clientX, t.clientY);
    },
    [beginDrag],
  );

  useEffect(() => {
    function applyMove(clientX: number, clientY: number) {
      if (!dragRef.current) return;
      const curDir = dirRef.current;
      const isV = curDir === 'vertical';
      const pos = isV ? clientY : clientX;
      const delta = pos - dragRef.current.startPos;
      const container = isV ? window.innerHeight : window.innerWidth;
      const min = isV ? MIN_H : MIN_W;
      const nextPx = clamp(dragRef.current.startSize - delta, min, Math.floor(container * 0.85));

      const el = asideRef.current;
      if (el) {
        if (isV) {
          el.style.height = `${nextPx}px`;
        } else {
          el.style.width = `${nextPx}px`;
        }
      }
      latestRef.current = nextPx;
    }

    function endDrag() {
      if (!dragRef.current) return;
      const curDir = dirRef.current;
      const isV = curDir === 'vertical';
      const container = isV ? window.innerHeight : window.innerWidth;
      const finalPx = latestRef.current;
      const key = isV ? STORAGE_KEY_H : STORAGE_KEY_W;

      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      saveRatio(key, finalPx / container);
      setSizePx(finalPx);
    }

    const onMouseMove = (e: MouseEvent) => applyMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (dragRef.current) e.preventDefault();
      applyMove(t.clientX, t.clientY);
    };
    const onMouseUp = () => endDrag();
    const onTouchEnd = () => endDrag();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [asideRef]);

  return { sizePx, onMouseDown, onTouchStart };
}
