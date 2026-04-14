import type { TrackPoint } from '../types';

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function normalizeGeoBounds(bounds: GeoBounds): GeoBounds {
  return {
    minLat: Math.min(bounds.minLat, bounds.maxLat),
    maxLat: Math.max(bounds.minLat, bounds.maxLat),
    minLon: Math.min(bounds.minLon, bounds.maxLon),
    maxLon: Math.max(bounds.minLon, bounds.maxLon),
  };
}

export function selectTrackPointIndicesInBounds(
  trackPoints: TrackPoint[],
  bounds: GeoBounds,
): number[] {
  const normalized = normalizeGeoBounds(bounds);

  return trackPoints.flatMap((point, index) => {
    const insideLat = point.lat >= normalized.minLat && point.lat <= normalized.maxLat;
    const insideLon = point.lon >= normalized.minLon && point.lon <= normalized.maxLon;
    return insideLat && insideLon ? [index] : [];
  });
}
