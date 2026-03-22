import type { TripPhoto } from '../types';

/**
 * 사진마다 1개 핀 — `sortPhotosByTime`로 넘긴 배열의 인덱스가 photoIndex(재생·클릭과 동일).
 */
export function buildPhotoMarkerFeatures(photos: TripPhoto[]): GeoJSON.Feature[] {
  return photos.map((p, photoIndex) => ({
    type: 'Feature',
    properties: {
      photoIndex,
      posSource: p.gpsSource === 'exif' ? 'exif' : 'interpolated',
    },
    geometry: {
      type: 'Point',
      coordinates: [p.lon, p.lat],
    },
  }));
}
