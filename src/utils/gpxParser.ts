import type { TrackPoint } from '../types';

export async function parseGpxFile(file: File): Promise<TrackPoint[]> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`GPX parse error: ${parseError.textContent}`);
  }

  const points: TrackPoint[] = [];
  const trkpts = doc.querySelectorAll('trkpt');

  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '');
    const lon = parseFloat(pt.getAttribute('lon') ?? '');
    const timeEl = pt.querySelector('time');
    const eleEl = pt.querySelector('ele');

    if (isNaN(lat) || isNaN(lon) || !timeEl?.textContent) return;

    const time = new Date(timeEl.textContent);
    if (isNaN(time.getTime())) return;

    const ele = eleEl?.textContent ? parseFloat(eleEl.textContent) : undefined;

    points.push({ time, lat, lon, ele });
  });

  points.sort((a, b) => a.time.getTime() - b.time.getTime());
  return points;
}

export async function parseMultipleGpxFiles(files: File[]): Promise<TrackPoint[]> {
  const allPoints: TrackPoint[] = [];
  for (const file of files) {
    const pts = await parseGpxFile(file);
    allPoints.push(...pts);
  }
  allPoints.sort((a, b) => a.time.getTime() - b.time.getTime());
  return allPoints;
}
