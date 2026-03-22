import type { TrackPoint } from '../types';

/**
 * 트랙 시각 기준으로 `tMs`에 가장 가까운 궤적 **정점** 인덱스.
 * (선분 위 보간 위치가 아니라, 기록된 포인트 중 하나)
 */
export function closestTrackVertexIndex(track: TrackPoint[], tMs: number): number {
  if (track.length === 0) return 0;
  if (tMs <= track[0].time.getTime()) return 0;
  if (tMs >= track[track.length - 1].time.getTime()) return track.length - 1;

  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].time.getTime() <= tMs) lo = mid;
    else hi = mid;
  }

  const tLo = track[lo].time.getTime();
  const tHi = track[hi].time.getTime();
  return tMs - tLo <= tHi - tMs ? lo : hi;
}

/**
 * 타임라인(시간축)에 점을 균등 배치하기 위해, [start,end] 구간을 나눈 각 시각에
 * **가장 가까운 실제 GPS 정점**을 고른다.
 *
 * 인덱스 균등 샘플링은 기록 밀도가 들쭉날쭉할 때 시간축에서 ‘빈 구간’처럼 보여
 * 재생 위치가 두 점 ‘사이’인데 지도는 정점 위에 있는 것처럼 오해될 수 있다.
 */
export function sampleTrackVerticesForTimeline(
  track: TrackPoint[],
  maxPoints: number,
): TrackPoint[] {
  if (track.length <= maxPoints) return track;

  const t0 = track[0].time.getTime();
  const t1 = track[track.length - 1].time.getTime();
  if (t1 <= t0) return [...track];

  const out: TrackPoint[] = [];
  const used = new Set<number>();

  for (let i = 0; i < maxPoints; i++) {
    const targetT = t0 + (i / (maxPoints - 1)) * (t1 - t0);
    const idx = closestTrackVertexIndex(track, targetT);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(track[idx]);
  }

  if (out.length === 0) {
    out.push(track[0]);
  }

  return out;
}
