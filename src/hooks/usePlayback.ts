import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip, PlaybackState } from '../types';
import { findPositionAtTime } from '../utils/interpolation';
import { computeTotalPlaybackDuration } from '../utils/speedZones';
import { tripTimeMsToPlaybackMs } from '../utils/tripPlaybackLinear';
import { sortPhotosByTime } from '../utils/sortPhotos';

/** 자동 재생 없음 — 타임라인/사진 클릭으로 시점만 이동 */
export function usePlayback(trip: Trip | null) {
  const [state, setState] = useState<PlaybackState>({
    currentTime: new Date(),
    progress: 0,
    activePhotoIndex: null,
  });

  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);

  const playbackTimeRef = useRef(0);

  const totalDuration = trip ? computeTotalPlaybackDuration(trip.speedSegments) : 0;

  const updatePosition = useCallback(
    (tripTimeMs: number) => {
      if (!trip || trip.track.length === 0) return;
      const pos = findPositionAtTime(trip.track, new Date(tripTimeMs));
      if (pos) {
        setPosition({ ...pos });
      }
    },
    [trip],
  );

  const jumpToPhoto = useCallback(
    (photoIndex: number) => {
      if (!trip) return;
      const sorted = sortPhotosByTime(trip.photos);
      if (photoIndex < 0 || photoIndex >= sorted.length) return;
      const photo = sorted[photoIndex]!;
      const tripTimeMs = photo.time.getTime();
      playbackTimeRef.current = tripTimeMsToPlaybackMs(
        trip.startTime.getTime(),
        trip.endTime.getTime(),
        tripTimeMs,
        totalDuration,
      );

      setState({
        currentTime: photo.time,
        progress: totalDuration > 0 ? playbackTimeRef.current / totalDuration : 0,
        activePhotoIndex: photoIndex,
      });
      if (trip.track.length === 0) {
        if (photo.gpsSource !== 'none') {
          setPosition({ lat: photo.lat, lon: photo.lon });
        } else {
          setPosition(null);
        }
      } else {
        updatePosition(tripTimeMs);
      }
    },
    [trip, totalDuration, updatePosition],
  );

  const dismissOverlay = useCallback(() => {
    setState((prev) => ({ ...prev, activePhotoIndex: null }));
  }, []);

  /** 타임라인 GPS 점 등: 해당 시각으로 이동 (사진 선택 해제) */
  const jumpToTripTimeMs = useCallback(
    (tripTimeMs: number) => {
      if (!trip) return;
      const start = trip.startTime.getTime();
      const end = trip.endTime.getTime();
      const clamped = Math.min(Math.max(tripTimeMs, start), end);

      playbackTimeRef.current = tripTimeMsToPlaybackMs(
        start,
        end,
        clamped,
        totalDuration,
      );

      setState({
        currentTime: new Date(clamped),
        progress: totalDuration > 0 ? playbackTimeRef.current / totalDuration : 0,
        activePhotoIndex: null,
      });

      if (trip.track.length === 0) {
        setPosition(null);
      } else {
        updatePosition(clamped);
      }
    },
    [trip, totalDuration, updatePosition],
  );

  useEffect(() => {
    if (!trip) {
      setPosition(null);
      return;
    }
    playbackTimeRef.current = 0;
    setState({
      currentTime: trip.startTime,
      progress: 0,
      activePhotoIndex: null,
    });
    if (trip.track.length === 0) {
      setPosition(null);
    } else {
      updatePosition(trip.startTime.getTime());
    }
  }, [trip, updatePosition]);

  return {
    state,
    position,
    jumpToPhoto,
    jumpToTripTimeMs,
    dismissOverlay,
  };
}
