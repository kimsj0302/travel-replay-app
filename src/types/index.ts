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
  file: File;
  objectUrl: string;
  gpsSource: 'exif' | 'interpolated';
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
