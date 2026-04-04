import { useMemo } from 'react';
import type { PlaybackState, Trip } from '../types';
import { getPhotoName } from '../types';
import { sortPhotosByTime } from '../utils/sortPhotos';
import { sampleTrackVerticesForTimeline } from '../utils/timelineTrackSampling';
import { useI18n } from '../i18n/context';

const MAX_GPS_TIMELINE_DOTS = 1200;

interface PlaybackControlsProps {
  state: PlaybackState;
  trip: Trip;
  onJumpToPhoto: (photoIndex: number) => void;
  onJumpToTripTime: (tripTimeMs: number) => void;
}

export default function PlaybackControls({
  state,
  trip,
  onJumpToPhoto,
  onJumpToTripTime,
}: PlaybackControlsProps) {
  const { t } = useI18n();
  const photosSorted = useMemo(() => sortPhotosByTime(trip.photos), [trip.photos]);

  const gpsTimelinePoints = useMemo(
    () => sampleTrackVerticesForTimeline(trip.track, MAX_GPS_TIMELINE_DOTS),
    [trip.track],
  );

  const linearProgressPct = useMemo(() => {
    const start = trip.startTime.getTime();
    const end = trip.endTime.getTime();
    if (end <= start) return 0;
    const ct = state.currentTime.getTime();
    const clamped = Math.min(Math.max(ct, start), end);
    return ((clamped - start) / (end - start)) * 100;
  }, [trip.startTime, trip.endTime, state.currentTime]);

  const dateTimeStr = state.currentTime.toLocaleString(t.dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="playback-controls">
      <div className="controls-top">
        <span className="time-display" title={t.selectedTime}>
          {dateTimeStr}
        </span>
        <div className="controls-top-stats" aria-label={t.photoTrackStats}>
          <span className="photo-count">{t.photoCount(trip.photos.length)}</span>
          <span className="controls-top-stats-sep" aria-hidden>
            ·
          </span>
          <span
            className="track-point-count"
            title={t.gpxCoordCount}
          >
            {t.gpsPoints(trip.track.length.toLocaleString(t.dateLocale))}
          </span>
        </div>
      </div>

      <div className="timeline-bar">
        <div className="timeline-track">
          <div
            className="timeline-progress"
            style={{ width: `${linearProgressPct}%` }}
          />
          {photosSorted.map((p, idx) => {
            const gTime = p.time.getTime();
            const start = trip.startTime.getTime();
            const end = trip.endTime.getTime();
            const pct = end > start ? ((gTime - start) / (end - start)) * 100 : 0;
            return (
              <div
                key={`${getPhotoName(p)}-${gTime}-${idx}`}
                className="timeline-photo-mark"
                style={{ left: `${pct}%` }}
              >
                <button
                  type="button"
                  className="timeline-photo-tick"
                  title={t.jumpToThisTime}
                  aria-label={t.jumpToPhoto(idx + 1)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpToPhoto(idx);
                  }}
                />
              </div>
            );
          })}
        </div>

        {gpsTimelinePoints.length > 0 && (
          <div
            className="timeline-gps-strip"
            role="presentation"
            aria-label={t.gpsTrackPoints(trip.track.length)}
          >
            {gpsTimelinePoints.map((pt, i) => {
              const tMs = pt.time.getTime();
              const start = trip.startTime.getTime();
              const end = trip.endTime.getTime();
              const pct = end > start ? ((tMs - start) / (end - start)) * 100 : 0;
              return (
                <div
                  key={`gps-tl-${pt.time.getTime()}-${i}`}
                  className="timeline-gps-mark"
                  style={{ left: `${pct}%` }}
                >
                  <button
                    type="button"
                    className="timeline-gps-dot-btn"
                    title={t.jumpToGpsTime}
                    aria-label={t.trackTime(new Date(tMs).toLocaleString(t.dateLocale))}
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToTripTime(tMs);
                    }}
                  >
                    <span className="timeline-gps-dot" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
