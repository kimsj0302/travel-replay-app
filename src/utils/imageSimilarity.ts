export const HASH_SIZE = 8;
export const DHASH_WIDTH = HASH_SIZE + 1;
export const TOTAL_BITS = HASH_SIZE * HASH_SIZE;
export const MATCH_THRESHOLD = 0.75;

const BROWSER_CONCURRENCY = 6;

// ── Pure functions (no DOM dependency) ──────────────────────────────

/**
 * dHash: horizontal-gradient hash.
 * Input: RGBA pixels from a (HASH_SIZE+1) × HASH_SIZE image.
 * More robust than aHash against brightness/contrast shifts from
 * format conversion (PNG↔JPG) and resizing.
 */
export function computeDHash(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): bigint {
  let hash = 0n;
  let bit = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx1 = (y * width + x) * 4;
      const idx2 = (y * width + x + 1) * 4;
      const g1 = 0.299 * pixels[idx1] + 0.587 * pixels[idx1 + 1] + 0.114 * pixels[idx1 + 2];
      const g2 = 0.299 * pixels[idx2] + 0.587 * pixels[idx2 + 1] + 0.114 * pixels[idx2 + 2];
      if (g1 > g2) hash |= 1n << BigInt(bit);
      bit++;
    }
  }
  return hash;
}

/** RGBA pixel buffer → average-hash (kept for fallback/combination). */
export function computeAHash(pixels: Uint8ClampedArray): bigint {
  const len = pixels.length >> 2;
  let sum = 0;
  const grays = new Float64Array(len);
  for (let i = 0, p = 0; i < len; i++, p += 4) {
    const g = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
    grays[i] = g;
    sum += g;
  }
  const mean = sum / len;
  let hash = 0n;
  for (let i = 0; i < len; i++) {
    if (grays[i] >= mean) hash |= 1n << BigInt(i);
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

export interface MatchResult {
  onlineIndex: number;
  localIndex: number;
  distance: number;
  score: number;
}

/**
 * Greedy 1-to-1 matching: closest pair first, no reuse.
 * Ties in hash distance are broken by positional proximity
 * (assumes both lists share similar ordering, e.g. chronological).
 */
export function greedyMatch(
  hashesA: (bigint | null)[],
  hashesB: (bigint | null)[],
): MatchResult[] {
  const pairs: { ai: number; bi: number; dist: number; posDist: number }[] = [];
  for (let ai = 0; ai < hashesA.length; ai++) {
    if (hashesA[ai] === null) continue;
    for (let bi = 0; bi < hashesB.length; bi++) {
      if (hashesB[bi] === null) continue;
      pairs.push({
        ai,
        bi,
        dist: hammingDistance(hashesA[ai]!, hashesB[bi]!),
        posDist: Math.abs(ai - bi),
      });
    }
  }

  pairs.sort((a, b) => a.dist - b.dist || a.posDist - b.posDist);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const results: MatchResult[] = [];

  for (const { ai, bi, dist } of pairs) {
    if (usedA.has(ai) || usedB.has(bi)) continue;
    usedA.add(ai);
    usedB.add(bi);
    results.push({
      onlineIndex: ai,
      localIndex: bi,
      distance: dist,
      score: 1 - dist / TOTAL_BITS,
    });
  }

  return results;
}

// ── Browser-specific image loading ──────────────────────────────────

/**
 * Loads image into a canvas, applying:
 * 1) center square-crop (removes aspect-ratio differences)
 * 2) optional inner center-crop at 70% (removes headers/borders)
 * 3) resize to target dimensions
 */
function loadImagePixelsBrowser(
  src: string | Blob,
  targetW: number,
  targetH: number,
  centerCrop: boolean,
): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('No 2D context'));
        return;
      }

      let sx = 0,
        sy = 0,
        sw = img.naturalWidth,
        sh = img.naturalHeight;

      // Step 1: crop to center square (handle different aspect ratios)
      const minDim = Math.min(sw, sh);
      sx += (sw - minDim) / 2;
      sy += (sh - minDim) / 2;
      sw = minDim;
      sh = minDim;

      // Step 2: inner center-crop to remove headers/borders
      if (centerCrop) {
        const ratio = 0.7;
        const cropDim = minDim * ratio;
        sx += (minDim - cropDim) / 2;
        sy += (minDim - cropDim) / 2;
        sw = cropDim;
        sh = cropDim;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      cleanup();
      resolve(ctx.getImageData(0, 0, targetW, targetH).data);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Image load failed'));
    };

    if (src instanceof Blob) {
      objectUrl = URL.createObjectURL(src);
      img.src = objectUrl;
    } else {
      img.crossOrigin = 'anonymous';
      img.src = src;
    }
  });
}

async function computeHashBrowser(
  src: string | Blob,
  centerCrop = false,
): Promise<bigint> {
  const pixels = await loadImagePixelsBrowser(
    src,
    DHASH_WIDTH,
    HASH_SIZE,
    centerCrop,
  );
  return computeDHash(pixels, DHASH_WIDTH, HASH_SIZE);
}

// ── Concurrency pool ────────────────────────────────────────────────

async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

// ── Public browser API ──────────────────────────────────────────────

interface ProxyDef { url: string; raw?: boolean }

const FALLBACK_PROXIES: ProxyDef[] = [
  { url: 'https://api.allorigins.win/raw?url=', raw: true },
  { url: 'https://corsproxy.io/?url=', raw: true },
];

async function fetchBlobWithRetry(url: string, _proxies: string[]): Promise<Blob> {
  let lastError: Error | null = null;
  const proxies: ProxyDef[] = [
    ..._proxies.map((u) => ({ url: u, raw: true })),
    ...FALLBACK_PROXIES,
  ];
  const seen = new Set<string>();
  for (const proxy of proxies) {
    if (seen.has(proxy.url)) continue;
    seen.add(proxy.url);
    try {
      const resp = await fetch(proxy.url + encodeURIComponent(url));
      if (resp.ok) return await resp.blob();
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('All proxies failed');
}

export async function matchOnlineWithLocal(
  onlineImageUrls: string[],
  localFiles: File[],
  corsProxy: string,
  centerCrop = true,
  onProgress?: (done: number, total: number) => void,
): Promise<MatchResult[]> {
  const total = onlineImageUrls.length + localFiles.length;
  let done = 0;
  const report = () => {
    done++;
    onProgress?.(done, total);
  };

  const proxies = [corsProxy, ...FALLBACK_PROXIES.filter((p) => p.url !== corsProxy).map((p) => p.url)];

  const onlineHashes = await mapConcurrent(
    onlineImageUrls,
    async (url) => {
      try {
        const blob = await fetchBlobWithRetry(url, proxies);
        const h = await computeHashBrowser(blob, centerCrop);
        return h;
      } catch {
        return null;
      } finally {
        report();
      }
    },
    BROWSER_CONCURRENCY,
  );

  const localHashes = await mapConcurrent(
    localFiles,
    async (file) => {
      try {
        const h = await computeHashBrowser(file, centerCrop);
        return h;
      } catch {
        return null;
      } finally {
        report();
      }
    },
    BROWSER_CONCURRENCY,
  );

  return greedyMatch(onlineHashes, localHashes);
}
