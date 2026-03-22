import { memo, useRef } from 'react';
import PhotoOverlay from './PhotoOverlay';
import { usePhotoPaneWidth } from '../hooks/usePhotoPaneWidth';
import type { PhotoGroup } from '../types';

interface PhotoSplitPaneProps {
  group: PhotoGroup;
  onClose: () => void;
}

function PhotoSplitPane({ group, onClose }: PhotoSplitPaneProps) {
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
        <PhotoOverlay group={group} onClose={onClose} />
      </aside>
    </>
  );
}

export default memo(PhotoSplitPane);
