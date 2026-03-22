import type { TripPhoto, PhotoGroup, TrackPoint } from '../types';
import { findPositionAtTime } from './interpolation';

const DEFAULT_THRESHOLD_MS = 90_000; // 90 seconds

export function groupPhotos(
  photos: TripPhoto[],
  track: TrackPoint[],
  thresholdMs: number = DEFAULT_THRESHOLD_MS,
): PhotoGroup[] {
  if (photos.length === 0) return [];

  const sorted = [...photos].sort((a, b) => a.time.getTime() - b.time.getTime());
  const groups: PhotoGroup[] = [];
  let currentGroup: TripPhoto[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].time.getTime() - currentGroup[0].time.getTime();
    if (diff <= thresholdMs) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(buildGroup(groups.length, currentGroup, track));
      currentGroup = [sorted[i]];
    }
  }
  groups.push(buildGroup(groups.length, currentGroup, track));

  return groups;
}

function buildGroup(
  id: number,
  photos: TripPhoto[],
  track: TrackPoint[],
): PhotoGroup {
  const time = photos[0].time;

  const withGps = photos.filter((p) => p.gpsSource === 'exif');
  let lat: number;
  let lon: number;

  if (withGps.length > 0) {
    lat = withGps.reduce((sum, p) => sum + p.lat, 0) / withGps.length;
    lon = withGps.reduce((sum, p) => sum + p.lon, 0) / withGps.length;
  } else {
    const pos = findPositionAtTime(track, time);
    lat = pos?.lat ?? 0;
    lon = pos?.lon ?? 0;
  }

  return { id, time, lat, lon, photos };
}
