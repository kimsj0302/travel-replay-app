import { useMemo } from 'react';
import type { PlaybackState, Trip } from '../types';
import { sortPhotosByTime } from '../utils/sortPhotos';
import { sampleTrackVerticesForTimeline } from '../utils/timelineTrackSampling';

/** 타임라인에 너무 많은 DOM을 만들지 않도록 상한 — 시간축 균등 + 가까운 정점 */
const MAX_GPS_TIMELINE_DOTS = 1200;

interface PlaybackControlsProps {
  state: PlaybackState;
  trip: Trip;
  onJumpToPhoto: (photoIndex: number) => void;
}

export default function PlaybackControls({ state, trip, onJumpToPhoto }: PlaybackControlsProps) {
  const photosSorted = useMemo(() => sortPhotosByTime(trip.photos), [trip.photos]);

  const gpsTimelinePoints = useMemo(
    () => sampleTrackVerticesForTimeline(trip.track, MAX_GPS_TIMELINE_DOTS),
    [trip.track],
  );

  /** 사진 틱·GPS 점과 동일: 실제 시각의 선형 위치 (지도 보간 시각과 일치) */
  const linearProgressPct = useMemo(() => {
    const start = trip.startTime.getTime();
    const end = trip.endTime.getTime();
    if (end <= start) return 0;
    const t = state.currentTime.getTime();
    const clamped = Math.min(Math.max(t, start), end);
    return ((clamped - start) / (end - start)) * 100;
  }, [trip.startTime, trip.endTime, state.currentTime]);

  const dateTimeStr = state.currentTime.toLocaleString('ko-KR', {
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
        <span className="time-display" title="선택된 시각">
          {dateTimeStr}
        </span>
        <div className="controls-top-stats" aria-label="사진·궤적 통계">
          <span className="photo-count">{trip.photos.length}장</span>
          <span className="controls-top-stats-sep" aria-hidden>
            ·
          </span>
          <span
            className="track-point-count"
            title="GPX 궤적 좌표 개수(지도·보간에 사용)"
          >
            GPS {trip.track.length.toLocaleString('ko-KR')}포인트
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
                key={`${p.file.name}-${gTime}-${idx}`}
                className="timeline-photo-mark"
                style={{ left: `${pct}%` }}
              >
                <button
                  type="button"
                  className="timeline-photo-tick"
                  title="이 시점으로 이동"
                  aria-label={`사진 ${idx + 1} 해당 시점으로 이동`}
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
            aria-label={`GPS 궤적 포인트 ${trip.track.length}개`}
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
                  <span className="timeline-gps-dot" title="GPS 포인트" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
