import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

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
        const raw = JSON.parse(fs.readFileSync(path.join(jsonsDir, file), 'utf-8'));
        return { file, title: raw.title ?? '', date: raw.date ?? '' };
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
