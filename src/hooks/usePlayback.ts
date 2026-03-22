import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip, PlaybackState, SpeedOption } from '../types';
import { findPositionAtTime } from '../utils/interpolation';
import { computeTotalPlaybackDuration } from '../utils/speedZones';
import { playbackMsToTripTimeMs, tripTimeMsToPlaybackMs } from '../utils/tripPlaybackLinear';

const PHOTO_PAUSE_DURATION = 1500;

export function usePlayback(trip: Trip | null) {
  const [state, setState] = useState<PlaybackState>({
    mode: 'timeline',
    playing: false,
    currentTime: new Date(),
    progress: 0,
    activeGroupIndex: null,
    paused: false,
    pauseUntil: null,
    userSpeed: 1,
  });

  const posRef = useRef<{ lat: number; lon: number } | null>(null);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const tripRef = useRef(trip);
  tripRef.current = trip;

  const animRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const playbackTimeRef = useRef<number>(0);
  const userSpeedRef = useRef<SpeedOption>(1);

  const triggeredGroupsRef = useRef<Set<number>>(new Set());

  const totalDuration = trip ? computeTotalPlaybackDuration(trip.speedSegments) : 0;

  const updatePosition = useCallback(
    (tripTimeMs: number) => {
      if (!trip || trip.track.length === 0) return;
      const pos = findPositionAtTime(trip.track, new Date(tripTimeMs));
      if (pos) {
        posRef.current = pos;
        setPosition({ ...pos });
      }
    },
    [trip],
  );

  const tick = useCallback(
    (now: number) => {
      const t = tripRef.current;
      const s = stateRef.current;
      if (!t || !s.playing) return;

      if (s.pauseUntil && now < s.pauseUntil) {
        lastFrameRef.current = now;
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      if (s.pauseUntil && now >= s.pauseUntil) {
        setState((prev) => ({ ...prev, pauseUntil: null, paused: false }));
      }

      const dt = lastFrameRef.current ? now - lastFrameRef.current : 0;
      lastFrameRef.current = now;

      const cappedDt = Math.min(dt, 100);
      playbackTimeRef.current += cappedDt * userSpeedRef.current;

      const startMs = t.startTime.getTime();
      const endMs = t.endTime.getTime();
      const newTripTimeMs = playbackMsToTripTimeMs(
        startMs,
        endMs,
        playbackTimeRef.current,
        totalDuration,
      );
      const progress = totalDuration > 0 ? playbackTimeRef.current / totalDuration : 0;

      if (progress >= 1) {
        setState((prev) => ({
          ...prev,
          playing: false,
          progress: 1,
          currentTime: t.endTime,
        }));
        updatePosition(t.endTime.getTime());
        return;
      }

      let groupIdx: number | null = s.activeGroupIndex;
      for (const group of t.groups) {
        if (triggeredGroupsRef.current.has(group.id)) continue;
        if (newTripTimeMs >= group.time.getTime()) {
          triggeredGroupsRef.current.add(group.id);
          groupIdx = group.id;
          setState((prev) => ({
            ...prev,
            activeGroupIndex: group.id,
            paused: true,
            pauseUntil: now + PHOTO_PAUSE_DURATION,
          }));
          break;
        }
      }

      setState((prev) => ({
        ...prev,
        currentTime: new Date(newTripTimeMs),
        progress: Math.min(progress, 1),
        activeGroupIndex: groupIdx,
      }));

      updatePosition(newTripTimeMs);
      animRef.current = requestAnimationFrame(tick);
    },
    [totalDuration, updatePosition],
  );

  const play = useCallback(() => {
    if (!trip) return;
    lastFrameRef.current = 0;
    setState((prev) => ({ ...prev, playing: true }));
  }, [trip]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const reset = useCallback(() => {
    if (!trip) return;
    playbackTimeRef.current = 0;
    triggeredGroupsRef.current.clear();
    setState((prev) => ({
      mode: 'timeline',
      playing: false,
      currentTime: trip.startTime,
      progress: 0,
      activeGroupIndex: null,
      paused: false,
      pauseUntil: null,
      userSpeed: prev.userSpeed,
    }));
    updatePosition(trip.startTime.getTime());
  }, [trip, updatePosition]);

  const seekToProgress = useCallback(
    (p: number) => {
      if (!trip) return;
      const clamped = Math.max(0, Math.min(1, p));
      playbackTimeRef.current = clamped * totalDuration;
      triggeredGroupsRef.current.clear();

      const startMs = trip.startTime.getTime();
      const endMs = trip.endTime.getTime();
      const tripTimeMs = playbackMsToTripTimeMs(
        startMs,
        endMs,
        playbackTimeRef.current,
        totalDuration,
      );
      for (const g of trip.groups) {
        if (tripTimeMs >= g.time.getTime()) {
          triggeredGroupsRef.current.add(g.id);
        }
      }

      setState((prev) => ({
        ...prev,
        currentTime: new Date(tripTimeMs),
        progress: clamped,
        activeGroupIndex: null,
      }));
      updatePosition(tripTimeMs);
    },
    [trip, totalDuration, updatePosition],
  );

  const setUserSpeed = useCallback((speed: SpeedOption) => {
    userSpeedRef.current = speed;
    setState((prev) => ({ ...prev, userSpeed: speed }));
  }, []);

  const jumpToGroup = useCallback(
    (groupIndex: number) => {
      if (!trip || groupIndex < 0 || groupIndex >= trip.groups.length) return;
      const group = trip.groups[groupIndex];
      const tripTimeMs = group.time.getTime();
      playbackTimeRef.current = tripTimeMsToPlaybackMs(
        trip.startTime.getTime(),
        trip.endTime.getTime(),
        tripTimeMs,
        totalDuration,
      );

      setState((prev) => ({
        ...prev,
        currentTime: group.time,
        progress: totalDuration > 0 ? playbackTimeRef.current / totalDuration : 0,
        activeGroupIndex: group.id,
        playing: false,
      }));
      updatePosition(tripTimeMs);
    },
    [trip, totalDuration, updatePosition],
  );

  const dismissOverlay = useCallback(() => {
    setState((prev) => ({ ...prev, activeGroupIndex: null, pauseUntil: null, paused: false }));
  }, []);

  useEffect(() => {
    if (state.playing) {
      animRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [state.playing, tick]);

  useEffect(() => {
    if (trip) {
      reset();
    }
  }, [trip]);

  return {
    state,
    position,
    play,
    pause,
    reset,
    seekToProgress,
    setUserSpeed,
    jumpToGroup,
    dismissOverlay,
  };
}
