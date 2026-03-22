/**
 * Maps wall-clock playback progress to trip time **linearly** (uniform sweep).
 * This keeps the marker moving smoothly along GPX segments; non-linear speed zones
 * are not applied to trip-time (they caused large per-frame jumps).
 */
export function playbackMsToTripTimeMs(
  tripStartMs: number,
  tripEndMs: number,
  playbackMs: number,
  totalPlaybackMs: number,
): number {
  if (totalPlaybackMs <= 0) return tripStartMs;
  const ratio = Math.min(1, Math.max(0, playbackMs / totalPlaybackMs));
  return tripStartMs + ratio * (tripEndMs - tripStartMs);
}

export function tripTimeMsToPlaybackMs(
  tripStartMs: number,
  tripEndMs: number,
  tripTimeMs: number,
  totalPlaybackMs: number,
): number {
  const span = tripEndMs - tripStartMs;
  if (span <= 0) return 0;
  const ratio = (tripTimeMs - tripStartMs) / span;
  const clamped = Math.min(1, Math.max(0, ratio));
  return clamped * totalPlaybackMs;
}
