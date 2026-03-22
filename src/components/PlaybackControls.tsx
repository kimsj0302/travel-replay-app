import { useMemo } from 'react';
import type { PlaybackState, Trip } from '../types';
import { sortPhotosByTime } from '../utils/sortPhotos';

interface PlaybackControlsProps {
  state: PlaybackState;
  trip: Trip;
  onJumpToPhoto: (photoIndex: number) => void;
}

export default function PlaybackControls({ state, trip, onJumpToPhoto }: PlaybackControlsProps) {
  const photosSorted = useMemo(() => sortPhotosByTime(trip.photos), [trip.photos]);

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
        <span className="photo-count">{trip.photos.length}장</span>
      </div>

      <div className="timeline-bar">
        <div className="timeline-track">
          <div
            className="timeline-progress"
            style={{ width: `${state.progress * 100}%` }}
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
      </div>
    </div>
  );
}
