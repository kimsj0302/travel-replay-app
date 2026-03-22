import ExifReader from 'exifreader';
import type { ExpandedTags } from 'exifreader';
import type { TripPhoto } from '../types';

function tagDescription(
  tag: { description?: string | string[] } | undefined,
): string | null {
  if (!tag) return null;
  const d = tag.description;
  if (Array.isArray(d)) return d[0] ?? null;
  return d ?? null;
}

function dmsToDecimal(
  dmsTag: { value: [number[], number[], number[]] } | undefined,
  refTag: { value: string[] } | undefined,
): number | null {
  if (!dmsTag?.value || !refTag?.value) return null;
  const [[dNum, dDen], [mNum, mDen], [sNum, sDen]] = dmsTag.value;
  const degrees = dNum / dDen;
  const minutes = mNum / mDen;
  const seconds = sNum / sDen;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  const ref = refTag.value[0];
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}

/** expanded 모드의 exif 서브트리에서 DMS 태그 읽기 */
function gpsFromExifIfd(exif: ExpandedTags['exif']): { lat: number | null; lon: number | null } {
  if (!exif) return { lat: null, lon: null };

  const lat = dmsToDecimal(
    exif.GPSLatitude as { value: [number[], number[], number[]] } | undefined,
    exif.GPSLatitudeRef as { value: string[] } | undefined,
  );
  const lon = dmsToDecimal(
    exif.GPSLongitude as { value: [number[], number[], number[]] } | undefined,
    exif.GPSLongitudeRef as { value: string[] } | undefined,
  );
  return { lat, lon };
}

export async function parseExifFromFile(file: File): Promise<{
  time: Date | null;
  lat: number | null;
  lon: number | null;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const tags = ExifReader.load(buffer, { expanded: true, computed: true }) as ExpandedTags;

    let time: Date | null = null;
    const dateStr =
      tagDescription(tags.exif?.DateTimeOriginal) ??
      tagDescription(tags.exif?.DateTimeDigitized) ??
      tagDescription(tags.exif?.DateTime);

    if (dateStr) {
      const normalized = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) time = parsed;
    }

    let lat: number | null = null;
    let lon: number | null = null;

    const gpsBlock = tags.gps;
    if (
      gpsBlock &&
      typeof gpsBlock.Latitude === 'number' &&
      typeof gpsBlock.Longitude === 'number' &&
      Number.isFinite(gpsBlock.Latitude) &&
      Number.isFinite(gpsBlock.Longitude)
    ) {
      lat = gpsBlock.Latitude;
      lon = gpsBlock.Longitude;
    } else {
      const fromIfd = gpsFromExifIfd(tags.exif);
      lat = fromIfd.lat;
      lon = fromIfd.lon;
    }

    return { time, lat, lon };
  } catch {
    return { time: null, lat: null, lon: null };
  }
}

export async function parsePhotosFromFiles(files: File[]): Promise<TripPhoto[]> {
  const photos: TripPhoto[] = [];

  for (const file of files) {
    const { time, lat, lon } = await parseExifFromFile(file);
    if (!time) continue;

    const objectUrl = URL.createObjectURL(file);
    const hasGps = lat !== null && lon !== null;

    photos.push({
      time,
      lat: lat ?? 0,
      lon: lon ?? 0,
      file,
      objectUrl,
      gpsSource: hasGps ? 'exif' : 'interpolated',
    });
  }

  photos.sort((a, b) => a.time.getTime() - b.time.getTime());
  return photos;
}
