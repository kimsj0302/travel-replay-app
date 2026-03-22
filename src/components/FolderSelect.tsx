import { useCallback, useRef, useState } from 'react';

interface FolderSelectProps {
  onFilesSelected: (gpxFiles: File[], photoFiles: File[]) => void;
  loading?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);

export default function FolderSelect({ onFilesSelected, loading }: FolderSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderName, setFolderName] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const gpxFiles: File[] = [];
      const photoFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.name.toLowerCase();
        const ext = name.split('.').pop() ?? '';
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';

        if (ext === 'gpx') {
          gpxFiles.push(file);
        } else if (IMAGE_EXTENSIONS.has(ext)) {
          const inProcessed = path.toLowerCase().includes('processed');
          if (inProcessed) {
            photoFiles.push(file);
          }
        }
      }

      if (files[0]) {
        const path = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
        const parts = path.split('/');
        setFolderName(parts[0] || files[0].name);
      }

      onFilesSelected(gpxFiles, photoFiles);
    },
    [onFilesSelected],
  );

  return (
    <div className="folder-select">
      <div className="folder-select-card">
        <div className="folder-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h2>여행 폴더 선택</h2>
        <p className="folder-desc">
          GPX 파일과 <code>processed/</code> 폴더에 사진이 있는 여행 폴더를 선택하세요.
        </p>

        <input
          ref={inputRef}
          type="file"
          /* @ts-expect-error webkitdirectory is non-standard */
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        <button
          className="select-btn"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? '처리 중...' : '폴더 선택하기'}
        </button>

        {folderName && (
          <p className="folder-name">
            선택된 폴더: <strong>{folderName}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
