import { memo, useRef } from 'react';
import PhotoOverlay from './PhotoOverlay';
import { usePhotoPaneWidth } from '../hooks/usePhotoPaneWidth';
import type { TripPhoto } from '../types';

interface PhotoSplitPaneProps {
  photo: TripPhoto | null;
  activeIndex: number | null;
  totalPhotos: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

function PhotoSplitPane({
  photo,
  activeIndex,
  totalPhotos,
  onPrev,
  onNext,
  onClose,
}: PhotoSplitPaneProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  const { widthPx, onResizeStart } = usePhotoPaneWidth(asideRef);

  return (
    <>
      <div
        className="replay-photo-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="사진 패널 너비 조절"
        onMouseDown={onResizeStart}
      />
      <aside
        ref={asideRef}
        className="replay-photo-pane"
        style={{ width: widthPx }}
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
