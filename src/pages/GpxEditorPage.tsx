import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GpxEditorMap from '../components/GpxEditorMap';
import { checkWebGLSupport } from '../components/MapView';
import { useI18n } from '../i18n/context';
import type { TrackPoint } from '../types';
import { downloadGpx } from '../utils/exportGpx';
import { parseMultipleGpxFiles } from '../utils/gpxParser';

const webglSupported = checkWebGLSupport();

function buildDownloadFilename(fileName: string | null): string {
  if (!fileName) return 'edited-track.gpx';
  const base = fileName.replace(/\.gpx$/i, '');
  return `${base || 'edited-track'}-edited.gpx`;
}

function buildTrackName(fileName: string | null): string {
  if (!fileName) return 'Edited Track';
  return fileName.replace(/\.gpx$/i, '') || 'Edited Track';
}

export default function GpxEditorPage() {
  const navigate = useNavigate();
  const { lang, t, toggleLang } = useI18n();
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsingGpx, setParsingGpx] = useState(false);
  const [fitSeq, setFitSeq] = useState(0);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const selectedCount = selectedIndices.size;
  const selectedIndexArray = useMemo(() => Array.from(selectedIndices).sort((a, b) => a - b), [selectedIndices]);

  const handleGpxFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      setParsingGpx(true);
      setError(null);

      try {
        const points = await parseMultipleGpxFiles(files);
        setTrackPoints(points);
        setSelectedIndices(new Set());
        setLoadedFileName(files.length === 1 ? files[0]?.name ?? null : `${files.length}-tracks.gpx`);
        setFitSeq((prev) => prev + 1);
        if (points.length === 0) {
          setError(t.noTrackPoints);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.gpxParseFailed);
      } finally {
        setParsingGpx(false);
        if (gpxInputRef.current) gpxInputRef.current.value = '';
      }
    },
    [t],
  );

  const handleSelectionChange = useCallback((indices: number[]) => {
    setSelectedIndices(new Set(indices));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    setTrackPoints((prev) => prev.filter((_, index) => !selectedIndices.has(index)));
    setSelectedIndices(new Set());
  }, [selectedIndices]);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleResetTrack = useCallback(() => {
    setTrackPoints([]);
    setSelectedIndices(new Set());
    setSelectionEnabled(false);
    setLoadedFileName(null);
    setError(null);
  }, []);

  const handleSaveGpx = useCallback(() => {
    if (trackPoints.length === 0) return;
    downloadGpx(
      trackPoints,
      buildDownloadFilename(loadedFileName),
      buildTrackName(loadedFileName),
    );
  }, [loadedFileName, trackPoints]);

  return (
    <div className="gpx-editor-page">
      <header className="app-header gpx-editor-header">
        <div>
          <h1>{t.gpxEditorPageTitle}</h1>
          <p>{t.gpxEditorPageDesc}</p>
        </div>
        <div className="gpx-editor-header-actions">
          <button className="lang-toggle-btn" onClick={toggleLang}>
            {lang === 'ko' ? 'EN' : '한국어'}
          </button>
          <button
            className="extract-btn extract-btn--secondary"
            onClick={() => navigate('/')}
          >
            {t.backToMain}
          </button>
        </div>
      </header>

      {!webglSupported && (
        <div className="webgl-banner">
          {t.webglBanner}
        </div>
      )}

      <section className="extract-section gpx-editor-toolbar">
        <div className="gpx-editor-toolbar-row">
          <button
            onClick={() => gpxInputRef.current?.click()}
            disabled={parsingGpx}
            className="extract-btn"
          >
            {parsingGpx ? t.parsingGpx : t.selectGpxFile}
          </button>
          <input
            ref={gpxInputRef}
            type="file"
            accept=".gpx"
            multiple
            style={{ display: 'none' }}
            onChange={handleGpxFiles}
          />
          <button
            onClick={() => setSelectionEnabled((prev) => !prev)}
            disabled={trackPoints.length === 0}
            className={`extract-btn${selectionEnabled ? ' extract-btn--accent' : ' extract-btn--secondary'}`}
          >
            {selectionEnabled ? t.gpxSelectionModeOn : t.gpxSelectionModeOff}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedCount === 0}
            className="extract-btn extract-btn--accent"
          >
            {t.gpxDeleteSelected(selectedCount)}
          </button>
          <button
            onClick={handleClearSelection}
            disabled={selectedCount === 0}
            className="extract-btn extract-btn--secondary"
          >
            {t.gpxClearSelection}
          </button>
          <button
            onClick={handleSaveGpx}
            disabled={trackPoints.length === 0}
            className="extract-btn"
          >
            {t.gpxSaveFile}
          </button>
          <button
            onClick={handleResetTrack}
            disabled={trackPoints.length === 0}
            className="extract-btn extract-btn--secondary"
          >
            {t.removeTrack}
          </button>
        </div>

        <div className="gpx-editor-stats">
          <span>{t.trackPointsLoaded(trackPoints.length.toLocaleString())}</span>
          <span>{t.gpxSelectedPoints(selectedCount.toLocaleString())}</span>
          {loadedFileName && <span>{t.gpxLoadedFile(loadedFileName)}</span>}
        </div>

        <p className="extract-hint">
          {selectionEnabled ? t.gpxSelectionHintActive : t.gpxSelectionHintIdle}
        </p>
        {error && <p className="error-msg">{error}</p>}
      </section>

      <section className="extract-section gpx-editor-map-section">
        {trackPoints.length > 0 && webglSupported ? (
          <GpxEditorMap
            trackPoints={trackPoints}
            selectedIndices={selectedIndexArray}
            selectionEnabled={selectionEnabled}
            fitSeq={fitSeq}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="gpx-editor-empty">
            <h3>{t.gpxEmptyTitle}</h3>
            <p>{t.gpxEmptyDesc}</p>
          </div>
        )}
      </section>
    </div>
  );
}
