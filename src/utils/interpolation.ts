import type { TrackPoint } from '../types';

/** `findPositionAtTime` 호출 시 `bTime === aTime` 분기가 몇 번 쓰였는지 집계할 때 사용 */
export interface InterpolationStats {
  degenerateSegmentHits: number;
}

export function findPositionAtTime(
  track: TrackPoint[],
  time: Date,
  stats?: InterpolationStats,
): { lat: number; lon: number } | null {
  if (track.length === 0) return null;

  const t = time.getTime();
  const first = track[0].time.getTime();
  const last = track[track.length - 1].time.getTime();

  if (t <= first) return { lat: track[0].lat, lon: track[0].lon };
  if (t >= last) {
    const lp = track[track.length - 1];
    return { lat: lp.lat, lon: lp.lon };
  }

  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].time.getTime() <= t) lo = mid;
    else hi = mid;
  }

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
