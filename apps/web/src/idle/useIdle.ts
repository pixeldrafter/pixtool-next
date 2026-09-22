/**
 * Hareketsizlik (idle) takibi.
 *
 * Kullanıcı belirtilen süre boyunca fare/klavye kullanmazsa `isIdle` true olur.
 * Herhangi bir etkileşimde sıfırlanır.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

export interface UseIdleResult {
  isIdle: boolean;
  /** Sayacı sıfırlar (boşta ekranından dönüş). */
  reset: () => void;
  /** Şu ana kadar hareketsiz geçen süre (saniye) — teşhis için. */
  idleSeconds: number;
}

export function useIdle(enabled: boolean, minutes: number): UseIdleResult {
  const [isIdle, setIsIdle] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleSeconds(0);
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }
  }, []);

  const reset = useCallback(() => {
    markActivity();
  }, [markActivity]);

  useEffect(() => {
    if (!enabled || minutes <= 0) {
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setIsIdle(false);
      }
      return undefined;
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      setIdleSeconds(Math.floor(elapsed));

      if (elapsed >= minutes * 60 && !isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActivity);
      }
      window.clearInterval(timer);
    };
  }, [enabled, minutes, markActivity]);

  return { isIdle, reset, idleSeconds };
}
