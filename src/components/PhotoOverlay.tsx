import { useCallback, useEffect, useState } from 'react';
import type { PhotoGroup } from '../types';

interface PhotoOverlayProps {
  group: PhotoGroup | null;
  onClose: () => void;
}

export default function PhotoOverlay({ group, onClose }: PhotoOverlayProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [group?.id]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    if (!group) return;
    setIndex((i) => (i < group.photos.length - 1 ? i + 1 : i));
  }, [group]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!group) return;
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose, group]);

  if (!group || group.photos.length === 0) {
    return (
      <div className="photo-panel photo-panel--empty">
        <div className="photo-panel-empty-msg">
          <p>지도에서 사진 마커를 누르거나, 재생·타임라인으로 해당 구간에 들어가면 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const photo = group.photos[index];
  if (!photo) return null;

  const multi = group.photos.length > 1;

  return (
    <div className="photo-panel">
      <div className="photo-panel-image-wrap">
        <img src={photo.objectUrl} alt={photo.file.name} className="photo-panel-img" />
      </div>

      {multi && (
        <div className="photo-panel-nav-row">
          <button
            type="button"
            className="photo-panel-nav-btn"
            onClick={goPrev}
            disabled={index === 0}
          >
            이전
          </button>
          <span className="photo-panel-nav-count">
            {index + 1} / {group.photos.length}
          </span>
          <button
            type="button"
            className="photo-panel-nav-btn"
            onClick={goNext}
            disabled={index === group.photos.length - 1}
          >
            다음
          </button>
        </div>
      )}

      {multi && (
        <div className="photo-dots">
          {group.photos.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`dot ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 사진`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
