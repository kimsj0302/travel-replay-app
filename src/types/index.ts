export interface TrackPoint {
  time: Date;
  lat: number;
  lon: number;
  ele?: number;
}

export interface TripPhoto {
  time: Date;
  lat: number;
  lon: number;
  file?: File;
  objectUrl?: string;
  url?: string;
  sourceUrl?: string;
  gpsSource: 'exif' | 'interpolated' | 'none';
}

export function getPhotoSrc(photo: TripPhoto): string {
  return photo.objectUrl ?? photo.url ?? '';
}

export function getPhotoName(photo: TripPhoto): string {
  if (photo.file) return photo.file.name;
  if (photo.url) {
    try {
      return decodeURIComponent(new URL(photo.url).pathname.split('/').pop() ?? photo.url);
    } catch {
      return photo.url;
    }
  }
  return 'unknown';
}

export interface SpeedSegment {
  startTime: number;
  endTime: number;
  speedFactor: number;
}

export interface Trip {
  id: string;
  title: string;
  date: string;
  track: TrackPoint[];
  photos: TripPhoto[];
  speedSegments: SpeedSegment[];
  startTime: Date;
  endTime: Date;
}

export interface PlaybackState {
  currentTime: Date;
  progress: number;
  /** `sortPhotosByTime(trip.photos)` 기준 인덱스 */
  activePhotoIndex: number | null;
}
