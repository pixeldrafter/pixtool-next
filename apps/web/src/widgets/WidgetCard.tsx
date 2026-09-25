/**
 * Tek bir donanım widget kartı.
 *
 * Başlıktan sürüklenir, × ile kaldırılır. Gövde, widget türüne göre canlı
 * metriği gösterir (CPU/RAM/Disk/Sıcaklık).
 */

import { useCallback } from "react";

import type { HardwareMetrics } from "./useHardwareMetrics";
import { WIDGET_KINDS, useWidgetsStore, type WidgetInstance } from "./widgetsStore";
import "./Widgets.css";

/** Yüzdeye göre renk tonu. */
function tone(percent: number | null): string {
  if (percent === null) return "is-idle";
  if (percent >= 90) return "is-crit";
  if (percent >= 70) return "is-warn";
  return "is-ok";
}

/** Yüzde çubuğu. */
function Bar({ percent }: { percent: number | null }) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div className={`wg__bar ${tone(percent)}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

interface WidgetCardProps {
  widget: WidgetInstance;
  metrics: HardwareMetrics;
}

export function WidgetCard({ widget, metrics }: WidgetCardProps) {
  const remove = useWidgetsStore((state) => state.remove);
  const move = useWidgetsStore((state) => state.move);
  const width = useWidgetsStore((state) => state.width);

  const meta = WIDGET_KINDS.find((item) => item.id === widget.kind);
  const title = meta?.label ?? widget.kind;
  const icon = meta?.icon ?? "◈";

  // --- Sürükleme (pencere seviyesinde dinle: fare kartın dışına çıksa da takip) ---
  const handleDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest("button")) return;
      if (event.button !== 0) return;
      event.preventDefault();

      const offsetX = event.clientX - widget.x;
      const offsetY = event.clientY - widget.y;

      const onMove = (moveEvent: PointerEvent): void => {
        const maxX = Math.max(4, window.innerWidth - width - 8);
        const maxY = Math.max(4, window.innerHeight - 120);
        const x = Math.max(4, Math.min(moveEvent.clientX - offsetX, maxX));
        const y = Math.max(4, Math.min(moveEvent.clientY - offsetY, maxY));
        move(widget.id, x, y);
      };

      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [move, widget.id, widget.x, widget.y, width],
  );

  return (
    <article
      className={`wg wg--${widget.kind}`}
      style={{ left: widget.x, top: widget.y, width: width + 16 }}
    >
      <div className="wg__bar-head" onPointerDown={handleDrag} title="Sürükleyerek taşı">
        <span className="wg__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="wg__title">{title}</span>
        <button
          type="button"
          className="wg__close"
          onClick={() => remove(widget.id)}
          title="Kaldır"
          aria-label="Widget'ı kaldır"
        >
          ✕
        </button>
      </div>

      <div className="wg__body">
        {!metrics.ok ? (
          <div className="wg__empty">
            {metrics.loading ? "Ölçülüyor…" : metrics.error ?? "Köprü yok"}
          </div>
        ) : (
          <WidgetBody widget={widget} metrics={metrics} />
        )}
      </div>
    </article>
  );
}

/** Gövde — widget türüne göre. */
function WidgetBody({ widget, metrics }: { widget: WidgetInstance; metrics: HardwareMetrics }) {
  if (widget.kind === "cpu") {
    const percent = metrics.cpu.percent;
    return (
      <>
        <div className="wg__readout">
          <span className={`wg__value ${tone(percent)}`}>
            {percent === null ? "—" : Math.round(percent)}
          </span>
          <span className="wg__unit">%</span>
        </div>
        <Bar percent={percent} />
        <div className="wg__foot">
          <span title={metrics.cpu.model}>
            {metrics.cpu.cores ? `${metrics.cpu.cores} çekirdek` : "işlemci"}
          </span>
          <span>
            {metrics.cpu.frequencyMhz ? `${Math.round(metrics.cpu.frequencyMhz)} MHz` : ""}
          </span>
        </div>
      </>
    );
  }

  if (widget.kind === "memory") {
    const percent = metrics.memory.percent;
    return (
      <>
        <div className="wg__readout">
          <span className={`wg__value ${tone(percent)}`}>
            {percent === null ? "—" : Math.round(percent)}
          </span>
          <span className="wg__unit">%</span>
        </div>
        <Bar percent={percent} />
        <div className="wg__foot">
          <span>{metrics.memory.usedHuman || "—"}</span>
          <span>{metrics.memory.totalHuman ? `/ ${metrics.memory.totalHuman}` : ""}</span>
        </div>
      </>
    );
  }

  if (widget.kind === "disk") {
    const list = metrics.disks.slice(0, 3);
    if (list.length === 0) return <div className="wg__empty">Bölüm bulunamadı</div>;
    return (
      <div className="wg__list">
        {list.map((disk) => (
          <div className="wg__row" key={disk.mountpoint}>
            <span className="wg__row-label" title={disk.mountpoint}>
              {disk.mountpoint}
            </span>
            <span className={`wg__row-pct ${tone(disk.percent)}`}>
              {disk.percent === null ? "—" : `${Math.round(disk.percent)}%`}
            </span>
            <Bar percent={disk.percent} />
          </div>
        ))}
      </div>
    );
  }

  if (widget.kind === "thermal") {
    const list = metrics.thermal.slice(0, 4);
    if (list.length === 0) return <div className="wg__empty">Sensör yok</div>;
    return (
      <div className="wg__list">
        {list.map((sensor) => (
          <div className="wg__row" key={sensor.label}>
            <span className="wg__row-label" title={sensor.label}>
              {sensor.label}
            </span>
            <span
              className={`wg__row-pct ${
                sensor.celsius >= 85 ? "is-crit" : sensor.celsius >= 70 ? "is-warn" : "is-ok"
              }`}
            >
              {Math.round(sensor.celsius)}°
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
