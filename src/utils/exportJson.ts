import type { Trip } from '../types';

interface TripJsonPhoto {
  time: string;
  lat: number;
  lon: number;
  filename: string;
}

interface TripJson {
  title: string;
  date: string;
  photos: TripJsonPhoto[];
}

interface IndexEntry {
  id: string;
  title: string;
  date: string;
  photoCount: number;
  lat: number;
  lon: number;
}

export function tripToJson(trip: Trip): TripJson {
  return {
    title: trip.title,
    date: trip.date,
    photos: trip.photos.map((p) => ({
      time: p.time.toISOString(),
      lat: p.lat,
      lon: p.lon,
      filename: p.file.name,
    })),
  };
}

export function tripToIndexEntry(trip: Trip): IndexEntry {
  const avgLat =
    trip.track.length > 0
      ? trip.track.reduce((s, p) => s + p.lat, 0) / trip.track.length
      : trip.groups[0]?.lat ?? 0;
  const avgLon =
    trip.track.length > 0
      ? trip.track.reduce((s, p) => s + p.lon, 0) / trip.track.length
      : trip.groups[0]?.lon ?? 0;

  return {
    id: trip.id,
    title: trip.title,
    date: trip.date,
    photoCount: trip.photos.length,
    lat: avgLat,
    lon: avgLon,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
