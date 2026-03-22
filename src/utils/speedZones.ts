import type { SpeedSegment, TripPhoto } from '../types';

const SLOW_ZONE_RADIUS_MS = 2 * 60 * 1000; // +/- 2 minutes around each photo
const FAST_SPEED = 15;
const SLOW_SPEED = 0.4;

export function buildSpeedSegments(
  startMs: number,
  endMs: number,
  photos: TripPhoto[],
): SpeedSegment[] {
  if (photos.length === 0) {
    return [{ startTime: startMs, endTime: endMs, speedFactor: FAST_SPEED }];
  }

  const slowZones: { start: number; end: number }[] = photos.map((p) => ({
    start: Math.max(startMs, p.time.getTime() - SLOW_ZONE_RADIUS_MS),
    end: Math.min(endMs, p.time.getTime() + SLOW_ZONE_RADIUS_MS),
  }));

  const merged: { start: number; end: number }[] = [];
  for (const zone of slowZones) {
    if (merged.length > 0 && zone.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, zone.end);
    } else {
      merged.push({ ...zone });
    }
  }

  const segments: SpeedSegment[] = [];
  let cursor = startMs;

  for (const zone of merged) {
    if (cursor < zone.start) {
      segments.push({ startTime: cursor, endTime: zone.start, speedFactor: FAST_SPEED });
    }
    segments.push({ startTime: zone.start, endTime: zone.end, speedFactor: SLOW_SPEED });
    cursor = zone.end;
  }

  if (cursor < endMs) {
    segments.push({ startTime: cursor, endTime: endMs, speedFactor: FAST_SPEED });
  }

  return segments;
}

export function getSpeedAtTime(segments: SpeedSegment[], timeMs: number): number {
  for (const seg of segments) {
    if (timeMs >= seg.startTime && timeMs < seg.endTime) {
      return seg.speedFactor;
    }
  }
  return FAST_SPEED;
}

export function computeTotalPlaybackDuration(segments: SpeedSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    const realDuration = seg.endTime - seg.startTime;
    total += realDuration / seg.speedFactor;
  }
  return total;
}

export function tripTimeToPlaybackTime(
  segments: SpeedSegment[],
  tripTimeMs: number,
): number {
  let playback = 0;
  for (const seg of segments) {
    if (tripTimeMs <= seg.startTime) break;
    const segEnd = Math.min(tripTimeMs, seg.endTime);
    playback += (segEnd - seg.startTime) / seg.speedFactor;
    if (tripTimeMs <= seg.endTime) break;
  }
  return playback;
}

export function playbackTimeToTripTime(
  segments: SpeedSegment[],
  playbackMs: number,
): number {
  let remaining = playbackMs;
  for (const seg of segments) {
    const segPlaybackDuration = (seg.endTime - seg.startTime) / seg.speedFactor;
    if (remaining <= segPlaybackDuration) {
      return seg.startTime + remaining * seg.speedFactor;
    }
    remaining -= segPlaybackDuration;
  }
  return segments.length > 0 ? segments[segments.length - 1].endTime : 0;
}
