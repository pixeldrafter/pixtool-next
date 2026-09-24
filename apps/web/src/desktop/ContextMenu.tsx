/**
 * Sağ tık menüsü (bağlam menüsü).
 *
 * Windows tarzı: ikon + etiket + kısayol, ayırıcı, tehlike (kırmızı) öğe.
 * Ekran kenarlarına taşmayacak şekilde konumlanır; `Esc` veya dışarı tıklama
 * ile kapanır.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import "./ContextMenu.css";

export interface MenuItem {
  /** Benzersiz anahtar */
  id: string;
  /** Görünen metin (ayırıcıda yok sayılır) */
  label?: string;
  /** Sol taraftaki ikon (emoji veya metin) */
  icon?: string;
  /** Sağ taraftaki kısayol ipucu (ör. "Ctrl+V") */
  shortcut?: string;
  /** Ayırıcı çizgi */
  separator?: boolean;
  /** Devre dışı */
  disabled?: boolean;
  /** Tehlike (kırmızı) */
  danger?: boolean;
  /** Alt menü */
  children?: MenuItem[];
  /** Tıklama işleyicisi */
  onSelect?: () => void;
}

export interface ContextMenuProps {
  /** Ekran koordinatı */
  x: number;
  y: number;
  items: MenuItem[];
  /** Başlık (üstte küçük etiket) */
  title?: string;
  /** Kapanınca çağrılır */
  onClose: () => void;
}

export function ContextMenu({ x, y, items, title, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [openSub, setOpenSub] = useState<string | null>(null);

  // Ekran dışına taşmayı engelle
  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(x, window.innerWidth - rect.width - margin);
    const top = Math.min(y, window.innerHeight - rect.height - margin);
    setPosition({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [x, y]);

  // Dışarı tıklama / Esc ile kapat
  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    // Menü açılırken oluşan tıklamanın menüyü kapatmaması için gecikmeli bağla
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="ctxmenu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label={title ?? "Bağlam menüsü"}
      onContextMenu={(event) => event.preventDefault()}
    >
      {title && <div className="ctxmenu__title">{title}</div>}

      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="ctxmenu__sep" role="separator" />
        ) : (
          <div
            key={item.id}
            className="ctxmenu__item-wrap"
            onMouseEnter={() => setOpenSub(item.children ? item.id : null)}
          >
            <button
              type="button"
              role="menuitem"
              className={`ctxmenu__item${item.danger ? " is-danger" : ""}${
                item.disabled ? " is-disabled" : ""
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                if (item.children) {
                  setOpenSub((value) => (value === item.id ? null : item.id));
                  return;
                }
                item.onSelect?.();
                onClose();
              }}
            >
              <span className="ctxmenu__icon" aria-hidden="true">
                {item.icon ?? ""}
              </span>
              <span className="ctxmenu__label">{item.label}</span>
              {item.shortcut && <span className="ctxmenu__shortcut">{item.shortcut}</span>}
              {item.children && (
                <span className="ctxmenu__arrow" aria-hidden="true">
                  ▸
                </span>
              )}
            </button>

            {item.children && openSub === item.id && (
              <div className="ctxmenu ctxmenu--sub" role="menu">
                {item.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    role="menuitem"
                    className={`ctxmenu__item${child.danger ? " is-danger" : ""}`}
                    disabled={child.disabled}
                    onClick={() => {
                      child.onSelect?.();
                      onClose();
                    }}
                  >
                    <span className="ctxmenu__icon" aria-hidden="true">
                      {child.icon ?? ""}
                    </span>
                    <span className="ctxmenu__label">{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
