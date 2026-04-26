import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView, { checkWebGLSupport } from '../components/MapView';
import PlaybackControls from '../components/PlaybackControls';
import PhotoSplitPane from '../components/PhotoSplitPane';
import PhotoOverlay from '../components/PhotoOverlay';
import { usePlayback } from '../hooks/usePlayback';
import { useReplayMapPaneLayout } from '../hooks/useReplayMapPaneLayout';
import { sortPhotosByTime } from '../utils/sortPhotos';
import { loadTripFromJson } from '../utils/loadTripFromJson';
import { useI18n } from '../i18n/context';
import tripManifest from 'virtual:trip-manifest';
import { getPhotoSrc, type Trip } from '../types';

const webglSupported = checkWebGLSupport();
const PHOTO_PRELOAD_CONCURRENCY = 4;

type LayoutMode = 'horizontal' | 'vertical';

interface SavedTrip {
  key: string;
  date: string;
  label: string;
  load: () => Promise<unknown>;
}

const tripLoaders = import.meta.glob('/jsons/*.json') as Record<string, () => Promise<{ default: unknown }>>;

function IconModalClose() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Side-by-side layout control: switch to stacked (map / photos). */
function IconLayoutToVertical() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
    </svg>
  );
}

/** Stacked layout control: switch to map | photos. */
function IconLayoutToHorizontal() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="3" width="7" height="18" rx="2" />
      <rect x="13" y="3" width="7" height="18" rx="2" />
    </svg>
  );
}

const savedTrips: SavedTrip[] = tripManifest
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date, 'ko'))
  .map((entry) => {
    const globKey = `/jsons/${entry.file}`;
    return {
      key: globKey,
      date: entry.date,
      label: `${entry.date} - ${entry.title}`,
      load: async () => {
        const loader = tripLoaders[globKey];
        if (!loader) throw new Error(`File not found: ${entry.file}`);
        const mod = await loader();
        return mod.default ?? mod;
      },
    };
  });

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preloadedPhotoCount, setPreloadedPhotoCount] = useState(0);
  const [preloadTotalCount, setPreloadTotalCount] = useState(0);
  const [showPreloadDetails, setShowPreloadDetails] = useState(false);

  const { state, position, jumpToPhoto, dismissOverlay } = usePlayback(trip);

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
    if (!settingsOpen && !savedOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setSavedOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, savedOpen]);

  useEffect(() => {
    if (photosSorted.length === 0) {
      setPreloadedPhotoCount(0);
      setPreloadTotalCount(0);
      return;
    }

    const sources = Array.from(
      new Set(
        photosSorted
          .map((photo) => getPhotoSrc(photo))
          .filter((src) => src.length > 0),
      ),
    );

    setPreloadedPhotoCount(0);
    setPreloadTotalCount(sources.length);

    if (sources.length === 0) return;

    let cancelled = false;
    let nextIndex = 0;

    const worker = async () => {
      while (!cancelled) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const src = sources[currentIndex];
        if (!src) break;
        await preloadImage(src);
        if (!cancelled) {
          setPreloadedPhotoCount((count) => count + 1);
        }
      }
    };

    const start = window.setTimeout(() => {
      const workers = Array.from(
        { length: Math.min(PHOTO_PRELOAD_CONCURRENCY, sources.length) },
        () => worker(),
      );
      void Promise.all(workers);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [photosSorted]);

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

  const savedTripsModal =
    savedOpen &&
    savedTrips.length > 0 && (
      <div
        className="replay-settings-overlay"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSavedOpen(false);
        }}
      >
        <div
          className="replay-settings-window"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replay-saved-trips-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="replay-settings-window-header">
            <h2 id="replay-saved-trips-title">{t.savedTrips}</h2>
            <button
              type="button"
              className="replay-settings-close"
              onClick={() => setSavedOpen(false)}
              aria-label={t.settingsCloseAria}
            >
              <IconModalClose />
            </button>
          </div>
          <div className="replay-saved-trips-list">
            {savedTrips.map((s) => (
              <button
                key={s.key}
                type="button"
                className="replay-saved-trip-item"
                onClick={() => handleSavedTripSelect(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  const settingsModal = settingsOpen && (
    <div
      className="replay-settings-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
    >
      <div
        className="replay-settings-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="replay-settings-window-header">
          <h2 id="replay-settings-title">{t.settingsTitle}</h2>
          <button
            type="button"
            className="replay-settings-close"
            onClick={() => setSettingsOpen(false)}
            aria-label={t.settingsCloseAria}
          >
            <IconModalClose />
          </button>
        </div>
        <div className="replay-settings-window-body">
          <button
            type="button"
            className="replay-settings-action-btn"
            disabled={importLoading}
            onClick={() => {
              setSettingsOpen(false);
              jsonInputRef.current?.click();
            }}
          >
            {t.loadJsonFile}
          </button>
          <button
            type="button"
            className="replay-settings-action-btn replay-settings-action-btn--accent"
            onClick={() => {
              setSettingsOpen(false);
              navigate('/extract');
            }}
          >
            {t.imageToJson}
          </button>
          <button
            type="button"
            className="replay-settings-action-btn"
            onClick={() => {
              setSettingsOpen(false);
              navigate('/gpx-editor');
            }}
          >
            {t.gpxEditor}
          </button>
          <div className="replay-settings-lang">
            <span className="replay-settings-lang-label">{t.languageLabel}</span>
            <button type="button" className="replay-settings-action-btn replay-settings-action-btn--lang" onClick={toggleLang}>
              {lang === 'ko' ? 'English' : '한국어'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const settingsGear = (
    <button
      type="button"
      className="replay-settings-gear-btn"
      onClick={() => {
        setSavedOpen(false);
        setSettingsOpen((o) => !o);
      }}
      aria-expanded={settingsOpen}
      aria-label={t.settingsOpenAria}
      title={t.settingsOpenAria}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </button>
  );

  const headerSaved = (
    <div className="replay-header-actions">
      {savedTrips.length > 0 && (
        <button
          type="button"
          className="header-action-btn"
          onClick={() => {
            setSettingsOpen(false);
            setSavedOpen((o) => !o);
          }}
          disabled={importLoading}
          aria-expanded={savedOpen}
        >
          {importLoading ? t.loading : t.savedTrips}
        </button>
      )}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleJsonUpload}
      />
    </div>
  );

  const headerTrailing = (
    <div className="replay-header-trailing">
      {trip && hasGeoData && (
        <button
          type="button"
          className="layout-toggle-btn"
          onClick={toggleLayout}
          title={layoutMode === 'horizontal' ? t.switchToVertical : t.switchToHorizontal}
          aria-label={layoutMode === 'horizontal' ? t.switchToVertical : t.switchToHorizontal}
        >
          {layoutMode === 'horizontal' ? <IconLayoutToVertical /> : <IconLayoutToHorizontal />}
        </button>
      )}
      {settingsGear}
    </div>
  );

  if (!trip) {
    return (
      <div className="replay-page">
        <header className="replay-header">
          <h2 className="replay-title">Travel Replay</h2>
          {headerSaved}
          {headerTrailing}
        </header>
        {settingsModal}
        {savedTripsModal}
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
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
  const preloadProgress =
    preloadTotalCount > 0 ? Math.round((preloadedPhotoCount / preloadTotalCount) * 100) : 0;

  return (
    <div className="replay-page">
      <header className="replay-header">
        <div className="replay-title-block">
          <h2>{trip.title}</h2>
          {preloadTotalCount > 0 && (
            <button
              type="button"
              className={`replay-preload-toggle${showPreloadDetails ? ' replay-preload-toggle--open' : ''}`}
              onClick={() => setShowPreloadDetails((prev) => !prev)}
              title={t.photoPreloadToggleTitle}
            >
              <span
                className="replay-preload-ring"
                style={{
                  background: `conic-gradient(var(--primary) ${preloadProgress}%, rgba(255, 255, 255, 0.12) ${preloadProgress}% 100%)`,
                }}
                aria-hidden="true"
              >
                <span className="replay-preload-ring-inner">{preloadProgress}</span>
              </span>
              {showPreloadDetails && (
                <span className="replay-preload-status">
                  {t.photoPreloadStatus(preloadedPhotoCount, preloadTotalCount)}
                </span>
              )}
            </button>
          )}
        </div>
        {headerSaved}
        {headerTrailing}
      </header>
      {settingsModal}
      {savedTripsModal}

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
                activePhotoIndex={state.activePhotoIndex}
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
      />
    </div>
  );
}
