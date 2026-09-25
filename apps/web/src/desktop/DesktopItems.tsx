/**
 * Masaüstü öğeleri katmanı.
 *
 * Gerçek bir işletim sistemi masaüstünde olması gerekenler:
 *   • Uygulama kısayolları + kullanıcı klasör/dosyaları **serbestçe sürüklenir**
 *   • **Çerçeve seçimi** (rubber-band): boş alanda basılı tut, birden fazlasını seç
 *   • **Sağ tık menüsü**: masaüstünde ve öğede farklı komutlar
 *   • **Yeni klasör / yeni metin dosyası** oluşturma
 *   • Öğe başına **ikon değiştirme**, **yeniden adlandırma**, **silme**
 *   • Çift tıklama ile açma (uygulama penceresi · metin düzenleyici)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SystemIcon, type SystemIconName } from "../icons";
import { useSettings } from "../settings";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { IconPicker } from "./IconPicker";
import { snap, useItemsStore, type DesktopItem } from "./itemsStore";
import { useWindowManager, type WindowApp } from "./window/windowStore";
import "./DesktopItems.css";

/** Uygulama kısayollarının varsayılan tanımı (ilk açılışta eklenir). */
const APP_SHORTCUTS: { app: WindowApp; label: string; icon: SystemIconName }[] = [
  { app: "overview", label: "Genel Bakış", icon: "overview" },
  { app: "scripts", label: "Scriptler", icon: "scripts" },
  { app: "terminal", label: "Terminal", icon: "terminal" },
  { app: "files", label: "Dosyalar", icon: "files" },
  { app: "database", label: "Veritabanı", icon: "database" },
  { app: "users", label: "Kullanıcılar", icon: "users" },
  { app: "resources", label: "Kaynaklar", icon: "resources" },
  { app: "tools", label: "Araçlar", icon: "tools" },
  { app: "notes", label: "Notlar", icon: "notes" },
  { app: "browser", label: "Tarayıcı", icon: "browser" },
  { app: "games", label: "Oyunlar", icon: "games" },
  { app: "status", label: "Durum", icon: "status" },
  { app: "settings", label: "Ayarlar", icon: "settings" },
  { app: "about", label: "Hakkında", icon: "about" },
];

/** Dosya türüne göre ikon. */
function iconFor(item: DesktopItem): React.ReactNode {
  if (item.icon) {
    if (item.icon.startsWith("icon:")) {
      return <SystemIcon name={item.icon.slice(5) as SystemIconName} size={32} />;
    }
    return <img className="ditem__img" src={item.icon} alt="" draggable={false} />;
  }
  if (item.kind === "folder") return <SystemIcon name="folder" size={32} />;
  if (item.kind === "file") return <SystemIcon name="note" size={32} />;
  return <SystemIcon name={(item.app === "files" ? "files" : (item.app as SystemIconName)) ?? "overview"} size={32} />;
}

// ----------------------------------------------------------------------
//  Bileşen
// ----------------------------------------------------------------------
export function DesktopItems() {
  const items = useItemsStore((state) => state.items);
  const add = useItemsStore((state) => state.add);
  const seedApps = useItemsStore((state) => state.seedApps);
  const update = useItemsStore((state) => state.update);
  const moveMany = useItemsStore((state) => state.moveMany);
  const removeItems = useItemsStore((state) => state.remove);
  const gridSnap = useItemsStore((state) => state.gridSnap);
  const setGridSnap = useItemsStore((state) => state.setGridSnap);
  const arrange = useItemsStore((state) => state.arrange);

  const openWindow = useWindowManager((state) => state.open);
  const { settings, update: updateSettings } = useSettings();
  const iconSize = settings.appearance.iconSize;

  const layerRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; itemId?: string } | null>(null);
  const [iconTarget, setIconTarget] = useState<DesktopItem | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [editing, setEditing] = useState<DesktopItem | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // --- İlk açılışta uygulama kısayollarını ekle (idempotent) ---
  useEffect(() => {
    seedApps(
      APP_SHORTCUTS.map((entry) => ({
        label: entry.label,
        app: entry.app,
        icon: `icon:${entry.icon}`,
      })),
    );
  }, [seedApps]);

  // --- Açma ---
  const openItem = useCallback(
    (item: DesktopItem) => {
      if (item.kind === "app" && item.app) {
        openWindow(item.app);
        return;
      }
      if (item.kind === "file") {
        setEditing(item);
        return;
      }
      if (item.kind === "folder") {
        openWindow("files");
      }
    },
    [openWindow],
  );

  // --- Sürükleme (seçili tüm öğeler birlikte) ---
  const beginDrag = useCallback(
    (event: React.PointerEvent, item: DesktopItem) => {
      if (event.button !== 0) return;

      const isSelected = selected.includes(item.id);
      const group = isSelected ? selected : [item.id];
      if (!isSelected) setSelected(event.shiftKey ? [...selected, item.id] : [item.id]);

      const start = { x: event.clientX, y: event.clientY };
      const origins = new Map(
        items.filter((entry) => group.includes(entry.id)).map((entry) => [entry.id, { x: entry.x, y: entry.y }]),
      );

      let last = origins;

      const onMove = (moveEvent: PointerEvent): void => {
        const dx = moveEvent.clientX - start.x;
        const dy = moveEvent.clientY - start.y;

        const moves = [...origins.entries()].map(([id, origin]) => {
          // Ekran dışına taşmayı engelle
          const maxX = Math.max(0, window.innerWidth - 96);
          const maxY = Math.max(0, window.innerHeight - 96);
          return {
            id,
            x: snap(Math.min(maxX, Math.max(0, origin.x + dx)), gridSnap),
            y: snap(Math.min(maxY, Math.max(0, origin.y + dy)), gridSnap),
          };
        });

        last = new Map(moves.map((move) => [move.id, { x: move.x, y: move.y }]));
        moveMany(moves);
      };

      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        void last;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [items, selected, gridSnap, moveMany],
  );

  // --- Çerçeve seçimi (boş alanda) ---
  const beginMarquee = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (event.target !== layerRef.current) return;

      const startX = event.clientX;
      const startY = event.clientY;
      setSelected([]);

      const onMove = (moveEvent: PointerEvent): void => {
        setMarquee({ x1: startX, y1: startY, x2: moveEvent.clientX, y2: moveEvent.clientY });
      };

      const onUp = (upEvent: PointerEvent): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const left = Math.min(startX, upEvent.clientX);
        const right = Math.max(startX, upEvent.clientX);
        const top = Math.min(startY, upEvent.clientY);
        const bottom = Math.max(startY, upEvent.clientY);

        setMarquee(null);
        if (right - left < 4 && bottom - top < 4) return;

        // Kesişen öğeleri seç
        const hits = items
          .filter((item) => {
            const node = document.getElementById(`ditem-${item.id}`);
            if (!node) return false;
            const rect = node.getBoundingClientRect();
            return !(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom);
          })
          .map((item) => item.id);

        setSelected(hits);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [items],
  );

  // --- Yardımcılar ---
  const createFolder = useCallback(() => {
    const id = add({ kind: "folder", label: "Yeni klasör" });
    setRenaming({ id, value: "Yeni klasör" });
  }, [add]);

  const createText = useCallback(() => {
    const id = add({ kind: "file", label: "Yeni metin.txt", extension: ".txt", content: "" });
    setRenaming({ id, value: "Yeni metin.txt" });
  }, [add]);

  const applyRenames = useCallback(() => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (value) update(renaming.id, { label: value });
    setRenaming(null);
  }, [renaming, update]);

  // --- Menüler ---
  const desktopMenu = useMemo<MenuItem[]>(
    () => [
      { id: "new-folder", label: "Yeni klasör", icon: "📁", onSelect: createFolder },
      { id: "new-txt", label: "Yeni metin dosyası", icon: "📄", onSelect: createText },
      { id: "s1", separator: true },
      {
        id: "arrange",
        label: "Sırala",
        icon: "🔀",
        children: [
          { id: "by-name", label: "Ada göre", onSelect: () => arrange("name") },
          { id: "by-kind", label: "Türe göre", onSelect: () => arrange("kind") },
          { id: "by-date", label: "Tarihe göre", onSelect: () => arrange("date") },
        ],
      },
      {
        id: "icon-size",
        label: "İkon boyutu",
        icon: "🔍",
        children: [
          { id: "small", label: "Küçük", onSelect: () => updateSettings("appearance", { iconSize: "small" }) },
          { id: "medium", label: "Orta", onSelect: () => updateSettings("appearance", { iconSize: "medium" }) },
          { id: "large", label: "Büyük", onSelect: () => updateSettings("appearance", { iconSize: "large" }) },
        ],
      },
      {
        id: "grid",
        label: gridSnap ? "✓ Izgaraya hizala" : "Izgaraya hizala",
        icon: "⊞",
        onSelect: () => setGridSnap(!gridSnap),
      },
      { id: "s2", separator: true },
      { id: "terminal", label: "Terminal aç", icon: "⌨️", onSelect: () => openWindow("terminal") },
      { id: "settings", label: "Masaüstü ayarları", icon: "⚙️", onSelect: () => openWindow("settings") },
      { id: "s3", separator: true },
      { id: "refresh", label: "Yenile", icon: "🔄", onSelect: () => setSelected([]) },
    ],
    [createFolder, createText, arrange, gridSnap, setGridSnap, openWindow, updateSettings],
  );

  const itemMenu = useMemo<MenuItem[]>(() => {
    if (!menu?.itemId) return [];
    const item = items.find((entry) => entry.id === menu.itemId);
    if (!item) return [];
    const multi = selected.length > 1;

    return [
      {
        id: "open",
        label: multi ? `${selected.length} öğeyi aç` : "Aç",
        icon: "▶",
        onSelect: () => (multi ? selected.forEach((id) => {
          const found = items.find((entry) => entry.id === id);
          if (found) openItem(found);
        }) : openItem(item)),
      },
      { id: "s1", separator: true },
      {
        id: "rename",
        label: "Yeniden adlandır",
        icon: "✎",
        disabled: multi,
        onSelect: () => setRenaming({ id: item.id, value: item.label }),
      },
      { id: "icon", label: "İkonu değiştir", icon: "🖼️", disabled: multi, onSelect: () => setIconTarget(item) },
      {
        id: "duplicate",
        label: "Kopyasını oluştur",
        icon: "⧉",
        onSelect: () => {
          add({ kind: item.kind, label: `${item.label} (kopya)`, app: item.app, icon: item.icon, content: item.content, extension: item.extension });
        },
      },
      { id: "s2", separator: true },
      {
        id: "delete",
        label: multi ? `${selected.length} öğeyi sil` : "Sil",
        icon: "🗑",
        danger: true,
        shortcut: "Del",
        onSelect: () => {
          removeItems(multi ? selected : [item.id]);
          setSelected([]);
        },
      },
    ];
  }, [menu, items, selected, openItem, add, removeItems]);

  return (
    <div
      className={`ditems ditems--${iconSize}`}
      ref={layerRef}
      onPointerDown={beginMarquee}
      onContextMenu={(event) => {
        event.preventDefault();
        // Öğe üstündeyse öğe menüsü, boş alandaysa masaüstü menüsü
        const node = (event.target as HTMLElement).closest("[data-ditem]");
        const itemId = node?.getAttribute("data-ditem") ?? undefined;
        if (itemId && !selected.includes(itemId)) setSelected([itemId]);
        setMenu({ x: event.clientX, y: event.clientY, itemId });
      }}
    >
      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <button
            key={item.id}
            id={`ditem-${item.id}`}
            type="button"
            data-ditem={item.id}
            className={`ditem${isSelected ? " is-selected" : ""}`}
            style={{ left: item.x, top: item.y }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              beginDrag(event, item);
            }}
            onDoubleClick={() => openItem(item)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!isSelected) setSelected([item.id]);
              setMenu({ x: event.clientX, y: event.clientY, itemId: item.id });
            }}
            title={item.label}
          >
            <span className="ditem__glyph" aria-hidden="true">
              {iconFor(item)}
            </span>

            {renaming?.id === item.id ? (
              <input
                className="ditem__rename"
                value={renaming.value}
                autoFocus
                onChange={(event) => setRenaming({ id: item.id, value: event.target.value })}
                onBlur={applyRenames}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyRenames();
                  if (event.key === "Escape") setRenaming(null);
                }}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="ditem__label">{item.label}</span>
            )}
          </button>
        );
      })}

      {/* Çerçeve seçimi */}
      {marquee && (
        <div
          className="ditems__marquee"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}

      {/* Sağ tık menüsü */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.itemId ? itemMenu : desktopMenu}
          title={menu.itemId ? items.find((entry) => entry.id === menu.itemId)?.label : "Masaüstü"}
          onClose={() => setMenu(null)}
        />
      )}

      {/* İkon seçici */}
      {iconTarget && (
        <IconPicker
          current={iconTarget.icon}
          label={iconTarget.label}
          onApply={(icon) => update(iconTarget.id, { icon })}
          onClose={() => setIconTarget(null)}
        />
      )}

      {/* Metin düzenleyici */}
      {editing && (
        <TextEditor
          item={editing}
          onSave={(content) => update(editing.id, { content })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
//  Metin düzenleyici (masaüstü .txt dosyaları)
// ----------------------------------------------------------------------
function TextEditor({
  item,
  onSave,
  onClose,
}: {
  item: DesktopItem;
  onSave: (content: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item.content ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="txtedit" role="dialog" aria-modal="true">
      <div className="txtedit__box">
        <header className="txtedit__head">
          <span className="txtedit__icon">📄</span>
          <strong>{item.label}</strong>
          <span className="app__spacer" />
          {saved && <span className="txtedit__saved">✔ Kaydedildi</span>}
        </header>

        <textarea
          className="txtedit__area mono"
          value={value}
          autoFocus
          spellCheck={false}
          placeholder="Notunu buraya yaz…"
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
        />

        <footer className="txtedit__actions">
          <span className="txtedit__count mono">
            {value.length} karakter · {value.split("\n").length} satır
          </span>
          <span className="app__spacer" />
          <button type="button" className="app-btn" onClick={onClose}>
            Kapat
          </button>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => {
              onSave(value);
              setSaved(true);
            }}
          >
            💾 Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
}
