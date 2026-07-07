import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'mocktest_timer_';

/**
 * Timestamp-based countdown timer hook.
 *
 * Uses real Date.now() timestamps instead of decrement — survives page refresh,
 * tab switches, and CPU throttling. Persists state to localStorage.
 *
 * @param {object} options
 * @param {number} options.durationSeconds - Total countdown time in seconds
 * @param {string} options.timerId - Unique ID for localStorage persistence
 * @param {Function} options.onExpiry - Callback when timer reaches 0
 * @param {boolean} options.autoStart - Whether to start immediately
 * @returns {{ timeLeft, elapsed, totalDuration, isRunning, start, pause, resume, stop, formattedTimeLeft, formattedElapsed, isWarning, isDanger }}
 */
export function useTimer({
  durationSeconds = 1800,
  timerId = 'default',
  onExpiry = () => {},
  autoStart = false,
} = {}) {
  const storageKey = STORAGE_PREFIX + timerId;
  const expiryRef = useRef(onExpiry);
  const tickRef = useRef(null);
  const expiredRef = useRef(false);

  // Load persisted state or create fresh
  const loadState = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate saved state
        if (parsed.startedAt && parsed.totalDurationMs) {
          return parsed;
        }
      }
    } catch { /* ignore corrupt data */ }
    return null;
  }, [storageKey]);

  // Calculate current values from persisted timestamps
  const calcFromState = useCallback((state) => {
    if (!state || !state.startedAt) {
      return { timeLeft: durationSeconds, elapsed: 0 };
    }

    const totalMs = state.totalDurationMs;
    const now = Date.now();

    let elapsedMs;
    if (state.isRunning) {
      elapsedMs = now - state.startedAt - (state.totalPausedMs || 0);
    } else {
      // Paused: elapsed is up to when it was paused
      elapsedMs = (state.pausedAt || now) - state.startedAt - (state.totalPausedMs || 0);
    }

    elapsedMs = Math.max(0, elapsedMs);
    const remainingMs = Math.max(0, totalMs - elapsedMs);

    return {
      timeLeft: Math.ceil(remainingMs / 1000),
      elapsed: Math.floor(elapsedMs / 1000),
    };
  }, [durationSeconds]);

  // Initialize state
  const [timerState, setTimerState] = useState(() => {
    const saved = loadState();
    if (saved) {
      const { timeLeft, elapsed } = calcFromState(saved);
      return { timeLeft, elapsed, isRunning: saved.isRunning && timeLeft > 0 };
    }
    return { timeLeft: durationSeconds, elapsed: 0, isRunning: false };
  });

  // Keep expiry callback ref current
  useEffect(() => {
    expiryRef.current = onExpiry;
  }, [onExpiry]);

  // Persist state to localStorage
  const persist = useCallback((data) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch { /* localStorage full — degrade gracefully */ }
  }, [storageKey]);

  // Clear persisted state
  const clearPersisted = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [storageKey]);

  // Tick function — recalculates from real timestamps every 250ms
  const tick = useCallback(() => {
    const saved = loadState();
    if (!saved || !saved.isRunning) return;

    const { timeLeft, elapsed } = calcFromState(saved);

    setTimerState({ timeLeft, elapsed, isRunning: true });

    // Check expiry
    if (timeLeft <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      // Stop the timer
      const updated = { ...saved, isRunning: false };
      persist(updated);
      setTimerState({ timeLeft: 0, elapsed: Math.floor(saved.totalDurationMs / 1000), isRunning: false });

      // Fire expiry callback
      setTimeout(() => expiryRef.current(), 0);
    }
  }, [loadState, calcFromState, persist]);

  // Start/stop interval based on running state
  useEffect(() => {
    if (timerState.isRunning) {
      tickRef.current = setInterval(tick, 250); // 250ms for accuracy
      return () => clearInterval(tickRef.current);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
  }, [timerState.isRunning, tick]);

  // Auto-start on mount if requested and no saved state
  useEffect(() => {
    if (autoStart && !loadState()) {
      start();
    } else if (autoStart && loadState()?.isRunning) {
      // Resume from saved state
      tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Public API ----

  const start = useCallback(() => {
    expiredRef.current = false;
    const now = Date.now();
    const state = {
      startedAt: now,
      totalDurationMs: durationSeconds * 1000,
      isRunning: true,
      pausedAt: null,
      totalPausedMs: 0,
    };
    persist(state);
    setTimerState({ timeLeft: durationSeconds, elapsed: 0, isRunning: true });
  }, [durationSeconds, persist]);

  const pause = useCallback(() => {
    const saved = loadState();
    if (!saved || !saved.isRunning) return;

    const updated = {
      ...saved,
      isRunning: false,
      pausedAt: Date.now(),
    };
    persist(updated);

    const { timeLeft, elapsed } = calcFromState(updated);
    setTimerState({ timeLeft, elapsed, isRunning: false });
  }, [loadState, persist, calcFromState]);

  const resume = useCallback(() => {
    const saved = loadState();
    if (!saved || saved.isRunning) return;
    if (!saved.pausedAt) return;

    // Add the paused duration to totalPausedMs
    const pauseDuration = Date.now() - saved.pausedAt;
    const updated = {
      ...saved,
      isRunning: true,
      pausedAt: null,
      totalPausedMs: (saved.totalPausedMs || 0) + pauseDuration,
    };
    persist(updated);

    expiredRef.current = false;
    const { timeLeft, elapsed } = calcFromState(updated);
    setTimerState({ timeLeft, elapsed, isRunning: true });
  }, [loadState, persist, calcFromState]);

  const stop = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    clearPersisted();
    setTimerState({ timeLeft: durationSeconds, elapsed: 0, isRunning: false });
  }, [durationSeconds, clearPersisted]);

  /**
   * Get the real start timestamp (for accurate time-taken calculation on submit).
   */
  const getStartTimestamp = useCallback(() => {
    const saved = loadState();
    return saved?.startedAt || null;
  }, [loadState]);

  /**
   * Get the real elapsed milliseconds (for accurate time-taken on submit).
   */
  const getRealElapsedMs = useCallback(() => {
    const saved = loadState();
    if (!saved) return 0;
    const { elapsed } = calcFromState(saved);
    return elapsed * 1000;
  }, [loadState, calcFromState]);

  // Format helpers
  const formatTime = (seconds) => {
    const s = Math.max(0, Math.round(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return {
    timeLeft: timerState.timeLeft,
    elapsed: timerState.elapsed,
    totalDuration: durationSeconds,
    isRunning: timerState.isRunning,
    start,
    pause,
    resume,
    stop,
    getStartTimestamp,
    getRealElapsedMs,
    formattedTimeLeft: formatTime(timerState.timeLeft),
    formattedElapsed: formatTime(timerState.elapsed),
    isWarning: timerState.timeLeft <= 300 && timerState.timeLeft > 60,
    isDanger: timerState.timeLeft <= 60 && timerState.timeLeft > 0,
  };
}
