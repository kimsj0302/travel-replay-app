import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchArticleData } from '../utils/urlImageExtractor';
import { parseExifFromFile } from '../utils/exifParser';
import { parseMultipleGpxFiles } from '../utils/gpxParser';
import { downloadJson } from '../utils/exportJson';
import type { TrackPoint } from '../types';

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
          failed.push(url + ' (이미지 없음)');
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
        const msg = err instanceof Error ? err.message : '추출 실패';
        failed.push(url + ` (${msg})`);
      }
    }

    if (firstTitle && !title) setTitle(firstTitle);
    setArticleUrl('');

    const warnings: string[] = [];
    if (skipped.length > 0) warnings.push(`중복 건너뜀: ${skipped.length}개`);
    if (failed.length > 0) warnings.push(`실패: ${failed.join(', ')}`);
    if (warnings.length > 0) setError(warnings.join(' | '));

    setExtracting(false);
  }, [articleUrl, title, sources]);

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
          setError('EXIF 시간이 있는 사진이 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'EXIF 파싱 실패');
      } finally {
        setParsingLocal(false);
      }
    },
    [],
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
          setError('GPX에서 트랙 포인트를 찾을 수 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'GPX 파싱 실패');
      } finally {
        setParsingGpx(false);
      }
    },
    [],
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
    const url = prompt('이미지 URL을 입력하세요:');
    if (url?.trim()) {
      setImages((prev) => [
        ...prev,
        { url: url.trim(), time: '', sourceUrl: '(수동)' },
      ]);
    }
  }, []);

  const buildJsonData = useCallback(() => {
    const validPhotos = images
      .filter((img) => img.time)
      .map((img) => ({
        url: img.url,
        time: new Date(img.time).toISOString(),
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

  const handleDownload = useCallback(() => {
    const data = buildJsonData();
    if (data.photos.length === 0) {
      setError('시간이 설정된 이미지가 없습니다.');
      return;
    }
    const filename = `${data.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}-trip.json`;
    downloadJson(data, filename);
  }, [buildJsonData]);

  const jsonPreview = showPreview ? JSON.stringify(buildJsonData(), null, 2) : '';
  const validCount = images.filter((img) => img.time).length;
  const pairCount = Math.min(images.length, localPhotos.length);

  return (
    <div className="extract-page">
      <header className="app-header">
        <h1>온라인 이미지 → JSON</h1>
        <p>게시글에서 이미지를 추출하고, 로컬 사진 순서대로 시간을 적용하세요</p>
      </header>

      {/* Metadata */}
      <section className="extract-section">
        <h3>여행 정보</h3>
        <div className="extract-field-row">
          <label className="extract-label">
            제목
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="여행 제목"
              className="extract-input"
            />
          </label>
          <label className="extract-label">
            날짜
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
        <h3>1. 게시글에서 이미지 추출</h3>
        <div className="extract-url-row">
          <textarea
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder={
              'URL을 입력하세요 (여러 개는 줄바꿈/공백/쉼표로 구분)\nhttps://example.tistory.com/20\nhttps://example.tistory.com/21'
            }
            className="extract-input extract-input--wide extract-textarea"
            rows={3}
          />
          <div className="extract-url-buttons">
            <button
              onClick={handleExtract}
              disabled={extracting || !articleUrl.trim()}
              className="extract-btn"
            >
              {extracting ? '추출 중...' : '추출'}
            </button>
            <button
              onClick={handleAddManual}
              className="extract-btn extract-btn--secondary"
            >
              + 수동
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
                <span className="extract-source-count">{src.imageCount}장</span>
                <button
                  onClick={() => removeSource(src.url)}
                  className="extract-source-remove"
                  title="이 게시글의 이미지 모두 제거"
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
        <h3>2. 로컬 사진으로 시간 적용</h3>
        <p className="extract-hint">
          로컬 사진을 불러오면 EXIF 시간순으로 정렬됩니다.
          온라인 이미지 순서를 맞춘 뒤 &quot;시간 적용&quot;을 누르세요.
        </p>
        <div className="extract-local-row">
          <button
            onClick={() => localInputRef.current?.click()}
            disabled={parsingLocal}
            className="extract-btn"
          >
            {parsingLocal ? 'EXIF 분석 중...' : '로컬 사진 선택'}
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
              {localPhotos.length}장 로드됨
            </span>
          )}
          <button
            onClick={handleApplyTimes}
            disabled={localPhotos.length === 0 || images.length === 0}
            className="extract-btn extract-btn--accent"
          >
            시간 적용 ({pairCount}쌍)
          </button>
        </div>
      </section>

      {/* GPX Track */}
      <section className="extract-section">
        <h3>3. GPX 트랙 데이터 (선택)</h3>
        <p className="extract-hint">
          GPX 파일을 추가하면 지도 위에 이동 경로가 표시되고, 사진에 GPS 좌표가 자동 보간됩니다.
        </p>
        <div className="extract-local-row">
          <button
            onClick={() => gpxInputRef.current?.click()}
            disabled={parsingGpx}
            className="extract-btn"
          >
            {parsingGpx ? 'GPX 파싱 중...' : 'GPX 파일 선택'}
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
              {trackPoints.length.toLocaleString()}개 트랙포인트 로드됨
            </span>
          )}
          {trackPoints.length > 0 && (
            <button
              onClick={() => setTrackPoints([])}
              className="extract-btn extract-btn--secondary"
            >
              트랙 제거
            </button>
          )}
        </div>
      </section>

      {error && <p className="error-msg">{error}</p>}

      {/* Image Pair List */}
      {images.length > 0 && (
        <section className="extract-section">
          <h3>
            이미지 매칭 ({images.length}개, 시간 설정됨: {validCount}개)
          </h3>
          <p className="extract-hint">
            드래그하거나 ▲▼ 버튼으로 온라인 이미지 순서를 조절하세요
          </p>
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
                  {/* Reorder controls */}
                  <div className="extract-pair-order">
                    <span className="extract-pair-idx">{idx + 1}</span>
                    <button
                      className="extract-move-btn"
                      onClick={() => moveImage(idx, -1)}
                      disabled={idx === 0}
                      title="위로"
                    >
                      ▲
                    </button>
                    <button
                      className="extract-move-btn"
                      onClick={() => moveImage(idx, 1)}
                      disabled={idx === images.length - 1}
                      title="아래로"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Online image */}
                  <div className="extract-pair-online">
                    <img
                      src={img.url}
                      alt={`온라인 ${idx + 1}`}
                      className="extract-pair-thumb"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Arrow */}
                  <span className="extract-pair-arrow">←</span>

                  {/* Local photo */}
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

                  {/* Time input */}
                  <input
                    type="datetime-local"
                    value={img.time}
                    onChange={(e) => updateImageTime(idx, e.target.value)}
                    className="extract-input extract-time-input"
                    step="1"
                  />

                  {/* Remove */}
                  <button
                    onClick={() => removeImage(idx)}
                    className="extract-remove-btn"
                    title="삭제"
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
          {showPreview ? 'JSON 닫기' : 'JSON 미리보기'}
        </button>
        <button
          onClick={handleDownload}
          className="extract-btn extract-btn--accent"
          disabled={validCount === 0}
        >
          JSON 다운로드 ({validCount}장)
        </button>
        <button
          onClick={() => navigate('/')}
          className="extract-btn extract-btn--secondary"
        >
          ← 메인으로
        </button>
      </section>

      {showPreview && (
        <section className="extract-section">
          <h3>JSON 미리보기</h3>
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
