/**
 * Başlat menüsü.
 *
 * Görev çubuğundaki "Başlat" düğmesinden açılır. Uygulamaları listeler,
 * arama yapılabilir ve klavyeyle gezilebilir.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { APP_DEFINITIONS, useWindowManager, type WindowApp } from "./window/windowStore";
import "./StartMenu.css";

interface StartMenuProps {
  onClose: () => void;
}

interface StartItem {
  app: WindowApp;
  label: string;
  icon: string;
  description: string;
  /** Yakında gelecek (tıklanamaz) */
  soon?: boolean;
}

const START_ITEMS: StartItem[] = [
  {
    app: "status",
    label: "Sistem Durumu",
    icon: "🖥️",
    description: "Bağlantılar, entegrasyonlar, uyarılar",
  },
  {
    app: "settings",
    label: "Ayarlar",
    icon: "⚙️",
    description: "Tema, görünüm, giriş, akış",
  },
  {
    app: "scripts",
    label: "Script Kütüphanesi",
    icon: "📜",
    description: "Hazır PowerShell araçları",
    soon: true,
  },
  {
    app: "files",
    label: "Dosya Yöneticisi",
    icon: "📁",
    description: "SFTP ile uzak dosyalar",
    soon: true,
  },
  {
    app: "terminal",
    label: "Terminal",
    icon: "⌨️",
    description: "SSH oturumu",
    soon: true,
  },
  {
    app: "about",
    label: "Pixtool Hakkında",
    icon: "ℹ️",
    description: "Sürüm, kısayollar, bileşen demoları",
  },
];

export function StartMenu({ onClose }: StartMenuProps) {
  const open = useWindowManager((state) => state.open);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    if (!normalized) return START_ITEMS;
    return START_ITEMS.filter(
      (item) =>
        item.label.toLocaleLowerCase("tr").includes(normalized) ||
        item.description.toLocaleLowerCase("tr").includes(normalized),
    );
  }, [query]);

  // Açılışta aramaya odaklan
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dışarı tıklama ile kapan
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) onClose();
    }
    // Kısa gecikme: açan tıklamanın hemen kapatmasını engelle
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  // Klavye gezinme
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % Math.max(results.length, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[cursor];
      if (item && !item.soon) {
        open(item.app);
        onClose();
      }
    }
  }

  return (
    <div className="start" ref={menuRef} onKeyDown={onKeyDown} role="menu" aria-label="Başlat menüsü">
      {/* Kullanıcı bölümü */}
      <div className="start__header">
        <div className="start__avatar" aria-hidden="true">
          👤
        </div>
        <div className="start__who">
          <strong>Pixtool Next</strong>
          <span className="start__version">v0.1.0 · Faz 1</span>
        </div>
      </div>

      {/* Arama */}
      <div className="start__search">
        <span aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Uygulama ara…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
        />
      </div>

      {/* Uygulamalar */}
      <div className="start__list">
        {results.length === 0 && <div className="start__empty">Sonuç bulunamadı</div>}

        {results.map((item, index) => (
          <button
            key={item.app}
            type="button"
            className={`start__item${index === cursor ? " is-cursor" : ""}${
              item.soon ? " is-soon" : ""
            }`}
            role="menuitem"
            disabled={item.soon}
            onMouseEnter={() => setCursor(index)}
            onClick={() => {
              if (item.soon) return;
              open(item.app);
              onClose();
            }}
          >
            <span className="start__item-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="start__item-text">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            {item.soon && <span className="start__badge">yakında</span>}
          </button>
        ))}
      </div>

      {/* Alt eylemler */}
      <div className="start__footer">
        <span className="start__hint mono">↑↓ gez · Enter aç · Esc kapat</span>
      </div>
    </div>
  );
}

/** Görev çubuğunun üstünde konumlanması için dışa aktarılan tanım. */
export { APP_DEFINITIONS };
