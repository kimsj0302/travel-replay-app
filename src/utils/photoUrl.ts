export function getSignedUrlExpiryMs(url: string): number | null {
  try {
    const parsed = new URL(url);
    const expires = parsed.searchParams.get('expires');
    if (!expires) return null;
    const seconds = Number(expires);
    if (!Number.isFinite(seconds)) return null;
    return seconds * 1000;
  } catch {
    return null;
  }
}

export function isExpiredSignedUrl(url: string, nowMs = Date.now()): boolean {
  const expiresMs = getSignedUrlExpiryMs(url);
  if (expiresMs === null) return false;
  return expiresMs <= nowMs;
}
