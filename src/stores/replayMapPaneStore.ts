/**
 * 재생 화면에서 지도가 들어가는 `.replay-map-pane`의 확정 크기.
 * MapView 내부 div 측정 타이밍과 분리해, 레이아웃이 정해진 뒤 한 곳에서만 커밋한다.
 */

export type MapPaneSize = { w: number; h: number };

let committed: MapPaneSize | null = null;
const listeners = new Set<(size: MapPaneSize) => void>();

export function getCommittedMapPaneSize(): MapPaneSize | null {
  return committed;
}

export function commitMapPaneSize(width: number, height: number): void {
  if (width < 1 || height < 1) return;
  const w = Math.round(width);
  const h = Math.round(height);
  if (committed && committed.w === w && committed.h === h) return;
  committed = { w, h };
  listeners.forEach((fn) => fn(committed!));
}

export function subscribeMapPaneSize(fn: (size: MapPaneSize) => void): () => void {
  listeners.add(fn);
  if (committed) fn(committed);
  return () => {
    listeners.delete(fn);
  };
}

/** 재생 페이지 이탈 시 다음 진입에서 이전 세션 크기를 쓰지 않도록 */
export function resetReplayMapPaneStore(): void {
  committed = null;
  listeners.clear();
}
