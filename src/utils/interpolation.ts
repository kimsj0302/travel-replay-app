import type { TrackPoint } from '../types';

/** `findPositionAtTime` 호출 시 `bTime === aTime` 분기가 몇 번 쓰였는지 집계할 때 사용 */
export interface InterpolationStats {
  degenerateSegmentHits: number;
}

/**
 * `findPositionAtTime`과 동일한 이진 탐색으로, 시각 `time`이 끼는 트랙 구간의 **정점 인덱스 쌍**을 반환.
 * - 구간 내부: `hi === lo + 1`
 * - 첫 시각 이하: `{ lo: 0, hi: 0 }`
 * - 마지막 시각 이상: `{ lo: n-1, hi: n-1 }`
 */
export function findTimeBracketIndices(
  track: TrackPoint[],
  time: Date,
): { lo: number; hi: number } | null {
  if (track.length === 0) return null;

  const t = time.getTime();
  const first = track[0].time.getTime();
  const last = track[track.length - 1].time.getTime();

  if (t <= first) return { lo: 0, hi: 0 };
  if (t >= last) return { lo: track.length - 1, hi: track.length - 1 };

  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].time.getTime() <= t) lo = mid;
    else hi = mid;
  }

  return { lo, hi };
}

export function findPositionAtTime(
  track: TrackPoint[],
  time: Date,
  stats?: InterpolationStats,
): { lat: number; lon: number } | null {
  if (track.length === 0) return null;

  const bracket = findTimeBracketIndices(track, time);
  if (!bracket) return null;
  const { lo, hi } = bracket;

  if (lo === hi) {
    const p = track[lo]!;
    return { lat: p.lat, lon: p.lon };
  }

  const t = time.getTime();
  const a = track[lo];
  const b = track[hi];
  const aTime = a.time.getTime();
  const bTime = b.time.getTime();
  const degenerate = bTime === aTime;
  if (degenerate && stats) {
    stats.degenerateSegmentHits += 1;
  }
  const ratio = degenerate ? 0 : (t - aTime) / (bTime - aTime);

  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lon: a.lon + (b.lon - a.lon) * ratio,
  };
}
