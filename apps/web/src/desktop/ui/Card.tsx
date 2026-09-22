/**
 * Durum kartı — etiket, değer ve açıklama.
 *
 * Durum pencerelerinde küçük bilgi kutuları için kullanılır.
 */

import "./Card.css";

export type CardTone = "ok" | "warn" | "err" | "info";

export interface CardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: CardTone;
}

export function Card({ label, value, detail, tone = "info" }: CardProps) {
  return (
    <div className="ui-card">
      <div className="ui-card__label">{label}</div>
      <div className={`ui-card__value ${tone}`}>{value}</div>
      {detail && <div className="ui-card__detail">{detail}</div>}
    </div>
  );
}
