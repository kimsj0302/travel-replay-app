import type { Map as MapLibreMap } from 'maplibre-gl';

/** 심볼 레이어에서 참조하는 이미지 ID */
export const PHOTO_PIN_EXIF_ID = 'photo-pin-exif';
export const PHOTO_PIN_INTERP_ID = 'photo-pin-interp';

function pinSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
  <path fill="${fill}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"
    d="M18 2C10.8 2 5 7.8 5 15c0 10 13 31 13 31s13-21 13-31C31 7.8 25.2 2 18 2z"/>
  <circle fill="#ffffff" cx="18" cy="15" r="4"/>
</svg>`;
}

/**
 * 사진 핀 아이콘을 맵에 등록 (심볼 레이어용)
 */
export function registerPhotoPinImages(map: MapLibreMap): Promise<void> {
  return new Promise((resolve, reject) => {
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) resolve();
    };

    const load = (id: string, svg: string) => {
      const img = new Image();
      img.onload = () => {
        if (!map.hasImage(id)) map.addImage(id, img);
        done();
      };
      img.onerror = () => reject(new Error(`Failed to load pin image: ${id}`));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    load(PHOTO_PIN_EXIF_ID, pinSvg('#f97316'));
    load(PHOTO_PIN_INTERP_ID, pinSvg('#94a3b8'));
  });
}
