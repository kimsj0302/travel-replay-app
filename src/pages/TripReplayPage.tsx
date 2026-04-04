import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView, { checkWebGLSupport } from '../components/MapView';
import PlaybackControls from '../components/PlaybackControls';
import PhotoSplitPane from '../components/PhotoSplitPane';
import PhotoOverlay from '../components/PhotoOverlay';
import { usePlayback } from '../hooks/usePlayback';
import { useReplayMapPaneLayout } from '../hooks/useReplayMapPaneLayout';
import { findPositionAtTime } from '../utils/interpolation';
import { sortPhotosByTime } from '../utils/sortPhotos';
import { loadTripFromJson } from '../utils/loadTripFromJson';
import { useI18n } from '../i18n/context';
import tripManifest from 'virtual:trip-manifest';
import type { Trip } from '../types';

const webglSupported = checkWebGLSupport();

type LayoutMode = 'horizontal' | 'vertical';

interface SavedTrip {
  key: string;
  label: string;
  load: () => Promise<unknown>;
}

const tripLoaders = import.meta.glob('/jsons/*.json') as Record<string, () => Promise<{ default: unknown }>>;

const savedTrips: SavedTrip[] = tripManifest.map((entry) => {
  const globKey = `/jsons/${entry.file}`;
  return {
    key: globKey,
    label: `${entry.date} - ${entry.title}`,
    load: async () => {
      const loader = tripLoaders[globKey];
      if (!loader) throw new Error(`File not found: ${entry.file}`);
      const mod = await loader();
      return mod.default ?? mod;
    },
  };
});

interface TripReplayPageProps {
  trip: Trip | null;
  onTripLoaded: (trip: Trip) => void;
}

export default function TripReplayPage({ trip, onTripLoaded }: TripReplayPageProps) {
  const navigate = useNavigate();
  const { lang, t, toggleLang } = useI18n();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const savedMenuRef = useRef<HTMLDivElement>(null);

  const { state, position, jumpToPhoto, jumpToTripTimeMs, dismissOverlay } = usePlayback(trip);

  const photosSorted = useMemo(
    () => (trip ? sortPhotosByTime(trip.photos) : []),
    [trip],
  );

  const hasGeoData = useMemo(
    () =>
      webglSupported &&
      !!trip &&
      (trip.track.length > 0 || trip.photos.some((p) => p.gpsSource !== 'none')),
    [trip],
  );

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');

  const mapPaneRef = useRef<HTMLDivElement>(null);
  useReplayMapPaneLayout(mapPaneRef, `${state.activePhotoIndex ?? 'none'}-${layoutMode}`);

  const [markerPan, setMarkerPan] = useState<{ photoIndex: number; seq: number } | null>(null);
  const [coordPan, setCoordPan] = useState<{ lat: number; lon: number; seq: number } | null>(null);

  useEffect(() => {
    if (!savedOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (savedMenuRef.current && !savedMenuRef.current.contains(e.target as Node)) {
        setSavedOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [savedOpen]);

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

  const handleJsonUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportLoading(true);
      setImportError(null);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const loaded = loadTripFromJson(json);
        onTripLoaded(loaded);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : t.jsonParseFailed);
      } finally {
        setImportLoading(false);
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    },
    [onTripLoaded, t],
  );

  const handleSavedTripSelect = useCallback(
    async (saved: SavedTrip) => {
      setSavedOpen(false);
      setImportLoading(true);
      setImportError(null);
      try {
        const json = await saved.load();
        const loaded = loadTripFromJson(json);
        onTripLoaded(loaded);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : t.savedTripLoadFailed);
      } finally {
        setImportLoading(false);
      }
    },
    [onTripLoaded, t],
  );

  const langToggle = (
    <button className="lang-toggle-btn" onClick={toggleLang}>
      {lang === 'ko' ? 'EN' : '한국어'}
    </button>
  );

  const headerActions = (
    <div className="replay-header-actions">
      {savedTrips.length > 0 && (
        <div className="saved-trip-menu" ref={savedMenuRef}>
          <button
            className="header-action-btn"
            onClick={() => setSavedOpen((o) => !o)}
            disabled={importLoading}
          >
            {importLoading ? t.loading : t.savedTrips}
            <span className="dropdown-arrow">{savedOpen ? '▲' : '▼'}</span>
          </button>
          {savedOpen && (
            <ul className="saved-trip-dropdown">
              {savedTrips.map((s) => (
                <li key={s.key}>
                  <button onClick={() => handleSavedTripSelect(s)}>{s.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        className="header-action-btn"
        onClick={() => jsonInputRef.current?.click()}
        disabled={importLoading}
      >
        {t.loadJsonFile}
      </button>
      <button
        className="header-action-btn header-action-btn--accent"
        onClick={() => navigate('/extract')}
      >
        {t.imageToJson}
      </button>
      {langToggle}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleJsonUpload}
      />
    </div>
  );

  if (!trip) {
    return (
      <div className="replay-page">
        <header className="replay-header">
          <h2 className="replay-title">Travel Replay</h2>
          {headerActions}
        </header>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <h2>{t.loadTripPrompt}</h2>
          <p>{t.loadTripDesc}</p>
          {importError && <p className="error-msg">{importError}</p>}
        </div>
      </div>
    );
  }

  const activePhoto =
    state.activePhotoIndex !== null ? photosSorted[state.activePhotoIndex] ?? null : null;

  return (
    <div className="replay-page">
      <header className="replay-header">
        <h2>{trip.title}</h2>
        <span className="trip-date">{trip.date}</span>
        {headerActions}
        {hasGeoData && (
          <button
            type="button"
            className="layout-toggle-btn"
            onClick={toggleLayout}
            title={layoutMode === 'horizontal' ? t.switchToVertical : t.switchToHorizontal}
          >
            {layoutMode === 'horizontal' ? t.layoutVertical : t.layoutHorizontal}
          </button>
        )}
      </header>

      {importError && <p className="error-msg" style={{ padding: '0 16px' }}>{importError}</p>}

      {!webglSupported && (
        <div className="webgl-banner">
          {t.webglBanner}
        </div>
      )}

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
