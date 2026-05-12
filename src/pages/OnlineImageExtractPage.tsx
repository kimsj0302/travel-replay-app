import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/context';
import type { TrackPoint } from '../types';
import { parseExifFromFile } from '../utils/exifParser';
import { parseMultipleGpxFiles } from '../utils/gpxParser';
import { fetchArticleData } from '../utils/urlImageExtractor';

const EXTRACT_DELAY_MS = 1500;

interface ExtractedImage {
  url: string;
  time: string;
  sourceUrl: string;
}

interface ExtractedSource {
  url: string;
  title: string | null;
  imageCount: number;
}

interface LocalPhoto {
  file: File;
  time: Date;
  objectUrl: string;
}

export default function OnlineImageExtractPage() {
  const navigate = useNavigate();
  const { t, lang, toggleLang } = useI18n();
  const localInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const dragIdx = useRef<number | null>(null);

  const [articleUrl, setArticleUrl] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [sources, setSources] = useState<ExtractedSource[]>([]);
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);

  const [extracting, setExtracting] = useState(false);
  const [parsingLocal, setParsingLocal] = useState(false);
  const [parsingGpx, setParsingGpx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // ── URL extraction ────────────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    const raw = articleUrl.trim();
    if (!raw) return;

    const urls = raw
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (urls.length === 0) return;

    setExtracting(true);
    setError(null);

    const skipped: string[] = [];
    const failed: string[] = [];
    let firstTitle: string | null = null;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      if (sources.some((s) => s.url === url)) {
        skipped.push(url);
        continue;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, EXTRACT_DELAY_MS));
      }

      try {
        const { imageUrls, title: pageTitle } = await fetchArticleData(url);

        if (imageUrls.length === 0) {
          failed.push(url + ` (${t.noImages})`);
          continue;
        }

        const newImages: ExtractedImage[] = imageUrls.map((u) => ({
          url: u,
          time: '',
          sourceUrl: url,
        }));

        setImages((prev) => [...prev, ...newImages]);
        setSources((prev) => [
          ...prev,
          { url, title: pageTitle, imageCount: imageUrls.length },
        ]);

        if (!firstTitle && pageTitle) firstTitle = pageTitle;
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.extractFailed;
        failed.push(url + ` (${msg})`);
      }
    }

    if (firstTitle && !title) setTitle(firstTitle);
    setArticleUrl('');

    const warnings: string[] = [];
    if (skipped.length > 0) warnings.push(t.skippedDuplicates(skipped.length));
    if (failed.length > 0) warnings.push(t.failedItems(failed.join(', ')));
    if (warnings.length > 0) setError(warnings.join(' | '));

    setExtracting(false);
  }, [articleUrl, title, sources, t]);

  const removeSource = useCallback((sourceUrl: string) => {
    setSources((prev) => prev.filter((s) => s.url !== sourceUrl));
    setImages((prev) => prev.filter((img) => img.sourceUrl !== sourceUrl));
  }, []);

  // ── Local photos ──────────────────────────────────────────────────

  const handleLocalFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      setParsingLocal(true);
      setError(null);
      try {
        const photos: LocalPhoto[] = [];
        for (const file of files) {
          const { time } = await parseExifFromFile(file);
          if (time) {
            photos.push({ file, time, objectUrl: URL.createObjectURL(file) });
          }
        }
        photos.sort((a, b) => a.time.getTime() - b.time.getTime());
        setLocalPhotos(photos);
        if (photos.length === 0) {
          setError(t.noExifTime);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.exifParseFailed);
      } finally {
        setParsingLocal(false);
      }
    },
    [t],
  );

  // ── GPX track ──────────────────────────────────────────────────────

  const handleGpxFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      setParsingGpx(true);
      setError(null);
      try {
        const points = await parseMultipleGpxFiles(files);
        setTrackPoints(points);
        if (points.length === 0) {
          setError(t.noTrackPoints);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.gpxParseFailed);
      } finally {
        setParsingGpx(false);
      }
    },
    [t],
  );

  // ── Apply local times by position ─────────────────────────────────

  const handleApplyTimes = useCallback(() => {
    if (localPhotos.length === 0 || images.length === 0) return;
    setImages((prev) =>
      prev.map((img, i) => {
        const lp = localPhotos[i];
        if (!lp) return img;
        return { ...img, time: toDatetimeLocal(lp.time) };
      }),
    );
  }, [localPhotos, images]);

  // ── Drag-and-drop reorder ─────────────────────────────────────────

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    setDragOver(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragIdx.current;
    const to = dragOver;
    dragIdx.current = null;
    setDragOver(null);
    if (from === null || to === null || from === to) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, [dragOver]);

  const moveImage = useCallback((idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  // ── Other actions ─────────────────────────────────────────────────

  const updateImageTime = useCallback((index: number, time: string) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], time };
      return updated;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      setSources((ss) =>
        ss
          .map((s) =>
            s.url === removed.sourceUrl
              ? { ...s, imageCount: s.imageCount - 1 }
              : s,
          )
          .filter((s) => s.imageCount > 0),
      );
      return next;
    });
  }, []);

  const handleAddManual = useCallback(() => {
    const url = prompt(t.enterImageUrl);
    if (url?.trim()) {
      setImages((prev) => [
        ...prev,
        { url: url.trim(), time: '', sourceUrl: t.manualSource },
      ]);
    }
  }, [t]);

  const buildJsonData = useCallback(() => {
    const validPhotos = images
      .filter((img) => img.time)
      .map((img) => ({
        time: new Date(img.time).toISOString(),
        ...(img.sourceUrl ? { sourceUrl: img.sourceUrl } : {}),
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const track = trackPoints.map((pt) => ({
      time: pt.time.toISOString(),
      lat: pt.lat,
      lon: pt.lon,
      ...(pt.ele !== undefined ? { ele: pt.ele } : {}),
    }));

    return {
      title: title || 'Untitled',
      date:
        date ||
        (validPhotos[0]
          ? new Date(validPhotos[0].time).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)),
      photos: validPhotos,
      ...(track.length > 0 ? { track } : {}),
    };
  }, [images, title, date, trackPoints]);

  const jsonPreview = showPreview ? JSON.stringify(buildJsonData(), null, 2) : '';
  const validCount = images.filter((img) => img.time).length;
  const pairCount = Math.min(images.length, localPhotos.length);

  return (
    <div className="extract-page">
      <header className="app-header">
        <h1>{t.extractPageTitle}</h1>
        <p>{t.extractPageDesc}</p>
        <button className="lang-toggle-btn extract-lang-btn" onClick={toggleLang}>
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
      </header>

      {/* Metadata */}
      <section className="extract-section">
        <h3>{t.tripInfo}</h3>
        <div className="extract-field-row">
          <label className="extract-label">
            {t.titleLabel}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              className="extract-input"
            />
          </label>
          <label className="extract-label">
            {t.dateLabel}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="extract-input"
            />
          </label>
        </div>
      </section>

      {/* URL Extract */}
      <section className="extract-section">
        <h3>{t.step1Title}</h3>
        <div className="extract-url-row">
          <textarea
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder={t.urlPlaceholder}
            className="extract-input extract-input--wide extract-textarea"
            rows={3}
          />
          <div className="extract-url-buttons">
            <button
              onClick={handleExtract}
              disabled={extracting || !articleUrl.trim()}
              className="extract-btn"
            >
              {extracting ? t.extracting : t.extract}
            </button>
            <button
              onClick={handleAddManual}
              className="extract-btn extract-btn--secondary"
            >
              {t.addManual}
            </button>
          </div>
        </div>

        {sources.length > 0 && (
          <div className="extract-source-list">
            {sources.map((src) => (
              <div key={src.url} className="extract-source-item">
                <span className="extract-source-title" title={src.url}>
                  {src.title || truncateUrl(src.url, 45)}
                </span>
                <span className="extract-source-count">{t.imageCountUnit(src.imageCount)}</span>
                <button
                  onClick={() => removeSource(src.url)}
                  className="extract-source-remove"
                  title={t.removeSourceTitle}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Local Photo Load + Apply */}
      <section className="extract-section">
        <h3>{t.step2Title}</h3>
        <p className="extract-hint">
          {t.step2Hint}
        </p>
        <div className="extract-local-row">
          <button
            onClick={() => localInputRef.current?.click()}
            disabled={parsingLocal}
            className="extract-btn"
          >
            {parsingLocal ? t.parsingExif : t.selectLocalPhotos}
          </button>
          <input
            ref={localInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleLocalFiles}
          />
          {localPhotos.length > 0 && (
            <span className="extract-local-count">
              {t.localLoaded(localPhotos.length)}
            </span>
          )}
          <button
            onClick={handleApplyTimes}
            disabled={localPhotos.length === 0 || images.length === 0}
            className="extract-btn extract-btn--accent"
          >
            {t.applyTimes(pairCount)}
          </button>
        </div>
      </section>

      {/* GPX Track */}
      <section className="extract-section">
        <h3>{t.step3Title}</h3>
        <p className="extract-hint">
          {t.step3Hint}
        </p>
        <div className="extract-local-row">
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
          {trackPoints.length > 0 && (
            <span className="extract-local-count">
              {t.trackPointsLoaded(trackPoints.length.toLocaleString())}
            </span>
          )}
          {trackPoints.length > 0 && (
            <button
              onClick={() => setTrackPoints([])}
              className="extract-btn extract-btn--secondary"
            >
              {t.removeTrack}
            </button>
          )}
        </div>
      </section>

      {error && <p className="error-msg">{error}</p>}

      {/* Image Pair List */}
      {images.length > 0 && (
        <section className="extract-section">
          <h3>{t.imageMatching(images.length, validCount)}</h3>
          <p className="extract-hint">{t.dragHint}</p>
          <div className="extract-image-list">
            {images.map((img, idx) => {
              const lp = localPhotos[idx];
              return (
                <div
                  key={`${img.url}-${idx}`}
                  className={`extract-pair-row${dragOver === idx ? ' extract-pair-row--dragover' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                >
                  <div className="extract-pair-order">
                    <span className="extract-pair-idx">{idx + 1}</span>
                    <button
                      className="extract-move-btn"
                      onClick={() => moveImage(idx, -1)}
                      disabled={idx === 0}
                      title={t.moveUp}
                    >
                      ▲
                    </button>
                    <button
                      className="extract-move-btn"
                      onClick={() => moveImage(idx, 1)}
                      disabled={idx === images.length - 1}
                      title={t.moveDown}
                    >
                      ▼
                    </button>
                  </div>

                  <div className="extract-pair-online">
                    <img
                      src={img.url}
                      alt={t.onlineAlt(idx + 1)}
                      className="extract-pair-thumb"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <span className="extract-pair-arrow">←</span>

                  <div className="extract-pair-local">
                    {lp ? (
                      <>
                        <img
                          src={lp.objectUrl}
                          alt={lp.file.name}
                          className="extract-pair-thumb"
                          loading="lazy"
                        />
                        <span className="extract-pair-time">
                          {formatTime(lp.time)}
                        </span>
                      </>
                    ) : (
                      <span className="extract-pair-empty">—</span>
                    )}
                  </div>

                  <input
                    type="datetime-local"
                    value={img.time}
                    onChange={(e) => updateImageTime(idx, e.target.value)}
                    className="extract-input extract-time-input"
                    step="1"
                  />

                  <button
                    onClick={() => removeImage(idx)}
                    className="extract-remove-btn"
                    title={t.deleteImage}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="extract-actions">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="extract-btn extract-btn--secondary"
          disabled={validCount === 0}
        >
          {showPreview ? t.closeJson : t.previewJson}
        </button>
        <button
          onClick={() => navigate('/')}
          className="extract-btn extract-btn--secondary"
        >
          {t.backToMain}
        </button>
      </section>

      {showPreview && (
        <section className="extract-section">
          <h3>{t.jsonPreviewTitle}</h3>
          <pre className="extract-json-preview">{jsonPreview}</pre>
        </section>
      )}
    </div>
  );
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function truncateUrl(url: string, max: number): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + '...';
}
