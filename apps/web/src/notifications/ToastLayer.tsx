/**
 * Bildirim katmanı — sağ altta Windows 11 tarzı toast'lar.
 */

import { useSettingsStore } from "../settings/store";
import { SystemIcon } from "../icons";
import { useToastStore, type ToastKind } from "./toastStore";
import "./ToastLayer.css";

const KIND_ICON: Record<ToastKind, React.ReactNode> = {
  info: <SystemIcon name="about" size={26} />,
  ok: <SystemIcon name="overview" size={26} />,
  warn: <SystemIcon name="status" size={26} />,
  error: <SystemIcon name="database" size={26} />,
};

export function ToastLayer() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const motion = useSettingsStore((state) => state.settings.appearance.motion);

  if (toasts.length === 0) return null;

  return (
    <div
      className={`toasts${motion === "reduced" ? " toasts--reduced" : ""}`}
      role="region"
      aria-label="Bildirimler"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast toast--${item.kind}`}
          role="alert"
          onClick={() => dismiss(item.id)}
          title="Kapatmak için tıkla"
        >
          <span className="toast__icon" aria-hidden="true">
            {KIND_ICON[item.kind]}
          </span>

          <div className="toast__body">
            {item.source && <span className="toast__source">{item.source}</span>}
            <strong className="toast__title">{item.title}</strong>
            {item.message && <p className="toast__message">{item.message}</p>}
          </div>

          <button
            type="button"
            className="toast__close"
            aria-label="Kapat"
            onClick={(event) => {
              event.stopPropagation();
              dismiss(item.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
