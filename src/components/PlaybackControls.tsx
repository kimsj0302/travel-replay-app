import type { PlaybackState, Trip, SpeedOption } from '../types';
import { SPEED_OPTIONS } from '../types';

interface PlaybackControlsProps {
  state: PlaybackState;
  trip: Trip;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: SpeedOption) => void;
  /** 타임라인 주황색 사진 틱 클릭 시 해당 그룹 시점으로 이동 */
  onJumpToGroup: (groupIndex: number) => void;
}

export default function PlaybackControls({
  state,
  trip,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onJumpToGroup,
}: PlaybackControlsProps) {
  const dateTimeStr = state.currentTime.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const groupCount = trip.groups.length;

  return (
    <div className="playback-controls">
      <div className="controls-top">
        <span className="time-display" title="재생 위치 시각">
          {dateTimeStr}
        </span>

        <div className="speed-selector">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={state.userSpeed === s ? 'speed-btn active' : 'speed-btn'}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-bar">
        <div
          className="timeline-progress"
          style={{ width: `${state.progress * 100}%` }}
        />
        {trip.groups.map((g, idx) => {
          const gTime = g.time.getTime();
          const start = trip.startTime.getTime();
          const end = trip.endTime.getTime();
          const pct = end > start ? ((gTime - start) / (end - start)) * 100 : 0;
          return (
            <button
              key={g.id}
              type="button"
              className="timeline-photo-tick"
              style={{ left: `${pct}%` }}
              title={`${g.photos.length}장 · 이 시점으로 이동`}
              aria-label={`사진 그룹 ${idx + 1}, ${g.photos.length}장, 해당 시점으로 이동`}
              onClick={(e) => {
                e.stopPropagation();
                onJumpToGroup(idx);
              }}
            />
          );
        })}
      </div>

      <div className="controls-buttons">
        <button onClick={onReset} title="처음으로">⏮</button>
        {state.playing ? (
          <button onClick={onPause} title="일시정지">⏸</button>
        ) : (
          <button onClick={onPlay} title="재생">▶</button>
        )}
        <span className="photo-count">
          {trip.photos.length}장 · {groupCount}그룹
        </span>
      </div>
    </div>
  );
}
