import type { TrackPoint, TripPhoto, Trip } from '../types';
import { findPositionAtTime } from './interpolation';
import { groupPhotos } from './photoGrouping';
import { buildSpeedSegments } from './speedZones';

export function fillMissingGps(photos: TripPhoto[], track: TrackPoint[]): void {
  for (const photo of photos) {
    if (photo.gpsSource === 'interpolated') {
      const pos = findPositionAtTime(track, photo.time);
      if (pos) {
        photo.lat = pos.lat;
        photo.lon = pos.lon;
      }
    }
  }
}

export function buildTrip(
  folderName: string,
  track: TrackPoint[],
  photos: TripPhoto[],
): Trip {
  fillMissingGps(photos, track);

  const groups = groupPhotos(photos, track);

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
    groups,
  );

  const dateStr = startTime.toISOString().slice(0, 10);

  return {
    id: folderName,
    title: folderName,
    date: dateStr,
    track,
    photos,
    groups,
    speedSegments,
    startTime,
    endTime,
  };
}
