import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import PlaybackControls from '../components/PlaybackControls';
import PhotoSplitPane from '../components/PhotoSplitPane';
import { usePlayback } from '../hooks/usePlayback';
import { useReplayMapPaneLayout } from '../hooks/useReplayMapPaneLayout';
import { tripToJson, tripToIndexEntry, downloadJson } from '../utils/exportJson';
import type { Trip } from '../types';

interface TripReplayPageProps {
  trip: Trip | null;
}

export default function TripReplayPage({ trip }: TripReplayPageProps) {
  const navigate = useNavigate();
  const {
    state,
    position,
    play,
    pause,
    reset,
    seekToProgress,
    setUserSpeed,
    jumpToGroup,
    dismissOverlay,
  } = usePlayback(trip);

  const mapPaneRef = useRef<HTMLDivElement>(null);
  useReplayMapPaneLayout(
    mapPaneRef,
    `${state.activeGroupIndex ?? 'none'}-${state.playing}`,
  );

  const handleGroupClick = useCallback(
    (idx: number) => {
      jumpToGroup(idx);
    },
    [jumpToGroup],
  );

  const handleExport = useCallback(() => {
    if (!trip) return;
    downloadJson(tripToJson(trip), `${trip.id}-trip.json`);
    downloadJson(tripToIndexEntry(trip), `${trip.id}-index-entry.json`);
  }, [trip]);

  if (!trip) {
    return (
      <div className="no-trip">
        <p>먼저 여행 폴더를 불러와 주세요.</p>
        <button onClick={() => navigate('/')}>돌아가기</button>
      </div>
    );
  }

  const activeGroup =
    state.activeGroupIndex !== null ? trip.groups[state.activeGroupIndex] ?? null : null;

  return (
    <div className="replay-page">
      <header className="replay-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 돌아가기
        </button>
        <h2>{trip.title}</h2>
        <span className="trip-date">{trip.date}</span>
        <button className="export-btn" onClick={handleExport} title="JSON 내보내기">
          ⬇ Export
        </button>
      </header>

      <div className="replay-body">
        <div
          className={`replay-split${activeGroup ? ' replay-split--with-photo' : ''}`}
        >
          <div className="replay-map-pane" ref={mapPaneRef}>
            <MapView
              track={trip.track}
              groups={trip.groups}
              currentPosition={position}
              onGroupClick={handleGroupClick}
              photoPanelOpen={!!activeGroup}
            />
          </div>
          {activeGroup && (
            <PhotoSplitPane group={activeGroup} onClose={dismissOverlay} />
          )}
        </div>
      </div>

      <PlaybackControls
        state={state}
        trip={trip}
        onPlay={play}
        onPause={pause}
        onReset={reset}
        onSeek={seekToProgress}
        onSpeedChange={setUserSpeed}
      />
    </div>
  );
}
