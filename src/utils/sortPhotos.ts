import type { TripPhoto } from '../types';
import { getPhotoName } from '../types';

/** 재생·타임라인·핀 인덱스 일치 */
export function sortPhotosByTime(photos: TripPhoto[]): TripPhoto[] {
  return [...photos].sort((a, b) => {
    const t = a.time.getTime() - b.time.getTime();
    if (t !== 0) return t;
    return getPhotoName(a).localeCompare(getPhotoName(b));
  });
}
