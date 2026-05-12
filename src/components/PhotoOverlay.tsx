import { useEffect, useState } from 'react';
import type { TripPhoto } from '../types';
import { getPhotoSrc, getPhotoName } from '../types';
import { useI18n } from '../i18n/context';

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
  const { t } = useI18n();
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
          <p>{t.photoEmptyHint}</p>
        </div>
      </div>
    );
  }

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < totalPhotos - 1;
  const sourceUrl = photo.sourceUrl?.trim() ?? '';
  const hasSourceUrl = sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://');

  return (
    <div className="photo-panel">
      <div className="photo-panel-image-wrap">
        {src && loading && (
          <div className="photo-panel-loading">
            <div className="photo-panel-spinner" />
            <span>{t.loadingPhoto}</span>
          </div>
        )}
        {src ? (
          <img
            src={src}
            alt={getPhotoName(photo)}
            className="photo-panel-img"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={loading ? { opacity: 0 } : undefined}
          />
        ) : (
          <div className="photo-panel-empty-msg">
            <p>{hasSourceUrl ? t.openSourcePostTitle : t.photoEmptyHint}</p>
          </div>
        )}
      </div>

      <div className="photo-panel-nav-row">
        <button
          type="button"
          className="photo-panel-nav-btn"
          onClick={onPrev}
          disabled={!canPrev}
          title={t.prevPhotoTitle}
        >
          {t.prev}
        </button>
        <span className="photo-panel-nav-count">
          {activeIndex + 1} / {totalPhotos}
        </span>
        <button
          type="button"
          className="photo-panel-nav-btn"
          onClick={onNext}
          disabled={!canNext}
          title={t.nextPhotoTitle}
        >
          {t.next}
        </button>
        {hasSourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="photo-panel-source-link"
            title={t.openSourcePostTitle}
            aria-label={t.openSourcePostTitle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3h7v7" />
              <path d="M10 14 21 3" />
              <path d="M21 14v7H3V3h7" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
