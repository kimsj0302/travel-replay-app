import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FolderSelect from '../components/FolderSelect';
import { parseMultipleGpxFiles } from '../utils/gpxParser';
import { parsePhotosFromFiles } from '../utils/exifParser';
import { buildTrip } from '../utils/tripBuilder';
import type { Trip } from '../types';

interface ImportPageProps {
  onTripLoaded: (trip: Trip) => void;
}

export default function ImportPage({ onTripLoaded }: ImportPageProps) {
  const navigate = useNavigate();
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

        setStatus(
          `완료! 트랙포인트 ${track.length}개, 사진 ${photos.length}장, ${trip.groups.length}개 그룹`,
        );

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

  return (
    <div className="import-page">
      <header className="app-header">
        <h1>🗺️ Travel Replay</h1>
        <p>GPS 궤적과 사진으로 여행을 다시 경험하세요</p>
      </header>

      <FolderSelect onFilesSelected={handleFiles} loading={loading} />

      {status && <p className="status-msg">{status}</p>}
      {error && <p className="error-msg">{error}</p>}

      <div className="instructions">
        <h3>사용 방법</h3>
        <ol>
          <li>여행 폴더를 선택하세요 (GPX 파일과 <code>processed/</code> 사진 폴더 포함).</li>
          <li>앱이 GPX 경로와 사진 EXIF 메타데이터를 자동으로 분석합니다.</li>
          <li>지도 위에서 여행 경로와 사진을 시간순으로 재생합니다.</li>
        </ol>
      </div>
    </div>
  );
}
