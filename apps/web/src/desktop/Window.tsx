/**
 * Yeniden kullanılabilir pencere çerçevesi.
 *
 * Faz A: sabit konumlu, tema duyarlı pencere.
 * Faz B (pencere yöneticisi): sürükleme, boyutlandırma, küçültme, z-sırası
 * bu bileşenin üzerine eklenecek — bu yüzden arayüzü şimdiden buna uygun.
 */

import "./Window.css";

export interface WindowProps {
  title: string;
  icon?: string;
  /** Kapatma düğmesi gösterilsin mi */
  onClose?: () => void;
  /** Genişlik sınırı (px). Verilmezse içerik kadar. */
  width?: number;
  /** Pencere içeriği */
  children: React.ReactNode;
  /** Ek sınıf */
  className?: string;
}

export function Window({ title, icon, onClose, width, children, className }: WindowProps) {
  return (
    <section
      className={`window${className ? ` ${className}` : ""}`}
      style={width ? { width: `min(${width}px, 100%)` } : undefined}
      aria-label={title}
    >
      <header className="window__titlebar">
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="window__title">{title}</span>
        <div className="window__dots">
          <span className="window__dot window__dot--min" aria-hidden="true" />
          <span className="window__dot window__dot--max" aria-hidden="true" />
          {onClose ? (
            <button
              type="button"
              className="window__dot window__dot--close"
              onClick={onClose}
              aria-label="Kapat"
            />
          ) : (
            <span className="window__dot window__dot--close" aria-hidden="true" />
          )}
        </div>
      </header>
      <div className="window__body">{children}</div>
    </section>
  );
}

/** Pencereler arasında kenarlık/gölge ayıran ortak kart. */
export function Card({
  label,
  value,
  detail,
  tone = "info",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "ok" | "warn" | "err" | "info";
}) {
  return (
    <div className="ui-card">
      <div className="ui-card__label">{label}</div>
      <div className={`ui-card__value ${tone}`}>{value}</div>
      {detail && <div className="ui-card__detail">{detail}</div>}
    </div>
  );
}
