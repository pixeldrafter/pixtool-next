/**
 * Bekleme perdesi (bg.gif).
 *
 * Belirsiz süreli işlemlerde tam ekran bir perde açar: arka planda `bg.gif`
 * animasyonu, üstünde karartma ve durum mesajı.
 *
 * İş bölümü:
 *   • Belirli süreli işlem  → `DeadlineBar` (kalan süre bilinir)
 *   • Belirsiz bekleme      → bu bileşen (bg.gif)
 *
 * Ayar: `loading.waitingCurtain` (kapatılabilir), `loading.curtainDim`
 */

import { useEffect, useState } from "react";

import "./WaitingCurtain.css";

export interface WaitingCurtainProps {
  /** Perde görünsün mü */
  visible: boolean;
  /** Durum mesajı */
  message?: string;
  /** Alt açıklama */
  detail?: string;
  /** İlerleme (0-1) — verilirse çubuk da gösterilir */
  progress?: number;
  /** Karartma oranı (0-1) */
  dim?: number;
  /** İptal edilebilir mi */
  onCancel?: () => void;
}

/** Bu süreden sonra "hâlâ çalışıyor" ipucu gösterilir (ms). */
const SLOW_HINT_MS = 5000;

export function WaitingCurtain({
  visible,
  message = "Yükleniyor…",
  detail,
  progress,
  dim = 0.7,
  onCancel,
}: WaitingCurtainProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
    return () => window.clearInterval(timer);
  }, [visible]);

  // ESC ile iptal
  useEffect(() => {
    if (!visible || !onCancel) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  const slow = elapsed > SLOW_HINT_MS;

  return (
    <div className="curtain" role="status" aria-live="polite">
      <div className="curtain__bg" />
      <div className="curtain__dim" style={{ opacity: dim }} />

      <div className="curtain__content">
        <div className="curtain__spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="curtain__message">{message}</div>

        {detail && <div className="curtain__detail">{detail}</div>}

        {typeof progress === "number" && (
          <div className="curtain__progress">
            <div className="curtain__progress-fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}

        {!progress && (
          <div className="curtain__bar" aria-hidden="true">
            <span className="curtain__bar-fill" />
          </div>
        )}

        {slow && !onCancel && (
          <div className="curtain__slow">Bu işlem beklenenden uzun sürüyor…</div>
        )}

        {onCancel && (
          <button type="button" className="curtain__cancel" onClick={onCancel}>
            İptal <span className="mono">(ESC)</span>
          </button>
        )}
      </div>
    </div>
  );
}
