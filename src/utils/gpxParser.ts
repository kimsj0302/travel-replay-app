import type { TrackPoint } from '../types';

function pushPointFromGpxElement(
  points: TrackPoint[],
  pt: Element,
  syntheticTimeBase: number,
  index: number,
): void {
  const lat = parseFloat(pt.getAttribute('lat') ?? '');
  const lon = parseFloat(pt.getAttribute('lon') ?? '');
  if (isNaN(lat) || isNaN(lon)) return;

  const timeEl = pt.querySelector('time');
  const eleEl = pt.querySelector('ele');

  let time: Date;
  if (timeEl?.textContent) {
    const parsed = new Date(timeEl.textContent);
    time = isNaN(parsed.getTime()) ? new Date(syntheticTimeBase + index * 1000) : parsed;
  } else {
    /** `<time>` 없는 trkpt/rtept도 많음 — 순서 기준 가짜 시각으로라도 트랙 유지 */
    time = new Date(syntheticTimeBase + index * 1000);
  }

  let ele: number | undefined;
  if (eleEl?.textContent) {
    const e = parseFloat(eleEl.textContent);
    ele = isNaN(e) ? undefined : e;
  }
  if (ele !== undefined) {
    points.push({ time, lat, lon, ele });
  } else {
    points.push({ time, lat, lon });
  }
}

export async function parseGpxFile(file: File): Promise<TrackPoint[]> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`GPX parse error: ${parseError.textContent}`);
  }

  const points: TrackPoint[] = [];
  const syntheticTimeBase = Date.now();

  const trkpts = doc.querySelectorAll('trkpt');
  trkpts.forEach((pt, i) => pushPointFromGpxElement(points, pt, syntheticTimeBase, i));

  /** 일부 기기/앱은 `<trkpt>` 대신 경로만 `<rtept>` 로 내보냄 */
  const rtepts = doc.querySelectorAll('rtept');
  const offset = trkpts.length;
  rtepts.forEach((pt, i) => pushPointFromGpxElement(points, pt, syntheticTimeBase, offset + i));

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
