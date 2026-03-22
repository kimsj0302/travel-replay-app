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

export interface PhotoGroup {
  id: number;
  time: Date;
  lat: number;
  lon: number;
  photos: TripPhoto[];
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
  groups: PhotoGroup[];
  speedSegments: SpeedSegment[];
  startTime: Date;
  endTime: Date;
}

export type PlaybackMode = 'timeline' | 'photo';

export const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50] as const;
export type SpeedOption = (typeof SPEED_OPTIONS)[number];

export interface PlaybackState {
  mode: PlaybackMode;
  playing: boolean;
  currentTime: Date;
  progress: number;
  activeGroupIndex: number | null;
  paused: boolean;
  pauseUntil: number | null;
  userSpeed: SpeedOption;
}
