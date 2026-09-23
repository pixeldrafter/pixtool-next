/**
 * Masaüstü ikonları.
 *
 * Windows tarzı: dikey ızgara, etiketli, seçim vurgulu, çift tıklama/Enter
 * ile açılır. İkon boyutu **ayarlardan** seçilir (küçük / orta / büyük).
 *
 * İkonlar emoji değil, elle çizilmiş SVG (`icons/SystemIcon`) — tutarlı ve
 * keskin görünür.
 */

import { useState } from "react";

import { SystemIcon, type SystemIconName } from "../icons";
import { useSettings } from "../settings";
import { useWindowManager, type WindowApp } from "./window/windowStore";
import "./DesktopIcons.css";

interface DesktopIcon {
  app: WindowApp;
  label: string;
  icon: SystemIconName;
}

const ICONS: DesktopIcon[] = [
  { app: "overview", label: "Genel Bakış", icon: "overview" },
  { app: "scripts", label: "Scriptler", icon: "scripts" },
  { app: "terminal", label: "Terminal", icon: "terminal" },
  { app: "files", label: "Dosyalar", icon: "files" },
  { app: "database", label: "Veritabanı", icon: "database" },
  { app: "users", label: "Kullanıcılar", icon: "users" },
  { app: "resources", label: "Kaynaklar", icon: "resources" },
  { app: "status", label: "Durum", icon: "status" },
  { app: "settings", label: "Ayarlar", icon: "settings" },
  { app: "about", label: "Hakkında", icon: "about" },
];

export function DesktopIcons() {
  const open = useWindowManager((state) => state.open);
  const { settings } = useSettings();
  const iconSize = settings.appearance.iconSize;

  const [selected, setSelected] = useState<string | null>(null);

  function activate(app: WindowApp) {
    open(app);
  }

  return (
    <div
      className={`dicons dicons--${iconSize}`}
      role="list"
      aria-label="Masaüstü kısayolları"
      /* Boş alana tıklayınca seçim kalksın */
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelected(null);
      }}
    >
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
          title={icon.label}
        >
          <span className="dicon__glyph" aria-hidden="true">
            <SystemIcon name={icon.icon} size={32} />
          </span>
          <span className="dicon__label">{icon.label}</span>
        </button>
      ))}
    </div>
  );
}
