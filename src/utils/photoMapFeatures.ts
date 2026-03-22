import type { PhotoGroup } from '../types';

/**
 * 사진 마커: EXIF에 좌표가 있으면 각 사진의 실제 위치에 점을 찍고,
 * GPX로만 보간된 그룹은 트랙 상 그룹 대표 좌표 1개만 표시.
 */
export function buildPhotoGroupMarkerFeatures(groups: PhotoGroup[]): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];

  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    const exifPhotos = g.photos.filter((p) => p.gpsSource === 'exif');

    if (exifPhotos.length > 0) {
      for (const p of exifPhotos) {
        features.push({
          type: 'Feature',
          properties: {
            groupIndex: idx,
            photoCount: g.photos.length,
            posSource: 'exif',
          },
          geometry: {
            type: 'Point',
            coordinates: [p.lon, p.lat],
          },
        });
      }
    } else {
      features.push({
        type: 'Feature',
        properties: {
          groupIndex: idx,
          photoCount: g.photos.length,
          posSource: 'interpolated',
        },
        geometry: {
          type: 'Point',
          coordinates: [g.lon, g.lat],
        },
      });
    }
  }

  return features;
}
