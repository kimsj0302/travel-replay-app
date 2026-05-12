import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkWebGLSupport } from '../components/MapView';
import SavedTripsRoutesMap, {
  type SavedTripsMapViewportPadding,
  type SavedTripsRoutesMapHandle,
} from '../components/SavedTripsRoutesMap';
import tripManifest from 'virtual:trip-manifest';
import type { SavedTripPickable, SavedTripSourceLink } from '../types/savedTripPicker';

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

const savedTrips: SavedTripPickable[] = tripManifest
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date, 'ko'))
  .map((entry) => ({
    key: entry.file,
    date: entry.date,
    title: entry.title,
    label: `${entry.date} - ${entry.title}`,
    previewCoords: entry.preview,
    photoCoords: entry.photoPoints,
    sourcePosts: entry.sourcePosts,
  }));

const webglSupported = checkWebGLSupport();
const MOBILE_BREAKPOINT_PX = 720;
const DESKTOP_LEFT_PADDING_MIN = 240;
const DESKTOP_LEFT_PADDING_MAX_RATIO = 0.36;
const DESKTOP_LEFT_PADDING_OVERLAY_RATIO = 0.72;
const DEFAULT_MAP_PADDING: SavedTripsMapViewportPadding = {
  top: 40,
  right: 56,
  bottom: 40,
  left: 56,
};

function summarizeSourcePost(url: string, fallbackIndex: number): string {
  try {
    const parsed = new URL(url);
    const articleId = parsed.pathname.split('/').filter(Boolean).pop();
    if (articleId) return `${parsed.hostname} / 글 ${articleId}`;
    return parsed.hostname;
  } catch {
    return `글 ${fallbackIndex + 1}`;
  }
}

function samePadding(a: SavedTripsMapViewportPadding, b: SavedTripsMapViewportPadding): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

function measureViewportPadding(overlayEl: HTMLElement | null): SavedTripsMapViewportPadding {
  if (!overlayEl || typeof window === 'undefined') return DEFAULT_MAP_PADDING;

  const rect = overlayEl.getBoundingClientRect();
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;

  if (mobile) {
    return {
      top: 24,
      right: 24,
      bottom: Math.min(
        Math.round(window.innerHeight - rect.top + 20),
        Math.round(window.innerHeight * 0.42),
      ),
      left: 24,
    };
  }

  const overlayAwareLeft = Math.round(rect.left + rect.width * DESKTOP_LEFT_PADDING_OVERLAY_RATIO);

  return {
    top: Math.max(32, Math.round(rect.top + 20)),
    right: 44,
    bottom: 32,
    left: Math.min(
      Math.max(DESKTOP_LEFT_PADDING_MIN, overlayAwareLeft),
      Math.round(window.innerWidth * DESKTOP_LEFT_PADDING_MAX_RATIO),
    ),
  };
}

export default function TripBlogMapPage() {
  const routesMapRef = useRef<SavedTripsRoutesMapHandle>(null);
  const overlayRef = useRef<HTMLElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(savedTrips[0]?.key ?? null);
  const [blogChoiceTrip, setBlogChoiceTrip] = useState<SavedTripPickable | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [viewportPadding, setViewportPadding] = useState<SavedTripsMapViewportPadding>(DEFAULT_MAP_PADDING);

  const selectedTrip = useMemo(
    () => (selectedKey ? savedTrips.find((trip) => trip.key === selectedKey) ?? null : null),
    [selectedKey],
  );

  const selectTrip = useCallback((tripKey: string) => {
    setSelectedKey(tripKey);
    setSelectionError(null);
    requestAnimationFrame(() => {
      try {
        routesMapRef.current?.frameToTrip(tripKey);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const openSourcePost = useCallback((url: string) => {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
  }, []);

  const handleOpenTrip = useCallback((trip: SavedTripPickable | null) => {
    if (!trip) return;

    if (trip.sourcePosts.length === 0) {
      setSelectionError('연결된 블로그 글이 없습니다.');
      return;
    }

    if (trip.sourcePosts.length === 1) {
      openSourcePost(trip.sourcePosts[0]!.url);
      return;
    }

    setBlogChoiceTrip(trip);
  }, [openSourcePost]);

  const handleOpenSourcePost = useCallback((sourcePost: SavedTripSourceLink) => {
    setBlogChoiceTrip(null);
    openSourcePost(sourcePost.url);
  }, [openSourcePost]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const measure = () => {
      const next = measureViewportPadding(overlayRef.current);
      setViewportPadding((prev) => (samePadding(prev, next) ? prev : next));
    };

    const requestMeasure = () => {
      window.requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(requestMeasure);
    observer.observe(overlayRef.current);
    window.addEventListener('resize', requestMeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', requestMeasure);
    };
  }, []);

  return (
    <div className="trip-blog-map">
      <div className="trip-blog-map__canvas">
        {webglSupported ? (
          <SavedTripsRoutesMap
            ref={routesMapRef}
            trips={savedTrips}
            selectedKey={selectedKey}
            onRouteClick={selectTrip}
            viewportPadding={viewportPadding}
          />
        ) : (
          <div className="trip-blog-map__webgl-fallback" />
        )}
      </div>

      <aside ref={overlayRef} className="trip-blog-map__overlay" aria-label="저장된 여행 목록">
        <div className="trip-blog-map__eyebrow">Travel Replay Archive</div>
        {!webglSupported && (
          <p className="trip-blog-map__error">
            이 브라우저에서는 지도를 표시할 수 없어 목록에서만 선택할 수 있습니다.
          </p>
        )}

        <div className="trip-blog-map__list-wrap">
          <ul className="trip-blog-map__list" role="list">
            {savedTrips.map((trip) => {
              const selected = selectedKey === trip.key;
              return (
                <li key={trip.key} className="trip-blog-map__item">
                  <button
                    type="button"
                    className={`trip-blog-map__trip${selected ? ' trip-blog-map__trip--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => selectTrip(trip.key)}
                  >
                    <span className="trip-blog-map__trip-title">{trip.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {savedTrips.length === 0 && (
            <p className="trip-blog-map__selection">저장된 여행이 없습니다.</p>
          )}
        </div>

        <div className="trip-blog-map__footer">
          <div className="trip-blog-map__selection" aria-live="polite">
            {selectedTrip ? selectedTrip.label : '여행을 선택해 주세요.'}
          </div>
          <button
            type="button"
            className="trip-blog-map__open-btn"
            disabled={!selectedTrip}
            onClick={() => handleOpenTrip(selectedTrip)}
          >
            블로그 열기
          </button>
        </div>

        {selectionError && <p className="trip-blog-map__error">{selectionError}</p>}
      </aside>

      {blogChoiceTrip && (
        <div
          className="replay-settings-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBlogChoiceTrip(null);
          }}
        >
          <div
            className="replay-settings-window replay-settings-window--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-choice-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="replay-settings-window-header">
              <h2 id="blog-choice-title">블로그 글 선택</h2>
              <button
                type="button"
                className="replay-settings-close"
                onClick={() => setBlogChoiceTrip(null)}
                aria-label="닫기"
              >
                <IconModalClose />
              </button>
            </div>
            <div className="replay-settings-window-body">
              <p className="trip-picker-blog-modal__desc">
                {blogChoiceTrip.label}에 연결된 글 중 하나를 선택해 주세요.
              </p>
              <div className="trip-picker-blog-list">
                {blogChoiceTrip.sourcePosts.map((sourcePost, index) => (
                  <button
                    key={sourcePost.url}
                    type="button"
                    className="trip-picker-blog-card"
                    onClick={() => handleOpenSourcePost(sourcePost)}
                  >
                    <span className="trip-picker-blog-card__title">
                      {summarizeSourcePost(sourcePost.url, index)}
                    </span>
                    <span className="trip-picker-blog-card__meta">사진 {sourcePost.photoCount}장</span>
                    <span className="trip-picker-blog-card__url">{sourcePost.url}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
