import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import PlaybackControls from '../components/PlaybackControls';
import PhotoSplitPane from '../components/PhotoSplitPane';
import PhotoOverlay from '../components/PhotoOverlay';
import { usePlayback } from '../hooks/usePlayback';
import { useReplayMapPaneLayout } from '../hooks/useReplayMapPaneLayout';
import { findPositionAtTime } from '../utils/interpolation';
import { sortPhotosByTime } from '../utils/sortPhotos';
import type { Trip } from '../types';

type LayoutMode = 'horizontal' | 'vertical';

interface TripReplayPageProps {
  trip: Trip | null;
}

export default function TripReplayPage({ trip }: TripReplayPageProps) {
  const navigate = useNavigate();
  const { state, position, jumpToPhoto, jumpToTripTimeMs, dismissOverlay } = usePlayback(trip);

  const photosSorted = useMemo(
    () => (trip ? sortPhotosByTime(trip.photos) : []),
    [trip],
  );

  const hasGeoData = useMemo(
    () =>
      !!trip &&
      (trip.track.length > 0 || trip.photos.some((p) => p.gpsSource !== 'none')),
    [trip],
  );

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');

  const mapPaneRef = useRef<HTMLDivElement>(null);
  useReplayMapPaneLayout(mapPaneRef, `${state.activePhotoIndex ?? 'none'}-${layoutMode}`);

  const [markerPan, setMarkerPan] = useState<{ photoIndex: number; seq: number } | null>(null);
  const [coordPan, setCoordPan] = useState<{ lat: number; lon: number; seq: number } | null>(null);

  const toggleLayout = useCallback(() => {
    setLayoutMode((m) => (m === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  const handlePhotoClick = useCallback(
    (idx: number) => {
      jumpToPhoto(idx);
    },
    [jumpToPhoto],
  );

  const handleTimelineJump = useCallback(
    (idx: number) => {
      jumpToPhoto(idx);
      if (!hasGeoData) return;
      setCoordPan(null);
      setMarkerPan((prev) => ({
        photoIndex: idx,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    [jumpToPhoto, hasGeoData],
  );

  const handleGpsTimelineJump = useCallback(
    (tripTimeMs: number) => {
      jumpToTripTimeMs(tripTimeMs);
      setMarkerPan(null);
      if (!trip || trip.track.length === 0) return;
      const start = trip.startTime.getTime();
      const end = trip.endTime.getTime();
      const clamped = Math.min(Math.max(tripTimeMs, start), end);
      const pos = findPositionAtTime(trip.track, new Date(clamped));
      if (pos) {
        setCoordPan((prev) => ({
          lat: pos.lat,
          lon: pos.lon,
          seq: (prev?.seq ?? 0) + 1,
        }));
      }
    },
    [jumpToTripTimeMs, trip],
  );

  const panToPhotoIndex = useCallback(
    (idx: number) => {
      if (!hasGeoData) return;
      setCoordPan(null);
      setMarkerPan((prev) => ({
        photoIndex: idx,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    [hasGeoData],
  );

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
        {hasGeoData && (
          <div className="replay-header-actions">
            <button
              type="button"
              className="layout-toggle-btn"
              onClick={toggleLayout}
              title={layoutMode === 'horizontal' ? '상하 분할로 전환' : '좌우 분할로 전환'}
            >
              {layoutMode === 'horizontal' ? '⬍ 상하' : '⬌ 좌우'}
            </button>
          </div>
        )}
      </header>

      <div className="replay-body">
        {hasGeoData ? (
          <div className={`replay-split replay-split--${layoutMode}`}>
            <div className="replay-map-pane" ref={mapPaneRef}>
              <MapView
                track={trip.track}
                photosSorted={photosSorted}
                currentPosition={position}
                onPhotoClick={handlePhotoClick}
                photoPanelOpen={state.activePhotoIndex !== null}
                panToPhotoMarker={markerPan}
                panToCoordinates={coordPan}
              />
            </div>
            <PhotoSplitPane
              photo={activePhoto}
              activeIndex={state.activePhotoIndex}
              totalPhotos={photosSorted.length}
              direction={layoutMode}
              onPrev={goPrevPhoto}
              onNext={goNextPhoto}
              onClose={dismissOverlay}
            />
          </div>
        ) : (
          <div className="replay-photo-only">
            <PhotoOverlay
              photo={activePhoto}
              activeIndex={state.activePhotoIndex}
              totalPhotos={photosSorted.length}
              onPrev={goPrevPhoto}
              onNext={goNextPhoto}
              onClose={dismissOverlay}
            />
          </div>
        )}
      </div>

      <PlaybackControls
        state={state}
        trip={trip}
        onJumpToPhoto={handleTimelineJump}
        onJumpToTripTime={handleGpsTimelineJump}
      />
    </div>
  );
}
