import type { TrackPoint, Trip, TripPhoto } from '../types';
import { getPhotoName } from '../types';
import { findTimeBracketIndices } from './interpolation';
import { haversineMeters } from './geoMath';
import { sortPhotosByTime } from './sortPhotos';

/** 브래킷 두 정점이 같은 위치인지 (GPX 중복 trkpt 등) */
function sameLatLon(a: TrackPoint, b: TrackPoint): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

/**
 * **GPX 시각 구간 [lo, hi] 안에서만** 처리. 전 트랙 스캔 없음.
 * - A·B가 서로 다른 좌표: min(dLo,dHi), 한쪽 0이면 max(다른 끝까지).
 * - A·B가 같은 좌표(또는 lo===hi): 구간 길이 0 → 거리 0, 기준 정점은 `lo`.
 */
function distancePhotoToTimeBracketGpsMeters(
  pLat: number,
  pLon: number,
  track: TrackPoint[],
  lo: number,
  hi: number,
): {
  distanceM: number;
  nearestIndexForMetric: number;
  dLo: number;
  dHi: number;
} {
  const A = track[lo];
  const B = track[hi];
  const dLo = haversineMeters(pLat, pLon, A.lat, A.lon);
  const dHi = haversineMeters(pLat, pLon, B.lat, B.lon);

  if (sameLatLon(A, B)) {
    return {
      distanceM: 0,
      nearestIndexForMetric: lo,
      dLo,
      dHi,
    };
  }

  const minD = Math.min(dLo, dHi);
  const maxD = Math.max(dLo, dHi);

  if (minD > 0) {
    return {
      distanceM: minD,
      nearestIndexForMetric: dLo <= dHi ? lo : hi,
      dLo,
      dHi,
    };
  }

  if (maxD > 0) {
    const nearestIndexForMetric = dLo === 0 ? hi : lo;
    return {
      distanceM: maxD,
      nearestIndexForMetric,
      dLo,
      dHi,
    };
  }

  return { distanceM: 0, nearestIndexForMetric: lo, dLo, dHi };
}

/** 리포트용: 브래킷이 공간적으로 0이면 보간이 위치를 바꾸지 않음 → track_stationary */
export type PhotoGpsReportSource = 'exif' | 'interpolated' | 'track_stationary';

function resolveReportGpsSource(
  tripGpsSource: TripPhoto['gpsSource'],
  track: TrackPoint[],
  lo: number,
  hi: number,
): PhotoGpsReportSource {
  if (tripGpsSource === 'exif') return 'exif';
  if (sameLatLon(track[lo], track[hi])) return 'track_stationary';
  return 'interpolated';
}

export interface PhotoGpsProximityRow {
  photoIndex: number;
  filename: string;
  photoLat: number;
  photoLon: number;
  photoTimeISO: string;
  photoTimeLocalKo: string;
  /** 시각 보간에 사용된 트랙 구간 */
  bracketLoIndex: number;
  bracketHiIndex: number;
  distanceToBracketLoM: number;
  distanceToBracketHiM: number;
  /** 위 두 정점 중에서 위 규칙으로 고른 “기준 정점” */
  nearestGpsIndex: number;
  nearestGpsLat: number;
  nearestGpsLon: number;
  nearestGpsTimeISO: string;
  nearestGpsTimeLocalKo: string;
  timeDiffSecondsPhotoMinusGps: number;
  /**
   * 시각 구간 [bracketLo, bracketHi] **안에서만** 계산. A·B 동일 좌표면 0.
   */
  distancePhotoToNearestGpsMeters: number;
  /** EXIF 파이프라인 원본 (`TripPhoto.gpsSource`) */
  tripPhotoGpsSource: TripPhoto['gpsSource'];
  /** 분석용: A·B가 같은 점이면 `track_stationary` (interpolation 아님) */
  gpsSource: PhotoGpsReportSource;
}

export function buildPhotoGpsProximityReport(trip: Trip): PhotoGpsProximityRow[] {
  const sorted = sortPhotosByTime(trip.photos);
  const track = trip.track;

  return sorted.map((p, photoIndex) => {
    const bracket = findTimeBracketIndices(track, p.time);
    if (!bracket) {
      return {
        photoIndex,
        filename: getPhotoName(p),
        photoLat: p.lat,
        photoLon: p.lon,
        photoTimeISO: p.time.toISOString(),
        photoTimeLocalKo: p.time.toLocaleString('ko-KR', { hour12: false }),
        bracketLoIndex: -1,
        bracketHiIndex: -1,
        distanceToBracketLoM: NaN,
        distanceToBracketHiM: NaN,
        nearestGpsIndex: -1,
        nearestGpsLat: NaN,
        nearestGpsLon: NaN,
        nearestGpsTimeISO: '',
        nearestGpsTimeLocalKo: '',
        timeDiffSecondsPhotoMinusGps: NaN,
        distancePhotoToNearestGpsMeters: NaN,
        tripPhotoGpsSource: p.gpsSource,
        gpsSource: p.gpsSource === 'exif' ? 'exif' : 'interpolated',
      };
    }

    const { lo, hi } = bracket;
    const {
      distanceM,
      nearestIndexForMetric,
      dLo,
      dHi,
    } = distancePhotoToTimeBracketGpsMeters(p.lat, p.lon, track, lo, hi);

    const nv = track[nearestIndexForMetric]!;
    const timeDiffSec = (p.time.getTime() - nv.time.getTime()) / 1000;
    const gpsReport = resolveReportGpsSource(p.gpsSource, track, lo, hi);

    return {
      photoIndex,
      filename: getPhotoName(p),
      photoLat: p.lat,
      photoLon: p.lon,
      photoTimeISO: p.time.toISOString(),
      photoTimeLocalKo: p.time.toLocaleString('ko-KR', { hour12: false }),
      bracketLoIndex: lo,
      bracketHiIndex: hi,
      distanceToBracketLoM: dLo,
      distanceToBracketHiM: dHi,
      nearestGpsIndex: nearestIndexForMetric,
      nearestGpsLat: nv.lat,
      nearestGpsLon: nv.lon,
      nearestGpsTimeISO: nv.time.toISOString(),
      nearestGpsTimeLocalKo: nv.time.toLocaleString('ko-KR', { hour12: false }),
      timeDiffSecondsPhotoMinusGps: timeDiffSec,
      distancePhotoToNearestGpsMeters: distanceM,
      tripPhotoGpsSource: p.gpsSource,
      gpsSource: gpsReport,
    };
  });
}

/** CSV: 거리는 항상 소수 형태로 보이게 (정수여도 `12.0` 등) */
function numToCsvDistanceMeters(n: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0.0';
  const s = String(n);
  if (s.includes('e') || s.includes('E')) {
    return n.toFixed(10).replace(/\.?0+$/, '');
  }
  if (!s.includes('.')) return `${s}.0`;
  return s;
}

/**
 * CSV 셀용: IEEE 754 binary64 (`String(n)`).
 */
function numToCsv(n: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return String(n);
  return String(n);
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function photoGpsReportToCsv(rows: PhotoGpsProximityRow[]): string {
  const headers = [
    'photoIndex',
    'filename',
    'photo_lat',
    'photo_lon',
    'photo_time_ISO',
    'photo_time_local_ko',
    'bracket_lo_index',
    'bracket_hi_index',
    'distance_to_bracket_lo_m',
    'distance_to_bracket_hi_m',
    'nearest_gps_index',
    'nearest_gps_lat',
    'nearest_gps_lon',
    'nearest_gps_time_ISO',
    'nearest_gps_time_local_ko',
    'time_diff_sec_photo_minus_gps',
    'distance_photo_to_nearest_gps_m',
    'trip_photo_gps_source',
    'gps_source',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    const cells = [
      String(r.photoIndex),
      escapeCsvCell(r.filename),
      numToCsv(r.photoLat),
      numToCsv(r.photoLon),
      escapeCsvCell(r.photoTimeISO),
      escapeCsvCell(r.photoTimeLocalKo),
      String(r.bracketLoIndex),
      String(r.bracketHiIndex),
      numToCsvDistanceMeters(r.distanceToBracketLoM),
      numToCsvDistanceMeters(r.distanceToBracketHiM),
      String(r.nearestGpsIndex),
      numToCsv(r.nearestGpsLat),
      numToCsv(r.nearestGpsLon),
      escapeCsvCell(r.nearestGpsTimeISO),
      escapeCsvCell(r.nearestGpsTimeLocalKo),
      numToCsv(r.timeDiffSecondsPhotoMinusGps),
      numToCsvDistanceMeters(r.distancePhotoToNearestGpsMeters),
      r.tripPhotoGpsSource,
      r.gpsSource,
    ];
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPhotoGpsReport(trip: Trip): void {
  const rows = buildPhotoGpsProximityReport(trip);
  const base = `${trip.id}-photo-gps-proximity`;
  const csv = '\uFEFF' + photoGpsReportToCsv(rows);
  downloadTextFile(csv, `${base}.csv`, 'text/csv;charset=utf-8');

  const json = JSON.stringify(
    {
      tripId: trip.id,
      title: trip.title,
      trackPointCount: trip.track.length,
      photoCount: rows.length,
      note:
        'distance: GPX 시각 구간 [lo,hi]만 사용. A·B 좌표 동일이면 0. gps_source: A·B 동일 시 trip이 interpolated여도 track_stationary. trip_photo_gps_source: TripPhoto 원본.',
      rows,
    },
    null,
    2,
  );
  window.setTimeout(() => {
    downloadTextFile(json, `${base}.json`, 'application/json');
  }, 200);
}
