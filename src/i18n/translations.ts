const ko = {
  // ── common ──
  loading: '로드 중...',
  jsonParseFailed: 'JSON 파싱 실패',

  // ── TripReplayPage ──
  savedTrips: '저장된 여행',
  savedTripLoadFailed: '저장된 여행 로드 실패',
  fileNotFound: '파일을 찾을 수 없습니다',
  loadJsonFile: 'JSON 파일 불러오기',
  imageToJson: '이미지 → JSON 변환',
  gpxEditor: 'GPX 편집',
  loadTripPrompt: '여행을 불러와 주세요',
  loadTripDesc: '저장된 여행을 선택하거나, JSON 파일을 직접 불러오세요.',
  switchToVertical: '상하 분할로 전환',
  switchToHorizontal: '좌우 분할로 전환',
  layoutVertical: '⬍ 상하',
  layoutHorizontal: '⬌ 좌우',
  webglBanner:
    '지도를 표시하려면 브라우저의 하드웨어 가속을 활성화해 주세요.\nTo view the map, please enable hardware acceleration in your browser settings.',

  // ── PlaybackControls ──
  selectedTime: '선택된 시각',
  photoTrackStats: '사진·궤적 통계',
  photoCount: (n: number) => `${n}장`,
  gpsPoints: (n: string) => `GPS ${n}포인트`,
  gpxCoordCount: 'GPX 궤적 좌표 개수(지도·보간에 사용)',
  jumpToThisTime: '이 시점으로 이동',
  jumpToPhoto: (n: number) => `사진 ${n} 해당 시점으로 이동`,
  gpsTrackPoints: (n: number) => `GPS 궤적 포인트 ${n}개`,
  jumpToGpsTime: '이 GPS 시점으로 이동',
  trackTime: (t: string) => `궤적 시각 ${t}로 이동`,
  dateLocale: 'ko-KR',

  // ── PhotoOverlay ──
  photoEmptyHint: '타임라인의 주황 틱을 클릭하면 해당 시점의 사진이 여기에 표시됩니다.',
  loadingPhoto: '로딩 중...',
  prevPhotoTitle: '이전 시각의 사진',
  nextPhotoTitle: '다음 시각의 사진',
  prev: '이전',
  next: '다음',

  // ── PhotoSplitPane ──
  resizePanel: '사진 패널 크기 조절',
  photoPanel: '사진 패널',

  // ── fixedZoomControl ──
  zoomIn: '확대',
  zoomOut: '축소',

  // ── OnlineImageExtractPage ──
  extractPageTitle: '온라인 이미지 → JSON',
  extractPageDesc: '게시글에서 이미지를 추출하고, 로컬 사진 순서대로 시간을 적용하세요',
  tripInfo: '여행 정보',
  titleLabel: '제목',
  titlePlaceholder: '여행 제목',
  dateLabel: '날짜',
  step1Title: '1. 게시글에서 이미지 추출',
  urlPlaceholder:
    'URL을 입력하세요 (여러 개는 줄바꿈/공백/쉼표로 구분)\nhttps://example.tistory.com/20\nhttps://example.tistory.com/21',
  extracting: '추출 중...',
  extract: '추출',
  addManual: '+ 수동',
  imageCountUnit: (n: number) => `${n}장`,
  removeSourceTitle: '이 게시글의 이미지 모두 제거',
  noImages: '이미지 없음',
  extractFailed: '추출 실패',
  skippedDuplicates: (n: number) => `중복 건너뜀: ${n}개`,
  failedItems: (s: string) => `실패: ${s}`,
  step2Title: '2. 로컬 사진으로 시간 적용',
  step2Hint:
    '로컬 사진을 불러오면 EXIF 시간순으로 정렬됩니다. 온라인 이미지 순서를 맞춘 뒤 "시간 적용"을 누르세요.',
  parsingExif: 'EXIF 분석 중...',
  selectLocalPhotos: '로컬 사진 선택',
  localLoaded: (n: number) => `${n}장 로드됨`,
  applyTimes: (n: number) => `시간 적용 (${n}쌍)`,
  noExifTime: 'EXIF 시간이 있는 사진이 없습니다.',
  exifParseFailed: 'EXIF 파싱 실패',
  step3Title: '3. GPX 트랙 데이터 (선택)',
  step3Hint:
    'GPX 파일을 추가하면 지도 위에 이동 경로가 표시되고, 사진에 GPS 좌표가 자동 보간됩니다.',
  parsingGpx: 'GPX 파싱 중...',
  selectGpxFile: 'GPX 파일 선택',
  trackPointsLoaded: (n: string) => `${n}개 트랙포인트 로드됨`,
  noTrackPoints: 'GPX에서 트랙 포인트를 찾을 수 없습니다.',
  gpxParseFailed: 'GPX 파싱 실패',
  removeTrack: '트랙 제거',
  imageMatching: (total: number, valid: number) =>
    `이미지 매칭 (${total}개, 시간 설정됨: ${valid}개)`,
  dragHint: '드래그하거나 ▲▼ 버튼으로 온라인 이미지 순서를 조절하세요',
  moveUp: '위로',
  moveDown: '아래로',
  onlineAlt: (n: number) => `온라인 ${n}`,
  deleteImage: '삭제',
  manualSource: '(수동)',
  enterImageUrl: '이미지 URL을 입력하세요:',
  noTimedImages: '시간이 설정된 이미지가 없습니다.',
  closeJson: 'JSON 닫기',
  previewJson: 'JSON 미리보기',
  downloadJson: (n: number) => `JSON 다운로드 (${n}장)`,
  backToMain: '← 메인으로',
  jsonPreviewTitle: 'JSON 미리보기',

  // ── GpxEditorPage ──
  gpxEditorPageTitle: 'GPX 편집기',
  gpxEditorPageDesc: 'GPX 파일을 불러와 지도에서 영역 선택 후 포인트를 삭제하고 다시 저장하세요',
  gpxSelectionModeOn: '영역 선택 켜짐',
  gpxSelectionModeOff: '영역 선택 모드',
  gpxDeleteSelected: (n: number) => `선택 포인트 삭제 (${n}개)`,
  gpxClearSelection: '선택 해제',
  gpxSaveFile: 'GPX 저장',
  gpxSelectedPoints: (n: string) => `선택 ${n}개`,
  gpxLoadedFile: (name: string) => `파일: ${name}`,
  gpxSelectionHintIdle: '영역 선택 모드를 켠 뒤 지도에서 드래그해 GPX 포인트를 선택하세요.',
  gpxSelectionHintActive: '지도에서 드래그하면 사각형 영역 안의 GPX 포인트가 선택됩니다.',
  gpxEmptyTitle: 'GPX 파일을 불러와 주세요',
  gpxEmptyDesc: 'GPX 트랙을 열면 지도에 포인트가 표시되고, 드래그 선택으로 삭제할 수 있습니다.',

  // ── loadTripFromJson ──
  noValidPhotos: '유효한 photos 배열이 없습니다.',
  noValidTime: '유효한 시간을 가진 사진이 없습니다.',
};

type RawTranslations = typeof ko;
export type Translations = {
  [K in keyof RawTranslations]: RawTranslations[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string;
};

const en: Translations = {
  // ── common ──
  loading: 'Loading...',
  jsonParseFailed: 'JSON parse failed',

  // ── TripReplayPage ──
  savedTrips: 'Saved Trips',
  savedTripLoadFailed: 'Failed to load saved trip',
  fileNotFound: 'File not found',
  loadJsonFile: 'Load JSON file',
  imageToJson: 'Image → JSON',
  gpxEditor: 'GPX Editor',
  loadTripPrompt: 'Load a trip to get started',
  loadTripDesc: 'Select a saved trip or load a JSON file.',
  switchToVertical: 'Switch to top-bottom split',
  switchToHorizontal: 'Switch to left-right split',
  layoutVertical: '⬍ T/B',
  layoutHorizontal: '⬌ L/R',
  webglBanner:
    'To view the map, please enable hardware acceleration in your browser settings.',

  // ── PlaybackControls ──
  selectedTime: 'Selected time',
  photoTrackStats: 'Photo & track stats',
  photoCount: (n: number) => `${n} photos`,
  gpsPoints: (n: string) => `GPS ${n} pts`,
  gpxCoordCount: 'Number of GPX track coordinates (used for map & interpolation)',
  jumpToThisTime: 'Jump to this time',
  jumpToPhoto: (n: number) => `Jump to photo ${n}`,
  gpsTrackPoints: (n: number) => `${n} GPS track points`,
  jumpToGpsTime: 'Jump to this GPS time',
  trackTime: (t: string) => `Jump to track time ${t}`,
  dateLocale: 'en-US',

  // ── PhotoOverlay ──
  photoEmptyHint: 'Click an orange tick on the timeline to view the photo at that time.',
  loadingPhoto: 'Loading...',
  prevPhotoTitle: 'Previous photo',
  nextPhotoTitle: 'Next photo',
  prev: 'Prev',
  next: 'Next',

  // ── PhotoSplitPane ──
  resizePanel: 'Resize photo panel',
  photoPanel: 'Photo panel',

  // ── fixedZoomControl ──
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',

  // ── OnlineImageExtractPage ──
  extractPageTitle: 'Online Image → JSON',
  extractPageDesc: 'Extract images from posts and apply times using local photo order',
  tripInfo: 'Trip Info',
  titleLabel: 'Title',
  titlePlaceholder: 'Trip title',
  dateLabel: 'Date',
  step1Title: '1. Extract images from posts',
  urlPlaceholder:
    'Enter URLs (separate multiple with newlines/spaces/commas)\nhttps://example.tistory.com/20\nhttps://example.tistory.com/21',
  extracting: 'Extracting...',
  extract: 'Extract',
  addManual: '+ Manual',
  imageCountUnit: (n: number) => `${n} images`,
  removeSourceTitle: 'Remove all images from this post',
  noImages: 'no images',
  extractFailed: 'Extraction failed',
  skippedDuplicates: (n: number) => `Skipped duplicates: ${n}`,
  failedItems: (s: string) => `Failed: ${s}`,
  step2Title: '2. Apply times from local photos',
  step2Hint:
    'Load local photos to sort by EXIF time. Match the online image order, then press "Apply Times".',
  parsingExif: 'Parsing EXIF...',
  selectLocalPhotos: 'Select local photos',
  localLoaded: (n: number) => `${n} photos loaded`,
  applyTimes: (n: number) => `Apply Times (${n} pairs)`,
  noExifTime: 'No photos with EXIF time found.',
  exifParseFailed: 'EXIF parse failed',
  step3Title: '3. GPX Track Data (optional)',
  step3Hint:
    'Adding a GPX file will show the route on the map and auto-interpolate GPS coordinates for photos.',
  parsingGpx: 'Parsing GPX...',
  selectGpxFile: 'Select GPX file',
  trackPointsLoaded: (n: string) => `${n} track points loaded`,
  noTrackPoints: 'No track points found in GPX.',
  gpxParseFailed: 'GPX parse failed',
  removeTrack: 'Remove track',
  imageMatching: (total: number, valid: number) =>
    `Image Matching (${total} total, ${valid} with time)`,
  dragHint: 'Drag or use ▲▼ buttons to reorder online images',
  moveUp: 'Move up',
  moveDown: 'Move down',
  onlineAlt: (n: number) => `Online ${n}`,
  deleteImage: 'Delete',
  manualSource: '(manual)',
  enterImageUrl: 'Enter image URL:',
  noTimedImages: 'No images with time set.',
  closeJson: 'Close JSON',
  previewJson: 'JSON Preview',
  downloadJson: (n: number) => `Download JSON (${n} photos)`,
  backToMain: '← Back to main',
  jsonPreviewTitle: 'JSON Preview',

  // ── GpxEditorPage ──
  gpxEditorPageTitle: 'GPX Editor',
  gpxEditorPageDesc: 'Load a GPX file, select points on the map, delete them, and save the edited track',
  gpxSelectionModeOn: 'Selection On',
  gpxSelectionModeOff: 'Selection Mode',
  gpxDeleteSelected: (n: number) => `Delete Selected (${n})`,
  gpxClearSelection: 'Clear Selection',
  gpxSaveFile: 'Save GPX',
  gpxSelectedPoints: (n: string) => `${n} selected`,
  gpxLoadedFile: (name: string) => `File: ${name}`,
  gpxSelectionHintIdle: 'Turn on selection mode, then drag on the map to select GPX points.',
  gpxSelectionHintActive: 'Drag on the map to select GPX points inside a bounding box.',
  gpxEmptyTitle: 'Load a GPX file',
  gpxEmptyDesc: 'Once a GPX track is loaded, you can select points by dragging and delete them.',

  // ── loadTripFromJson ──
  noValidPhotos: 'No valid photos array found.',
  noValidTime: 'No photos with valid time found.',
};

export type Lang = 'ko' | 'en';
export const translations: Record<Lang, Translations> = { ko: ko as Translations, en };
