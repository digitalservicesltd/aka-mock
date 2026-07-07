import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Countdown timer hook for test-taking.
 *
 * @param {number} totalSeconds - Total countdown time in seconds
 * @param {Function} onExpiry - Callback when timer reaches 0
 * @param {boolean} autoStart - Whether to start immediately
 * @returns {{ timeLeft, isRunning, start, pause, resume, reset, formattedTime }}
 */
export function useTimer(totalSeconds, onExpiry = () => {}, autoStart = false) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef(null);
  const expiryRef = useRef(onExpiry);
  const startTimeRef = useRef(null);
  const expectedTimeRef = useRef(null);

  // Keep callback ref up to date
  useEffect(() => {
    expiryRef.current = onExpiry;
  }, [onExpiry]);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Timer logic with drift correction
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    startTimeRef.current = Date.now();
    expectedTimeRef.current = startTimeRef.current + 1000;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const drift = now - expectedTimeRef.current;

      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          // Use setTimeout to avoid state update during render
          setTimeout(() => expiryRef.current(), 0);
          return 0;
        }
        return newTime;
      });

      // Adjust for drift
      expectedTimeRef.current += 1000;
      const nextDelay = Math.max(0, 1000 - drift);
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsRunning(false);
            setTimeout(() => expiryRef.current(), 0);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }, Math.max(0, 1000 - (Date.now() - startTimeRef.current) % 1000));

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  const reset = useCallback((newTotal) => {
    setIsRunning(false);
    setTimeLeft(newTotal ?? totalSeconds);
  }, [totalSeconds]);

  const formatTime = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  return {
    timeLeft,
    isRunning,
    start,
    pause,
    resume,
    reset,
    formattedTime: formatTime(timeLeft),
    isWarning: timeLeft <= 300 && timeLeft > 60, // < 5 min
    isDanger: timeLeft <= 60, // < 1 min
  };
}
