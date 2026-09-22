/**
 * Masaüstü kabuğu.
 *
 * Faz A: sekme ile pencere geçişi (Durum / Ayarlar) + görev çubuğu.
 * Faz B: gerçek pencere yöneticisi (sürükle, boyutlandır, küçült, z-sırası),
 *        başlat menüsü, masaüstü ikonları, Command Palette.
 *
 * Arkaplan katmanı App içinde (ThemeBackdrop) — temaya duyarlı.
 */

import { useEffect, useState } from "react";

import type { StatusResponse } from "../lib/api";
import { useSettings } from "../settings";
import { SettingsWindow } from "./SettingsWindow";
import { StatusWindow } from "./StatusWindow";
import "./Desktop.css";

export type DesktopApp = "status" | "settings";

interface DesktopProps {
  status: StatusResponse | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}

export function Desktop({ status, error, loading, onRefresh }: DesktopProps) {
  const [openApps, setOpenApps] = useState<DesktopApp[]>(["status"]);
  const [activeApp, setActiveApp] = useState<DesktopApp>("status");
  const { settings } = useSettings();

  function open(app: DesktopApp) {
    setOpenApps((apps) => (apps.includes(app) ? apps : [...apps, app]));
    setActiveApp(app);
  }

  function close(app: DesktopApp) {
    setOpenApps((apps) => {
      const next = apps.filter((a) => a !== app);
      if (activeApp === app) {
        setActiveApp(next[next.length - 1] ?? "status");
      }
      return next.length > 0 ? next : ["status"];
    });
  }

  return (
    <div className="desktop">
      <div className="desktop__area">
        {activeApp === "status" && (
          <StatusWindow
            status={status}
            error={error}
            loading={loading}
            onRefresh={onRefresh}
            onClose={openApps.length > 1 ? () => close("status") : undefined}
          />
        )}
        {activeApp === "settings" && (
          <SettingsWindow />
        )}
      </div>

      <Taskbar
        openApps={openApps}
        activeApp={activeApp}
        onOpen={open}
        theme={settings.appearance.theme}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
//  Görev çubuğu
// ----------------------------------------------------------------------
function Taskbar({
  openApps,
  activeApp,
  onOpen,
  theme,
}: {
  openApps: DesktopApp[];
  activeApp: DesktopApp;
  onOpen: (app: DesktopApp) => void;
  theme: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const titles: Record<DesktopApp, string> = {
    status: "🖥️ Bağlantı Durumu",
    settings: "⚙️ Ayarlar",
  };

  return (
    <footer className="taskbar">
      <button className="taskbar__start" type="button" onClick={() => onOpen("settings")}>
        <span aria-hidden="true">◈</span> Başlat
      </button>

      <div className="taskbar__apps">
        {openApps.map((app) => (
          <button
            key={app}
            type="button"
            className={`taskbar__app${activeApp === app ? " is-active" : ""}`}
            onClick={() => onOpen(app)}
          >
            {titles[app]}
          </button>
        ))}
      </div>

      <span className="taskbar__spacer" />
      <span className="taskbar__badge mono">{theme}</span>
      <span className="taskbar__clock">
        {now.toLocaleDateString("tr-TR")} · {now.toLocaleTimeString("tr-TR")}
      </span>
    </footer>
  );
}
