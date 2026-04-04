import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FolderSelect from '../components/FolderSelect';
import { parseMultipleGpxFiles } from '../utils/gpxParser';
import { parsePhotosFromFiles } from '../utils/exifParser';
import { buildTrip } from '../utils/tripBuilder';
import { loadTripFromJson } from '../utils/loadTripFromJson';
import type { Trip } from '../types';

interface ImportPageProps {
  onTripLoaded: (trip: Trip) => void;
}

export default function ImportPage({ onTripLoaded }: ImportPageProps) {
  const navigate = useNavigate();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (gpxFiles: File[], photoFiles: File[]) => {
      setLoading(true);
      setError(null);
      setStatus(null);

      try {
        if (gpxFiles.length === 0) {
          setError('GPX 파일을 찾을 수 없습니다. 폴더에 .gpx 파일이 있는지 확인하세요.');
          setLoading(false);
          return;
        }

        setStatus(`GPX 파일 ${gpxFiles.length}개 파싱 중...`);
        const track = await parseMultipleGpxFiles(gpxFiles);

        setStatus(`사진 ${photoFiles.length}장 EXIF 분석 중...`);
        const photos = await parsePhotosFromFiles(photoFiles);

        setStatus('여행 데이터 구성 중...');
        const folderName =
          (gpxFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split(
            '/',
          )[0] ?? 'trip';
        const trip = buildTrip(folderName, track, photos);

        setStatus(`완료! 트랙포인트 ${track.length}개, 사진 ${photos.length}장`);

        onTripLoaded(trip);
        setTimeout(() => navigate('/replay'), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [onTripLoaded, navigate],
  );

  const handleJsonUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      setStatus('JSON 파일 로드 중...');
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const trip = loadTripFromJson(json);
        setStatus(`완료! ${trip.title} — 사진 ${trip.photos.length}장`);
        onTripLoaded(trip);
        setTimeout(() => navigate('/replay'), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'JSON 파싱 실패');
      } finally {
        setLoading(false);
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    },
    [onTripLoaded, navigate],
  );

  return (
    <div className="import-page">
      <header className="app-header">
        <h1>Travel Replay</h1>
        <p>GPS 궤적과 사진으로 여행을 다시 경험하세요</p>
      </header>

      <FolderSelect onFilesSelected={handleFiles} loading={loading} />

      <div className="import-divider">
        <span>또는</span>
      </div>

      <div className="import-json-section">
        <button
          onClick={() => jsonInputRef.current?.click()}
          disabled={loading}
          className="select-btn"
        >
          JSON 파일 불러오기
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleJsonUpload}
        />
        <p className="folder-desc">온라인 이미지 추출 페이지에서 만든 JSON을 로드합니다.</p>
      </div>

      {status && <p className="status-msg">{status}</p>}
      {error && <p className="error-msg">{error}</p>}

      <div className="instructions">
        <h3>사용 방법</h3>
        <ol>
          <li>여행 폴더를 선택하세요 (GPX 파일과 <code>processed/</code> 사진 폴더 포함).</li>
          <li>또는 온라인 이미지 JSON 파일을 불러오세요.</li>
          <li>앱이 경로와 사진을 자동 분석 후 지도 위에서 재생합니다.</li>
        </ol>
        <button
          onClick={() => navigate('/extract')}
          className="extract-link-btn"
        >
          온라인 이미지 → JSON 변환 페이지로 이동
        </button>
      </div>
    </div>
  );
}
