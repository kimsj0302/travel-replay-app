interface ProxyConfig {
  url: string;
  /** If true, response is JSON with `contents` field instead of raw HTML */
  json?: boolean;
}

const CORS_PROXIES: ProxyConfig[] = [
  { url: 'https://api.allorigins.win/get?url=', json: true },
  { url: 'https://corsproxy.io/?url=' },
];

const TISTORY_CONTENT_SELECTORS = [
  '.entry-content',
  '.article_view',
  '.contents_style',
  '.tt_article_useless_p_margin',
];

const GENERIC_CONTENT_SELECTORS = [
  'article',
  '.post-content',
  '.post-body',
  '#content',
  'main',
];

const NOISE_PATTERN = /favicon|icon|logo|badge|emoticon|profile_|btn_|widget/i;

export interface ArticleExtractResult {
  imageUrls: string[];
  title: string | null;
}

async function fetchHtmlWithRetry(
  url: string,
  retries: number,
  delayMs: number,
): Promise<string> {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, delayMs * attempt));
        }
        const proxyUrl = proxy.url + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} from ${proxy.url}`);
          continue;
        }
        if (proxy.json) {
          const data = await response.json();
          return data.contents as string;
        }
        return await response.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError ?? new Error('All proxies failed');
}

export async function fetchArticleData(
  articleUrl: string,
): Promise<ArticleExtractResult> {
  const html = await fetchHtmlWithRetry(articleUrl, 2, 1000);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = doc.querySelector('title')?.textContent?.trim() ?? null;
  const imageUrls = extractImageUrlsFromDoc(doc, articleUrl);

  return { imageUrls, title };
}

function extractImageUrlsFromDoc(doc: Document, baseUrl: string): string[] {
  const allSelectors = [...TISTORY_CONTENT_SELECTORS, ...GENERIC_CONTENT_SELECTORS];
  let contentEl: Element | null = null;
  for (const sel of allSelectors) {
    contentEl = doc.querySelector(sel);
    if (contentEl) break;
  }

  const searchRoot = contentEl ?? doc.body;
  if (!searchRoot) return [];

  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    origin = '';
  }

  const urls: string[] = [];
  const seen = new Set<string>();

  const imgEls = searchRoot.querySelectorAll('img');
  for (const img of imgEls) {
    const src =
      img.getAttribute('data-origin') ??
      img.getAttribute('data-lazy-src') ??
      img.getAttribute('data-src') ??
      img.getAttribute('src');
    if (!src) continue;

    let resolved: string;
    try {
      resolved = new URL(src, origin).href;
    } catch {
      continue;
    }

    if (resolved.startsWith('data:')) continue;
    if (resolved.endsWith('.svg')) continue;
    if (NOISE_PATTERN.test(resolved)) continue;
    if (seen.has(resolved)) continue;

    seen.add(resolved);
    urls.push(resolved);
  }

  return urls;
}
