import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

const STORAGE_KEY = 'travel-replay-photo-pane-ratio';
const LEGACY_STORAGE_KEY = 'travel-replay-photo-pane-width';
const DEFAULT_RATIO = 0.37;
const MIN_WIDTH = 280;

function maxWidthPx(vw: number): number {
  return Math.min(Math.floor(vw * 0.88), 1400);
}

function clampPx(px: number, vw: number): number {
  return Math.max(MIN_WIDTH, Math.min(maxWidthPx(vw), px));
}

function clampRatio(r: number, vw: number): number {
  return Math.max(MIN_WIDTH / vw, Math.min(maxWidthPx(vw) / vw, r));
}

function readStoredRatio(vw: number): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const num = parseFloat(v);
      if (!isNaN(num) && num > 0 && num <= 1) return clampRatio(num, vw);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const px = parseInt(legacy, 10);
      if (!isNaN(px) && px > 100) {
        const r = clampRatio(px / vw, vw);
        try {
          localStorage.setItem(STORAGE_KEY, String(r));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch { /* ignore */ }
        return r;
      }
    }
  } catch { /* ignore */ }
  return clampRatio(DEFAULT_RATIO, vw);
}

function saveRatio(r: number) {
  try { localStorage.setItem(STORAGE_KEY, String(r)); } catch { /* ignore */ }
}

/**
 * 사진 패널 너비 관리.
 * - 드래그 시작: aside의 **실제 DOM 너비**를 기준으로 잡아 점프를 방지.
 * - 드래그 중: aside에 직접 style.width만 쓴다 (React setState 안 함).
 * - 드래그 끝: 인라인 style.width를 **유지**한 채 React 상태를 동기화.
 *   → removeProperty 하지 않으므로 한 프레임도 CSS 기본값으로 돌아가지 않는다.
 */
export function usePhotoPaneWidth(asideRef: RefObject<HTMLElement | null>) {
  const initVw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const [widthPx, setWidthPx] = useState(() => clampPx(readStoredRatio(initVw) * initVw, initVw));

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const latestPxRef = useRef(widthPx);
  latestPxRef.current = widthPx;

  /* ── window resize (브라우저 창 크기 변경) ── */
  useEffect(() => {
    let raf: number | null = null;
    const onResize = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (dragRef.current) return;
        const vw = window.innerWidth;
        const ratio = latestPxRef.current / (vw || 1);
        const next = clampPx(clampRatio(ratio, vw) * vw, vw);
        setWidthPx(next);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  /* ── 드래그 시작 ── */
  const onResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const el = asideRef.current;
      const actualW = el ? el.getBoundingClientRect().width : latestPxRef.current;
      dragRef.current = { startX: e.clientX, startW: actualW };
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      if (el) el.style.width = `${actualW}px`;
    },
    [asideRef],
  );

  /* ── 드래그 중 + 드래그 끝 ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const vw = window.innerWidth;
      const delta = e.clientX - dragRef.current.startX;
      const nextPx = clampPx(dragRef.current.startW - delta, vw);
      const el = asideRef.current;
      if (el) el.style.width = `${nextPx}px`;
      latestPxRef.current = nextPx;
    };

    const onUp = () => {
      if (!dragRef.current) return;
      const vw = window.innerWidth;
      const finalPx = latestPxRef.current;
      const finalRatio = clampRatio(finalPx / vw, vw);

      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      saveRatio(finalRatio);
      setWidthPx(clampPx(finalRatio * vw, vw));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [asideRef]);

  return { widthPx, onResizeStart };
}
