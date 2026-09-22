/**
 * Masaüstü kabuğu.
 *
 * Faz C2: sekme tabanlı pencere geçişi (Durum / Ayarlar).
 * Faz C2+ (sıradaki): gerçek pencere yöneticisi — sürükle, boyutlandır,
 * küçült, z-sırası, başlat menüsü, Command Palette.
 */

import { useEffect, useState } from "react";

import type { StatusResponse } from "../lib/api";
import type { LoginSession } from "../login";
import { useSettings } from "../settings";
import { SettingsWindow } from "./SettingsWindow";
import { ShutdownButton } from "./ShutdownButton";
import { StatusWindow } from "./StatusWindow";
import "./Desktop.css";

export type DesktopApp = "status" | "settings";

interface DesktopProps {
  status: StatusResponse | null;
  error: string | null;
  loading: boolean;
  session: LoginSession | null;
  reportSaved: boolean | null;
  onRefresh: () => void;
  onLock: () => void;
  onLogout: () => void;
}

export function Desktop({
  status,
  error,
  loading,
  session,
  reportSaved,
  onRefresh,
  onLock,
  onLogout,
}: DesktopProps) {
  const [openApps, setOpenApps] = useState<DesktopApp[]>(["status"]);
  const [activeApp, setActiveApp] = useState<DesktopApp>("status");
  const { settings } = useSettings();

  function open(app: DesktopApp) {
    setOpenApps((apps) => (apps.includes(app) ? apps : [...apps, app]));
    setActiveApp(app);
  }

  function close(app: DesktopApp) {
    setOpenApps((apps) => {
      const next = apps.filter((item) => item !== app);
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
            session={session}
            reportSaved={reportSaved}
            onRefresh={onRefresh}
            onClose={openApps.length > 1 ? () => close("status") : undefined}
          />
        )}
        {activeApp === "settings" && <SettingsWindow />}
      </div>

      <Taskbar
        openApps={openApps}
        activeApp={activeApp}
        onOpen={open}
        theme={settings.appearance.theme}
        session={session}
        onLock={onLock}
        onLogout={onLogout}
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
  session,
  onLock,
  onLogout,
}: {
  openApps: DesktopApp[];
  activeApp: DesktopApp;
  onOpen: (app: DesktopApp) => void;
  theme: string;
  session: LoginSession | null;
  onLock: () => void;
  onLogout: () => void;
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

      {session && (
        <span className="taskbar__user mono" title="Oturum sahibi">
          👤 {session.username}
        </span>
      )}

      <button type="button" className="taskbar__icon" onClick={onLock} title="Kilitle">
        🔒
      </button>

      <span className="taskbar__badge mono">{theme}</span>

      <span className="taskbar__clock">
        {now.toLocaleDateString("tr-TR")} · {now.toLocaleTimeString("tr-TR")}
      </span>

      <ShutdownButton onShutdown={onLogout} label="Kapat" />
    </footer>
  );
}
