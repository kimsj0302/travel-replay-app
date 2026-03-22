import { useCallback, useEffect, useState } from 'react';
import type { PhotoGroup } from '../types';

interface PhotoOverlayProps {
  group: PhotoGroup;
  onClose: () => void;
}

export default function PhotoOverlay({ group, onClose }: PhotoOverlayProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [group.id]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i < group.photos.length - 1 ? i + 1 : i));
  }, [group.photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose]);

  const photo = group.photos[index];
  if (!photo) return null;

  const multi = group.photos.length > 1;

  return (
    <div className="photo-panel">
      <div className="photo-panel-header">
        <span className="photo-panel-title">사진</span>
        <button type="button" className="photo-panel-close" onClick={onClose} aria-label="닫기">
          &times;
        </button>
      </div>

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
