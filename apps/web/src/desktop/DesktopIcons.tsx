/**
 * Masaüstü ikonları.
 *
 * Sol üstte dikey yerleşim. Çift tıklama veya Enter ile uygulama açılır.
 * Klavye ile gezilebilir.
 */

import { useState } from "react";

import { useWindowManager, type WindowApp } from "./window/windowStore";
import "./DesktopIcons.css";

interface DesktopIcon {
  app: WindowApp;
  label: string;
  icon: string;
}

const ICONS: DesktopIcon[] = [
  { app: "status", label: "Sistem Durumu", icon: "🖥️" },
  { app: "settings", label: "Ayarlar", icon: "⚙️" },
  { app: "about", label: "Hakkında", icon: "ℹ️" },
];

export function DesktopIcons() {
  const open = useWindowManager((state) => state.open);
  const [selected, setSelected] = useState<string | null>(null);

  function activate(app: WindowApp) {
    open(app);
  }

  return (
    <div className="dicons" role="list" aria-label="Masaüstü kısayolları">
      {ICONS.map((icon) => (
        <button
          key={icon.app}
          type="button"
          role="listitem"
          className={`dicon${selected === icon.app ? " is-selected" : ""}`}
          onClick={() => setSelected(icon.app)}
          onDoubleClick={() => activate(icon.app)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activate(icon.app);
            }
          }}
        >
          <span className="dicon__glyph" aria-hidden="true">
            {icon.icon}
          </span>
          <span className="dicon__label">{icon.label}</span>
        </button>
      ))}
    </div>
  );
}
