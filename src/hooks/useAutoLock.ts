import { useEffect, useRef } from 'react';

const EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/** Calls onLock after `timeoutMs` of no user input. Resets on any activity. */
export function useAutoLock(timeoutMs: number, onLock: () => void, enabled: boolean): void {
  const timer = useRef<number | null>(null);
  const cb = useRef(onLock);
  cb.current = onLock;

  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => cb.current(), timeoutMs);
    };
    reset();
    for (const ev of EVENTS) window.addEventListener(ev, reset, { passive: true });
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      for (const ev of EVENTS) window.removeEventListener(ev, reset);
    };
  }, [enabled, timeoutMs]);
}
