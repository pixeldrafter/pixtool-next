/**
 * Donanım widget katmanı.
 *
 * Masaüstünde hava durumu kartları gibi duran canlı donanım kartları:
 *   • Sağ alttaki **+** ile yeni widget eklenir (menüden tür seçilir)
 *   • Kartlar sürüklenir, **×** ile kaldırılır
 *   • Metrikler yerel köprüden ~2,5 sn'de bir okunur
 *
 * Konum ve seçim kullanıcıya özel olarak saklanır (yerel + sunucu).
 */

import { useEffect, useState } from "react";

import { useSettings } from "../settings";
import { useHardwareMetrics } from "./useHardwareMetrics";
import { WidgetCard } from "./WidgetCard";
import { WIDGET_KINDS, useWidgetsStore } from "./widgetsStore";
import "./Widgets.css";

export function WidgetLayer() {
  const widgets = useWidgetsStore((state) => state.widgets);
  const add = useWidgetsStore((state) => state.add);
  const { settings } = useSettings();

  const [menuOpen, setMenuOpen] = useState(false);

  // Metrikler yalnızca widget varsa okunsun; termal yalnızca termal kart varsa
  const hasThermal = widgets.some((widget) => widget.kind === "thermal");
  const metrics = useHardwareMetrics({
    intervalMs: widgets.length > 0 ? 2500 : 15000,
    needThermal: hasThermal,
    bridgeUrl: settings.bridge.url,
    bridgeToken: settings.bridge.token || undefined,
  });

  // Menü dışına tıklayınca kapat
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (): void => setMenuOpen(false);
    window.addEventListener("pointerdown", close, { once: true });
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  return (
    <>
      {widgets.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} metrics={metrics} />
      ))}

      <div className="wg-add">
        {menuOpen && (
          <div className="wg-add__menu" onPointerDown={(event) => event.stopPropagation()}>
            {WIDGET_KINDS.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className="wg-add__item"
                onClick={() => {
                  add(kind.id);
                  setMenuOpen(false);
                }}
              >
                <span aria-hidden="true">{kind.icon}</span>
                <span className="wg-add__label">
                  <strong>{kind.label}</strong>
                  <small>{kind.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`wg-add__btn${menuOpen ? " is-active" : ""}`}
          onClick={() => setMenuOpen((value) => !value)}
          title="Donanım widget'ı ekle"
        >
          <span aria-hidden="true">＋</span>
        </button>
      </div>
    </>
  );
}
