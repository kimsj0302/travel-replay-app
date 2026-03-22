import { useEffect, useLayoutEffect, type RefObject } from 'react';
import {
  commitMapPaneSize,
  resetReplayMapPaneStore,
} from '../stores/replayMapPaneStore';

/**
 * `.replay-map-pane` ref 기준으로 크기를 측정해 전역 스토어에 커밋.
 * - ResizeObserver는 pending만 표시, 연속 드래그 중에는 map 갱신 안 함
 * - pointerup 시 확정 (헤더/재생 컨트롤은 레이아웃 안정 후 이중 rAF)
 * - 사진 패널 열림/닫힘 등 레이아웃 점프는 layoutKey 변경 시 useLayoutEffect에서 동기 커밋
 */
export function useReplayMapPaneLayout(
  mapPaneRef: RefObject<HTMLElement | null>,
  layoutKey: boolean | number | string,
) {
  useLayoutEffect(() => {
    const el = mapPaneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    commitMapPaneSize(r.width, r.height);
  }, [mapPaneRef, layoutKey]);

  useEffect(() => {
    const el = mapPaneRef.current;
    if (!el) return;

    let pending = false;
    let deferredFlushOuter = 0;
    let deferredFlushInner = 0;

    const measureAndCommit = () => {
      const r = el.getBoundingClientRect();
      commitMapPaneSize(r.width, r.height);
      pending = false;
    };

    const ro = new ResizeObserver(() => {
      pending = true;
    });
    ro.observe(el);

    const flushAfterLayout = () => {
      cancelAnimationFrame(deferredFlushOuter);
      cancelAnimationFrame(deferredFlushInner);
      deferredFlushOuter = requestAnimationFrame(() => {
        deferredFlushInner = requestAnimationFrame(() => {
          deferredFlushOuter = 0;
          deferredFlushInner = 0;
          measureAndCommit();
        });
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const fromChromeUi = t?.closest?.('.playback-controls, .replay-header');
      if (fromChromeUi) {
        flushAfterLayout();
        return;
      }
      if (pending) measureAndCommit();
    };

    window.addEventListener('pointerup', onPointerUp, true);

    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(() => {
        measureAndCommit();
      });
    });

    let winResizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onWindowResize = () => {
      if (winResizeTimer) clearTimeout(winResizeTimer);
      winResizeTimer = setTimeout(() => {
        winResizeTimer = null;
        measureAndCommit();
      }, 150);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      cancelAnimationFrame(deferredFlushOuter);
      cancelAnimationFrame(deferredFlushInner);
      if (winResizeTimer) clearTimeout(winResizeTimer);
      ro.disconnect();
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('resize', onWindowResize);
      resetReplayMapPaneStore();
    };
  }, [mapPaneRef]);
}
