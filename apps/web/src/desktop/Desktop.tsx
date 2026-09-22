/**
 * Masaüstü kabuğu — pencere yöneticisi ile.
 *
 * Yapı:
 *   ThemeBackdrop (App içinde)
 *   ├─ DesktopIcons      → masaüstü kısayolları
 *   ├─ ManagedWindow[]   → sürüklenebilir pencereler
 *   ├─ Taskbar           → açık pencereler, kullanıcı, saat, kapat
 *   └─ StartMenu         → başlat menüsü
 */

import { useEffect, useState } from "react";

import type { StatusResponse } from "../lib/api";
import type { LoginSession } from "../login";
import { useSettings } from "../settings";
import { AboutWindow } from "./apps/AboutWindow";
import { DesktopIcons } from "./DesktopIcons";
import { SettingsWindow } from "./SettingsWindow";
import { ShutdownButton } from "./ShutdownButton";
import { StartMenu } from "./StartMenu";
import { StatusWindow } from "./StatusWindow";
import { ManagedWindow } from "./window/ManagedWindow";
import { useWindowManager, type WindowApp } from "./window/windowStore";
import "./Desktop.css";

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
  const { settings } = useSettings();
  const [startOpen, setStartOpen] = useState(false);

  const windows = useWindowManager((state) => state.windows);
  const open = useWindowManager((state) => state.open);
  const focus = useWindowManager((state) => state.focus);

  // Açılışta Sistem Durumu penceresi
  useEffect(() => {
    open("status");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl+K → başlat menüsü (Command Palette yerine hızlı erişim)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("tr") === "k") {
        event.preventDefault();
        setStartOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function renderApp(app: WindowApp) {
    switch (app) {
      case "status":
        return (
          <StatusWindow
            status={status}
            error={error}
            loading={loading}
            session={session}
            reportSaved={reportSaved}
            onRefresh={onRefresh}
          />
        );
      case "settings":
        return <SettingsWindow />;
      case "about":
        return <AboutWindow />;
      default:
        return (
          <div className="desktop__placeholder">
            <span aria-hidden="true">🚧</span>
            <strong>Bu pencere henüz hazır değil</strong>
            <p>Faz 2'de eklenecek.</p>
          </div>
        );
    }
  }

  return (
    <div className="desktop">
      <DesktopIcons />

      {/* Pencereler */}
      {windows.map((win) => (
        <ManagedWindow key={win.id} window={win}>
          {renderApp(win.app)}
        </ManagedWindow>
      ))}

      {/* Başlat menüsü */}
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}

      <Taskbar
        theme={settings.appearance.theme}
        session={session}
        onLock={onLock}
        onLogout={onLogout}
        onToggleStart={() => setStartOpen((value) => !value)}
        startOpen={startOpen}
        onToggleWindow={(id) => focus(id)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
//  Görev çubuğu
// ----------------------------------------------------------------------
function Taskbar({
  theme,
  session,
  onLock,
  onLogout,
  onToggleStart,
  startOpen,
  onToggleWindow,
}: {
  theme: string;
  session: LoginSession | null;
  onLock: () => void;
  onLogout: () => void;
  onToggleStart: () => void;
  startOpen: boolean;
  onToggleWindow: (id: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const windows = useWindowManager((state) => state.windows);
  const activeId = useWindowManager((state) => state.activeId);
  const toggleMinimize = useWindowManager((state) => state.toggleMinimize);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="taskbar">
      <button
        type="button"
        className={`taskbar__start${startOpen ? " is-active" : ""}`}
        onClick={onToggleStart}
        title="Başlat (Ctrl+K)"
      >
        <span aria-hidden="true">◈</span> Başlat
      </button>

      <div className="taskbar__apps">
        {windows.map((win) => (
          <button
            key={win.id}
            type="button"
            className={`taskbar__app${activeId === win.id ? " is-active" : ""}${
              win.minimized ? " is-minimized" : ""
            }`}
            onClick={() => {
              if (win.minimized) {
                onToggleWindow(win.id);
              } else if (activeId === win.id) {
                toggleMinimize(win.id);
              } else {
                onToggleWindow(win.id);
              }
            }}
            title={win.title}
          >
            <span aria-hidden="true">{win.icon}</span>
            <span className="taskbar__app-label">{win.title}</span>
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
