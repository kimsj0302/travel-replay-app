import { memo, useRef } from 'react';
import PhotoOverlay from './PhotoOverlay';
import { usePhotoPaneResize } from '../hooks/usePhotoPaneResize';
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
  const asideRef = useRef<HTMLElement | null>(null);
  const { sizePx, onMouseDown, onTouchStart } = usePhotoPaneResize(asideRef, direction);

  const isVert = direction === 'vertical';

  return (
    <>
      <div
        className={`replay-photo-resize-handle ${isVert ? 'replay-photo-resize-handle--horizontal' : ''}`}
        role="separator"
        aria-orientation={isVert ? 'horizontal' : 'vertical'}
        aria-label="사진 패널 크기 조절"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      />
      <aside
        ref={asideRef}
        className="replay-photo-pane"
        style={isVert ? { height: sizePx } : { width: sizePx }}
        aria-label="사진 패널"
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
