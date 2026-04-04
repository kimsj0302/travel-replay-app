import { useEffect, useState } from 'react';
import type { TripPhoto } from '../types';
import { getPhotoSrc, getPhotoName } from '../types';

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
  const [loading, setLoading] = useState(false);
  const src = photo ? getPhotoSrc(photo) : '';

  useEffect(() => {
    if (!src) return;
    setLoading(true);
  }, [src]);

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
          <p>타임라인의 주황 틱을 클릭하면 해당 시점의 사진이 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < totalPhotos - 1;

  return (
    <div className="photo-panel">
      <div className="photo-panel-image-wrap">
        {loading && (
          <div className="photo-panel-loading">
            <div className="photo-panel-spinner" />
            <span>로딩 중...</span>
          </div>
        )}
        <img
          src={src}
          alt={getPhotoName(photo)}
          className="photo-panel-img"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          style={loading ? { opacity: 0 } : undefined}
        />
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
