import type { TrackPoint } from '../types';

const GPX_NS = 'http://www.topografix.com/GPX/1/1';
const GPX_CREATOR = 'Travel Replay GPX Editor';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildGpx(trackPoints: TrackPoint[], trackName = 'Edited Track'): string {
  const safeName = escapeXml(trackName);
  const trackPointXml = trackPoints
    .map((point) => {
      const eleXml = point.ele !== undefined ? `<ele>${point.ele}</ele>` : '';
      return [
        `    <trkpt lat="${point.lat}" lon="${point.lon}">`,
        eleXml ? `      ${eleXml}` : '',
        `      <time>${point.time.toISOString()}</time>`,
        '    </trkpt>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${GPX_CREATOR}" xmlns="${GPX_NS}">`,
    '  <trk>',
    `    <name>${safeName}</name>`,
    '    <trkseg>',
    trackPointXml,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

export function downloadGpx(trackPoints: TrackPoint[], filename: string, trackName?: string): void {
  const gpx = buildGpx(trackPoints, trackName);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
