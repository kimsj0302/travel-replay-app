import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const MAX_TRACK_PREVIEW_POINTS = 400;

/** GPS `track`만 샘플링. 사진 좌표는 사용하지 않음. */
function extractTrackPreviewLonLat(raw: { track?: unknown }): [number, number][] | null {
  const track = raw.track;
  if (!Array.isArray(track) || track.length === 0) return null;
  const coords: [number, number][] = [];
  for (const pt of track) {
    if (!pt || typeof pt !== 'object') continue;
    const o = pt as Record<string, unknown>;
    const lon = o.lon;
    const lat = o.lat;
    if (
      typeof lon === 'number' &&
      typeof lat === 'number' &&
      Number.isFinite(lon) &&
      Number.isFinite(lat)
    ) {
      coords.push([lon, lat]);
    }
  }
  if (coords.length === 0) return null;
  if (coords.length <= MAX_TRACK_PREVIEW_POINTS) return coords;
  const stride = Math.ceil(coords.length / MAX_TRACK_PREVIEW_POINTS);
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += stride) {
    out.push(coords[i]!);
  }
  const last = coords[coords.length - 1]!;
  const prev = out[out.length - 1]!;
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last);
  return out;
}

function tripManifestPlugin(): Plugin {
  const virtualId = 'virtual:trip-manifest';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'trip-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const jsonsDir = path.resolve(__dirname, 'jsons');
      if (!fs.existsSync(jsonsDir)) return 'export default [];';
      const files = fs.readdirSync(jsonsDir).filter((f) => f.endsWith('.json'));
      const manifest = files.map((file) => {
        const raw = JSON.parse(fs.readFileSync(path.join(jsonsDir, file), 'utf-8')) as {
          title?: string;
          date?: string;
          track?: unknown;
        };
        const preview = extractTrackPreviewLonLat(raw);
        return {
          file,
          title: raw.title ?? '',
          date: raw.date ?? '',
          preview,
        };
      });
      return `export default ${JSON.stringify(manifest)};`;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tripManifestPlugin()],
  base: '/travel-replay-app/',
})
