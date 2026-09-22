/**
 * Interactive Deadline — animasyonlu ilerleme çubuğu.
 *
 * Referans: "Interactive Deadline" (staff, krank çeviren figür, son tarih
 * sayacı, alevler). Burada **yeniden kullanılabilir bir React bileşeni** olarak
 * yazıldı: belirli süreli işlemlerde kalan süreyi ve ilerlemeyi gösterir.
 *
 * Referansın görsel dili korunur: kırmızı/beyaz kontrast, ilerleme dolgusu,
 * ilerleme başında yürüyen figür ve son tarih sayacı.
 *
 * Ayar: `loading.progressBarStyle` = "deadline" | "simple"
 */

import { useEffect, useMemo, useRef, useState } from "react";

import "./DeadlineBar.css";

export interface DeadlineBarProps {
  /** İlerleme (0-1). Belirsizse `undefined` → süresiz mod. */
  value?: number;
  /** Toplam süre (saniye) — kalan süreyi hesaplamak için */
  totalSeconds?: number;
  /** Etiket (işlem adı) */
  label?: string;
  /** İşlem bitti mi */
  done?: boolean;
  /** Hata oluştu mu */
  failed?: boolean;
  /** Yürüyen figür gösterilsin mi */
  showWalker?: boolean;
  /** Kompakt görünüm */
  compact?: boolean;
}

/** Saniyeyi mm:ss biçimine çevirir. */
function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function DeadlineBar({
  value,
  totalSeconds,
  label = "İşlem sürüyor",
  done = false,
  failed = false,
  showWalker = true,
  compact = false,
}: DeadlineBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Süre sayacı
  useEffect(() => {
    if (done || failed) return undefined;
    startRef.current = Date.now();
    const timer = window.setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [done, failed]);

  const progress = useMemo(() => {
    if (typeof value === "number") return Math.max(0, Math.min(1, value));
    if (typeof totalSeconds === "number" && totalSeconds > 0) {
      return Math.max(0, Math.min(1, elapsed / totalSeconds));
    }
    return 0;
  }, [value, totalSeconds, elapsed]);

  const remaining =
    typeof totalSeconds === "number" ? Math.max(0, totalSeconds - elapsed) : null;

  const state = failed ? "failed" : done ? "done" : "running";

  return (
    <div className={`deadline deadline--${state}${compact ? " deadline--compact" : ""}`}>
      <div className="deadline__header">
        <span className="deadline__label">{label}</span>
        <span className="deadline__time mono">
          {failed
            ? "başarısız"
            : done
              ? "tamamlandı"
              : remaining !== null
                ? formatSeconds(remaining)
                : `${Math.round(progress * 100)}%`}
        </span>
      </div>

      <div
        className="deadline__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={label}
      >
        {/* Kırmızı dolgu */}
        <div className="deadline__fill" style={{ width: `${progress * 100}%` }}>
          <span className="deadline__fill-stripe" />
        </div>

        {/* Yürüyen figür — ilerleme başında */}
        {showWalker && !done && !failed && (
          <div className="deadline__walker" style={{ left: `${progress * 100}%` }}>
            <span className="walker__head" />
            <span className="walker__body" />
            <span className="walker__arm walker__arm--left" />
            <span className="walker__arm walker__arm--right" />
            <span className="walker__leg walker__leg--left" />
            <span className="walker__leg walker__leg--right" />
          </div>
        )}
      </div>

      {!compact && (
        <div className="deadline__footer">
          <span className="deadline__percent mono">{Math.round(progress * 100)}%</span>
          {remaining !== null && !done && !failed && (
            <span className="deadline__remaining">
              <span aria-hidden="true">⏳</span> {formatSeconds(remaining)} kaldı
            </span>
          )}
          {done && (
            <span className="deadline__ok">
              <span aria-hidden="true">✅</span> Tamamlandı
            </span>
          )}
          {failed && (
            <span className="deadline__fail">
              <span aria-hidden="true">⚠️</span> Başarısız
            </span>
          )}
        </div>
      )}
    </div>
  );
}
