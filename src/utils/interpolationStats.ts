import type { TrackPoint, TripPhoto } from '../types';
import { findPositionAtTime, type InterpolationStats } from './interpolation';

/** GPX 트랙에서 인접한 두 포인트의 시각(ms)이 같은 구간 */
export interface AdjacentDuplicateTimeReport {
  /** 인접 (i, i+1) 쌍 중 time이 같은 쌍의 개수 */
  duplicateAdjacentPairCount: number;
  /** 인접 쌍 전체 (track.length - 1) */
  totalAdjacentPairs: number;
  /** 중복이 시작되는 인덱스 i (track[i].time === track[i+1].time) */
  duplicateStartIndices: number[];
}

/**
 * 트랙 정렬이 올바르다는 전제에서, **시각이 동일한 인접 포인트 쌍**이 몇 개인지 분석한다.
 * (보간 시 `bTime === aTime`이 *가능해지는* 구조적 원인)
 */
export function analyzeAdjacentDuplicateTimes(track: TrackPoint[]): AdjacentDuplicateTimeReport {
  const duplicateStartIndices: number[] = [];
  for (let i = 0; i < track.length - 1; i++) {
    if (track[i].time.getTime() === track[i + 1].time.getTime()) {
      duplicateStartIndices.push(i);
    }
  }
  return {
    duplicateAdjacentPairCount: duplicateStartIndices.length,
    totalAdjacentPairs: Math.max(0, track.length - 1),
    duplicateStartIndices,
  };
}

export interface TripInterpolationDuplicateReport {
  adjacentDuplicateTimes: AdjacentDuplicateTimeReport;
  /** 사진 시각마다 `findPositionAtTime`을 호출했을 때 degenerate 분기 횟수 */
  degenerateHitsFromPhotoTimes: number;
  photoCount: number;
}

/**
 * 현재 trip에 대해:
 * 1) 인접 시각 중복 구간 개수
 * 2) 각 사진 촬영 시각으로 `findPositionAtTime`을 호출했을 때 `bTime === aTime`이 실제로 몇 번 도는지
 *
 * (import 직후 `buildTrip` 전에 호출하면 `fillMissingGps`와 동일한 트랙·사진으로 비교 가능)
 */
export function collectInterpolationDuplicateReport(
  track: TrackPoint[],
  photos: TripPhoto[],
): TripInterpolationDuplicateReport {
  const adjacentDuplicateTimes = analyzeAdjacentDuplicateTimes(track);
  const stats: InterpolationStats = { degenerateSegmentHits: 0 };
  for (const p of photos) {
    findPositionAtTime(track, p.time, stats);
  }
  return {
    adjacentDuplicateTimes,
    degenerateHitsFromPhotoTimes: stats.degenerateSegmentHits,
    photoCount: photos.length,
  };
}

/**
 * 콘솔/디버그용 한 줄 요약 (필요 시 UI에 붙여도 됨)
 */
export function formatInterpolationDuplicateSummary(r: TripInterpolationDuplicateReport): string {
  const a = r.adjacentDuplicateTimes;
  return [
    `인접 시각 동일 구간: ${a.duplicateAdjacentPairCount} / ${a.totalAdjacentPairs}쌍`,
    `사진 ${r.photoCount}장 기준 findPositionAtTime degenerate 분기: ${r.degenerateHitsFromPhotoTimes}회`,
  ].join(' · ');
}
