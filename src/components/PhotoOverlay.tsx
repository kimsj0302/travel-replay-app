import { useEffect } from 'react';
import type { TripPhoto } from '../types';

interface PhotoOverlayProps {
  photo: TripPhoto | null;
  activeIndex: number | null;
  totalPhotos: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function PhotoOverlay({
  photo,
  activeIndex,
  totalPhotos,
  onPrev,
  onNext,
  onClose,
}: PhotoOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!photo || activeIndex === null) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, photo, activeIndex]);

  if (!photo || activeIndex === null) {
    return (
      <div className="photo-panel photo-panel--empty">
        <div className="photo-panel-empty-msg">
          <p>지도에서 사진 마커를 누르거나, 타임라인 틱으로 해당 시점에 들어가면 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < totalPhotos - 1;

  return (
    <div className="photo-panel">
      <div className="photo-panel-image-wrap">
        <img src={photo.objectUrl} alt={photo.file.name} className="photo-panel-img" />
      </div>

      <div className="photo-panel-nav-row">
        <button
          type="button"
          className="photo-panel-nav-btn"
          onClick={onPrev}
          disabled={!canPrev}
          title="이전 시각의 사진"
        >
          이전
        </button>
        <span className="photo-panel-nav-count">
          {activeIndex + 1} / {totalPhotos}
        </span>
        <button
          type="button"
          className="photo-panel-nav-btn"
          onClick={onNext}
          disabled={!canNext}
          title="다음 시각의 사진"
        >
          다음
        </button>
      </div>
    </div>
  );
}
