import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const MAX_TRACK_PREVIEW_POINTS = 400;
const PHOTO_COORD_PRECISION = 6;

type RawRecord = Record<string, unknown>;
type ParsedTrackPoint = {
  timeMs: number;
  lat: number;
  lon: number;
};

function extractSourcePosts(raw: { photos?: unknown }): Array<{ url: string; photoCount: number }> {
  const photos = raw.photos;
  if (!Array.isArray(photos) || photos.length === 0) return [];

  const counts = new Map<string, number>();
  for (const photo of photos) {
    if (!photo || typeof photo !== 'object') continue;
    const sourceUrl = (photo as Record<string, unknown>).sourceUrl;
    if (typeof sourceUrl !== 'string') continue;
    const normalized = sourceUrl.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts, ([url, photoCount]) => ({ url, photoCount }));
}

function parseIsoTimeMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const timeMs = Date.parse(value);
  return Number.isFinite(timeMs) ? timeMs : null;
}

function parseTrackPoints(rawTrack: unknown): ParsedTrackPoint[] {
  if (!Array.isArray(rawTrack) || rawTrack.length === 0) return [];

  const track: ParsedTrackPoint[] = [];
  for (const point of rawTrack) {
    if (!point || typeof point !== 'object') continue;
    const record = point as RawRecord;
    const timeMs = parseIsoTimeMs(record.time);
    const lat = record.lat;
    const lon = record.lon;

    if (
      timeMs === null ||
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    track.push({ timeMs, lat, lon });
  }

  track.sort((a, b) => a.timeMs - b.timeMs);
  return track;
}

function findTrackPositionAtTime(
  track: ParsedTrackPoint[],
  timeMs: number,
): [number, number] | null {
  if (track.length === 0) return null;

  if (timeMs <= track[0]!.timeMs) {
    const point = track[0]!;
    return [point.lon, point.lat];
  }

  const last = track[track.length - 1]!;
  if (timeMs >= last.timeMs) return [last.lon, last.lat];

  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid]!.timeMs <= timeMs) lo = mid;
    else hi = mid;
  }

  const a = track[lo]!;
  const b = track[hi]!;
  const denom = b.timeMs - a.timeMs;
  const ratio = denom === 0 ? 0 : (timeMs - a.timeMs) / denom;

  return [
    a.lon + (b.lon - a.lon) * ratio,
    a.lat + (b.lat - a.lat) * ratio,
  ];
}

function coordKey([lon, lat]: [number, number]): string {
  return `${lon.toFixed(PHOTO_COORD_PRECISION)},${lat.toFixed(PHOTO_COORD_PRECISION)}`;
}

function extractPhotoPreviewLonLat(raw: { photos?: unknown; track?: unknown }): [number, number][] {
  const photos = raw.photos;
  if (!Array.isArray(photos) || photos.length === 0) return [];

  const track = parseTrackPoints(raw.track);
  const photoCoords: [number, number][] = [];
  const seen = new Set<string>();

  for (const photo of photos) {
    if (!photo || typeof photo !== 'object') continue;
    const record = photo as RawRecord;
    const lat = record.lat;
    const lon = record.lon;

    let coord: [number, number] | null = null;
    const hasExplicitGeo =
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      (lat !== 0 || lon !== 0);

    if (hasExplicitGeo) {
      coord = [lon, lat];
    } else {
      const timeMs = parseIsoTimeMs(record.time);
      if (timeMs === null) continue;
      coord = findTrackPositionAtTime(track, timeMs);
    }

    if (!coord) continue;

    const key = coordKey(coord);
    if (seen.has(key)) continue;
    seen.add(key);
    photoCoords.push(coord);
  }

  return photoCoords;
}

function extractTrackPreviewLonLat(raw: { track?: unknown }): [number, number][] | null {
  const track = parseTrackPoints(raw.track);
  if (track.length === 0) return null;

  const coords = track.map((point) => [point.lon, point.lat] as [number, number]);
  if (coords.length <= MAX_TRACK_PREVIEW_POINTS) return coords;

  const stride = Math.ceil(coords.length / MAX_TRACK_PREVIEW_POINTS);
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += stride) {
    out.push(coords[i]!);
  }

  const last = coords[coords.length - 1]!;
  const prev = out[out.length - 1]!;
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last);
  return out;
}

function tripManifestPlugin(): Plugin {
  const virtualId = 'virtual:trip-manifest';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'trip-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const jsonsDir = path.resolve(__dirname, 'jsons');
      if (!fs.existsSync(jsonsDir)) return 'export default [];';

      const files = fs.readdirSync(jsonsDir).filter((file) => file.endsWith('.json'));
      const manifest = files.map((file) => {
        const raw = JSON.parse(fs.readFileSync(path.join(jsonsDir, file), 'utf-8')) as {
          title?: string;
          date?: string;
          track?: unknown;
          photos?: unknown;
        };

        return {
          file,
          title: raw.title ?? '',
          date: raw.date ?? '',
          preview: extractTrackPreviewLonLat(raw),
          photoPoints: extractPhotoPreviewLonLat(raw),
          sourcePosts: extractSourcePosts(raw),
        };
      });

      return `export default ${JSON.stringify(manifest)};`;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tripManifestPlugin()],
  base: '/travel-replay-app/',
})
