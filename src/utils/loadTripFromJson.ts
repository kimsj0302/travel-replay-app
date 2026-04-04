import type { Trip, TripPhoto, TrackPoint } from '../types';
import { buildSpeedSegments } from './speedZones';
import { findPositionAtTime } from './interpolation';

interface TripJsonInput {
  title?: string;
  date?: string;
  photos?: { url: string; time: string; lat?: number; lon?: number }[];
  track?: { time: string; lat: number; lon: number; ele?: number }[];
}

export function loadTripFromJson(raw: unknown): Trip {
  const json = raw as TripJsonInput;
  if (!json || !Array.isArray(json.photos) || json.photos.length === 0) {
    throw new Error('유효한 photos 배열이 없습니다.');
  }

  const track: TrackPoint[] = [];
  if (Array.isArray(json.track)) {
    for (const pt of json.track) {
      const time = new Date(pt.time);
      if (isNaN(time.getTime())) continue;
      if (typeof pt.lat !== 'number' || typeof pt.lon !== 'number') continue;
      track.push(
        pt.ele !== undefined
          ? { time, lat: pt.lat, lon: pt.lon, ele: pt.ele }
          : { time, lat: pt.lat, lon: pt.lon },
      );
    }
    track.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  const photos: TripPhoto[] = [];
  for (const p of json.photos) {
    const time = new Date(p.time);
    if (isNaN(time.getTime())) continue;

    const hasExplicitGeo =
      typeof p.lat === 'number' &&
      typeof p.lon === 'number' &&
      (p.lat !== 0 || p.lon !== 0);

    if (hasExplicitGeo) {
      photos.push({
        time,
        lat: p.lat!,
        lon: p.lon!,
        url: p.url,
        gpsSource: 'exif',
      });
    } else if (track.length > 0) {
      const pos = findPositionAtTime(track, time);
      if (pos) {
        photos.push({
          time,
          lat: pos.lat,
          lon: pos.lon,
          url: p.url,
          gpsSource: 'interpolated',
        });
      } else {
        photos.push({ time, lat: 0, lon: 0, url: p.url, gpsSource: 'none' });
      }
    } else {
      photos.push({ time, lat: 0, lon: 0, url: p.url, gpsSource: 'none' });
    }
  }

  if (photos.length === 0) {
    throw new Error('유효한 시간을 가진 사진이 없습니다.');
  }

  photos.sort((a, b) => a.time.getTime() - b.time.getTime());

  const allTimes = [
    ...photos.map((p) => p.time.getTime()),
    ...track.map((t) => t.time.getTime()),
  ];
  const startTime = new Date(Math.min(...allTimes));
  const endTime = new Date(Math.max(...allTimes));
  const title = json.title || 'Untitled';

  return {
    id: title,
    title,
    date: json.date ?? startTime.toISOString().slice(0, 10),
    track,
    photos,
    speedSegments: buildSpeedSegments(startTime.getTime(), endTime.getTime(), photos),
    startTime,
    endTime,
  };
}
