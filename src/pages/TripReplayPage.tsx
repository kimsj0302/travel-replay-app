import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import PlaybackControls from '../components/PlaybackControls';
import PhotoSplitPane from '../components/PhotoSplitPane';
import { usePlayback } from '../hooks/usePlayback';
import { useReplayMapPaneLayout } from '../hooks/useReplayMapPaneLayout';
import { tripToJson, tripToIndexEntry, downloadJson } from '../utils/exportJson';
import { sortPhotosByTime } from '../utils/sortPhotos';
import type { Trip } from '../types';

interface TripReplayPageProps {
  trip: Trip | null;
}

export default function TripReplayPage({ trip }: TripReplayPageProps) {
  const navigate = useNavigate();
  const { state, position, jumpToPhoto, dismissOverlay } = usePlayback(trip);

  const photosSorted = useMemo(
    () => (trip ? sortPhotosByTime(trip.photos) : []),
    [trip],
  );

  const mapPaneRef = useRef<HTMLDivElement>(null);
  useReplayMapPaneLayout(mapPaneRef, `${state.activePhotoIndex ?? 'none'}`);

  const [markerPan, setMarkerPan] = useState<{ photoIndex: number; seq: number } | null>(null);

  const handlePhotoClick = useCallback(
    (idx: number) => {
      jumpToPhoto(idx);
    },
    [jumpToPhoto],
  );

  const handleTimelineJump = useCallback(
    (idx: number) => {
      jumpToPhoto(idx);
      setMarkerPan((prev) => ({
        photoIndex: idx,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    [jumpToPhoto],
  );

  const panToPhotoIndex = useCallback((idx: number) => {
    setMarkerPan((prev) => ({
      photoIndex: idx,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  const goPrevPhoto = useCallback(() => {
    const i = state.activePhotoIndex;
    if (i === null || i <= 0) return;
    const idx = i - 1;
    jumpToPhoto(idx);
    panToPhotoIndex(idx);
  }, [jumpToPhoto, panToPhotoIndex, state.activePhotoIndex]);

  const goNextPhoto = useCallback(() => {
    const i = state.activePhotoIndex;
    if (i === null) return;
    if (i >= photosSorted.length - 1) return;
    const idx = i + 1;
    jumpToPhoto(idx);
    panToPhotoIndex(idx);
  }, [jumpToPhoto, panToPhotoIndex, photosSorted.length, state.activePhotoIndex]);

  const handleExport = useCallback(() => {
    if (!trip) return;
    downloadJson(tripToJson(trip), `${trip.id}-trip.json`);
    downloadJson(tripToIndexEntry(trip), `${trip.id}-index-entry.json`);
  }, [trip]);

  if (!trip) {
    return (
      <div className="no-trip">
        <p>먼저 여행 폴더를 불러와 주세요.</p>
        <button onClick={() => navigate('/')}>돌아가기</button>
      </div>
    );
  }

  const activePhoto =
    state.activePhotoIndex !== null ? photosSorted[state.activePhotoIndex] ?? null : null;

  return (
    <div className="replay-page">
      <header className="replay-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 돌아가기
        </button>
        <h2>{trip.title}</h2>
        <span className="trip-date">{trip.date}</span>
        <button className="export-btn" onClick={handleExport} title="JSON 내보내기">
          ⬇ Export
        </button>
      </header>

      <div className="replay-body">
        <div className="replay-split replay-split--with-photo">
          <div className="replay-map-pane" ref={mapPaneRef}>
            <MapView
              track={trip.track}
              photosSorted={photosSorted}
              currentPosition={position}
              onPhotoClick={handlePhotoClick}
              photoPanelOpen={state.activePhotoIndex !== null}
              panToPhotoMarker={markerPan}
            />
          </div>
          <PhotoSplitPane
            photo={activePhoto}
            activeIndex={state.activePhotoIndex}
            totalPhotos={photosSorted.length}
            onPrev={goPrevPhoto}
            onNext={goNextPhoto}
            onClose={dismissOverlay}
          />
        </div>
      </div>

      <PlaybackControls state={state} trip={trip} onJumpToPhoto={handleTimelineJump} />
    </div>
  );
}
