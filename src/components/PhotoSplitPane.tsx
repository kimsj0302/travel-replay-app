import { memo, useRef } from 'react';
import PhotoOverlay from './PhotoOverlay';
import { usePhotoPaneResize } from '../hooks/usePhotoPaneResize';
import { useI18n } from '../i18n/context';
import type { TripPhoto } from '../types';

interface PhotoSplitPaneProps {
  photo: TripPhoto | null;
  activeIndex: number | null;
  totalPhotos: number;
  direction: 'horizontal' | 'vertical';
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

function PhotoSplitPane({
  photo,
  activeIndex,
  totalPhotos,
  direction,
  onPrev,
  onNext,
  onClose,
}: PhotoSplitPaneProps) {
  const { t } = useI18n();
  const asideRef = useRef<HTMLElement | null>(null);
  const { sizePx, onMouseDown, onTouchStart } = usePhotoPaneResize(asideRef, direction);

  const isVert = direction === 'vertical';

  return (
    <>
      <div
        className={`replay-photo-resize-handle ${isVert ? 'replay-photo-resize-handle--horizontal' : ''}`}
        role="separator"
        aria-orientation={isVert ? 'horizontal' : 'vertical'}
        aria-label={t.resizePanel}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      />
      <aside
        ref={asideRef}
        className="replay-photo-pane"
        style={isVert ? { height: sizePx } : { width: sizePx }}
        aria-label={t.photoPanel}
      >
        <PhotoOverlay
          photo={photo}
          activeIndex={activeIndex}
          totalPhotos={totalPhotos}
          onPrev={onPrev}
          onNext={onNext}
          onClose={onClose}
        />
      </aside>
    </>
  );
}

export default memo(PhotoSplitPane);
