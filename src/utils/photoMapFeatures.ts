import type { TripPhoto } from '../types';

/**
 * 사진마다 1개 핀 — `sortPhotosByTime`로 넘긴 배열의 인덱스가 photoIndex(재생·클릭과 동일).
 * GPS 좌표가 없는(gpsSource === 'none') 사진은 지도 핀에서 제외한다.
 */
export function buildPhotoMarkerFeatures(photos: TripPhoto[]): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];
  for (let photoIndex = 0; photoIndex < photos.length; photoIndex++) {
    const p = photos[photoIndex];
    if (p.gpsSource === 'none') continue;
    features.push({
      type: 'Feature',
      properties: {
        photoIndex,
        posSource: p.gpsSource === 'exif' ? 'exif' : 'interpolated',
      },
      geometry: {
        type: 'Point',
        coordinates: [p.lon, p.lat],
      },
    });
  }
  return features;
}
