/**
 * Başlat menüsü.
 *
 * Görev çubuğundaki "Başlat" düğmesinden açılır (veya Ctrl+K). Uygulamaları
 * listeler, arama yapılabilir ve klavyeyle gezilebilir.
 *
 * Metinler i18n üzerinden gelir (`app.<anahtar>` ve `app.<anahtar>.desc`).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { openExternal } from "../lib/openExternal";
import { useSettings } from "../settings";
import { APP_DEFINITIONS, useWindowManager, type WindowApp } from "./window/windowStore";
import "./StartMenu.css";

interface StartMenuProps {
  onClose: () => void;
}

interface StartItem {
  app: WindowApp;
  /** i18n öneki: `app.<key>` başlık, `app.<key>.desc` açıklama */
  key: string;
  icon: string;
  /** Grup başlığı i18n anahtarı */
  groupKey: string;
}

const START_ITEMS: StartItem[] = [
  { app: "overview", key: "overview", icon: "📊", groupKey: "start.group.monitor" },
  { app: "resources", key: "resources", icon: "📈", groupKey: "start.group.monitor" },
  { app: "status", key: "status", icon: "🖥️", groupKey: "start.group.monitor" },
  { app: "scripts", key: "scripts", icon: "📜", groupKey: "start.group.manage" },
  { app: "terminal", key: "terminal", icon: "⌨️", groupKey: "start.group.manage" },
  { app: "files", key: "files", icon: "📁", groupKey: "start.group.manage" },
  { app: "users", key: "users", icon: "👥", groupKey: "start.group.manage" },
  { app: "database", key: "database", icon: "🗄️", groupKey: "start.group.manage" },
  { app: "tools", key: "tools", icon: "🧰", groupKey: "start.group.manage" },
  { app: "notes", key: "notes", icon: "🗒️", groupKey: "start.group.manage" },
  { app: "browser", key: "browser", icon: "🌐", groupKey: "start.group.manage" },
  { app: "games", key: "games", icon: "🎮", groupKey: "start.group.manage" },
  { app: "settings", key: "settings", icon: "⚙️", groupKey: "start.group.system" },
  { app: "about", key: "about", icon: "ℹ️", groupKey: "start.group.system" },
];

export function StartMenu({ onClose }: StartMenuProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const open = useWindowManager((state) => state.open);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    if (!normalized) return START_ITEMS;
    return START_ITEMS.filter((item) => {
      const label = t(`app.${item.key}`).toLocaleLowerCase("tr");
      const description = t(`app.${item.key}.desc`).toLocaleLowerCase("tr");
      return label.includes(normalized) || description.includes(normalized);
    });
  }, [query, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, StartItem[]>();
    for (const item of results) {
      const list = map.get(item.groupKey) ?? [];
      list.push(item);
      map.set(item.groupKey, list);
    }
    return [...map.entries()];
  }, [results]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) onClose();
    }
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

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
      setCursor(
        (value) => (value - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1),
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[cursor];
      if (item) {
        open(item.app);
        onClose();
      }
    }
  }

  let flatIndex = -1;

  return (
    <div
      className="start"
      ref={menuRef}
      onKeyDown={onKeyDown}
      role="menu"
      aria-label={t("start.title")}
    >
      <div className="start__header">
        <div className="start__avatar" aria-hidden="true">
          ◈
        </div>
        <div className="start__who">
          <strong>{t("app.name")}</strong>
          <span className="start__version">v0.1.0 · Faz 2</span>
        </div>
      </div>

      <div className="start__search">
        <span aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder={t("start.search")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
        />
      </div>

      <div className="start__list">
        {results.length === 0 && <div className="start__empty">{t("common.empty")}</div>}

        {grouped.map(([groupKey, items]) => (
          <div key={groupKey}>
            <div className="start__group">{t(groupKey)}</div>
            {items.map((item) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <button
                  key={item.app}
                  type="button"
                  className={`start__item${index === cursor ? " is-cursor" : ""}`}
                  role="menuitem"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => {
                    open(item.app);
                    onClose();
                  }}
                >
                  <span className="start__item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="start__item-text">
                    <strong>{t(`app.${item.key}`)}</strong>
                    <small>{t(`app.${item.key}.desc`)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="start__footer">
        <span className="start__hint mono">{t("start.hint")}</span>

        {/* Sahip / telif bilgisi — siteye tıklanınca HEDEF makinede açılır */}
        <div className="start__signature">
          <span className="start__copyright">{settings.general.copyright}</span>
          <button
            type="button"
            className="start__site mono"
            title={`${settings.general.siteUrl} — varsayılan tarayıcıda aç`}
            onClick={() => void openExternal(settings.general.siteUrl)}
          >
            {settings.general.siteUrl.replace(/^https?:\/\//, "")}
          </button>
        </div>
      </div>
    </div>
  );
}

export { APP_DEFINITIONS };
