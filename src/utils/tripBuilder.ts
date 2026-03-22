import type { TrackPoint, TripPhoto, Trip } from '../types';
import { findPositionAtTime } from './interpolation';
import { buildSpeedSegments } from './speedZones';

/**
 * GPX가 있으면 모든 사진 좌표를 촬영 시각 기준 트랙 위에 선형 보간.
 * EXIF 유무는 `gpsSource`로만 구분(핀 색 등).
 */
export function fillMissingGps(photos: TripPhoto[], track: TrackPoint[]): void {
  if (track.length === 0) return;

  for (const photo of photos) {
    const pos = findPositionAtTime(track, photo.time);
    if (pos) {
      photo.lat = pos.lat;
      photo.lon = pos.lon;
    }
  }
}

export function buildTrip(
  folderName: string,
  track: TrackPoint[],
  photos: TripPhoto[],
): Trip {
  fillMissingGps(photos, track);

  const startTime =
    track.length > 0 ? track[0].time : photos.length > 0 ? photos[0].time : new Date();
  const endTime =
    track.length > 0
      ? track[track.length - 1].time
      : photos.length > 0
        ? photos[photos.length - 1].time
        : new Date();

  const speedSegments = buildSpeedSegments(
    startTime.getTime(),
    endTime.getTime(),
    photos,
  );

  const dateStr = startTime.toISOString().slice(0, 10);

  return {
    id: folderName,
    title: folderName,
    date: dateStr,
    track,
    photos,
    speedSegments,
    startTime,
    endTime,
  };
}
