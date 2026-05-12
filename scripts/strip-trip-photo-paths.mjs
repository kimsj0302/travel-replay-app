import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDir = path.resolve(__dirname, '../jsons');

async function main() {
  const files = (await fs.readdir(jsonDir)).filter((file) => file.endsWith('.json'));

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(jsonDir, file);
      const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));

      if (Array.isArray(raw.photos)) {
        raw.photos = raw.photos.map((photo) => {
          if (!photo || typeof photo !== 'object' || Array.isArray(photo)) return photo;
          const { url: _removed, ...rest } = photo;
          return rest;
        });
      }

      await fs.writeFile(filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    }),
  );

  console.log(`Stripped photo paths from ${files.length} trip JSON files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
