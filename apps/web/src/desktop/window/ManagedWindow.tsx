/**
 * Yönetilen pencere — sürükle, boyutlandır, küçült, büyüt.
 *
 * Başlık çubuğundan sürüklenir; 8 yönden boyutlandırılabilir.
 * Konum/boyut `windowStore` içinde tutulur.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { APP_DEFINITIONS, useWindowManager, type WindowState } from "./windowStore";
import "./ManagedWindow.css";

interface ManagedWindowProps {
  window: WindowState;
  children: React.ReactNode;
}

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_EDGES: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** Görev çubuğu yüksekliği — pencereler bunun üstünde kalmalı. */
const TASKBAR_HEIGHT = 46;
/** Başlık çubuğu her zaman görünür kalmalı. */
const MIN_VISIBLE = 40;

export function ManagedWindow({ window: win, children }: ManagedWindowProps) {
  const { focus, close, move, resize, toggleMinimize, toggleMaximize, activeId } =
    useWindowManager();

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ResizeEdge | null>(null);

  const startRef = useRef({ x: 0, y: 0, winX: 0, winY: 0, width: 0, height: 0 });

  const isActive = activeId === win.id;

  // --- Sürükleme ---
  const onTitlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (win.maximized) return;
      // Düğmelere tıklanmışsa sürükleme başlatma
      if ((event.target as HTMLElement).closest("button")) return;

      event.preventDefault();
      focus(win.id);
      setDragging(true);
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        winX: win.x,
        winY: win.y,
        width: win.width,
        height: win.height,
      };
    },
    [focus, win.id, win.maximized, win.x, win.y, win.width, win.height],
  );

  // --- Boyutlandırma ---
  const onResizePointerDown = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      focus(win.id);
      setResizing(edge);
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        winX: win.x,
        winY: win.y,
        width: win.width,
        height: win.height,
      };
    },
    [focus, win.id, win.x, win.y, win.width, win.height],
  );

  // --- Sürükleme/boyutlandırma döngüsü ---
  useEffect(() => {
    if (!dragging && !resizing) return undefined;

    function onMove(event: PointerEvent) {
      const start = startRef.current;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;

      if (dragging) {
        // Pencere ekrandan tamamen çıkmasın
        const maxX = window.innerWidth - MIN_VISIBLE;
        const maxY = window.innerHeight - TASKBAR_HEIGHT - MIN_VISIBLE;
        move(
          win.id,
          Math.max(-start.width + MIN_VISIBLE, Math.min(start.winX + dx, maxX)),
          Math.max(0, Math.min(start.winY + dy, maxY)),
        );
        return;
      }

      if (!resizing) return;

      let { winX: x, winY: y, width, height } = start;

      if (resizing.includes("e")) width = start.width + dx;
      if (resizing.includes("s")) height = start.height + dy;
      if (resizing.includes("w")) {
        width = start.width - dx;
        x = start.winX + dx;
      }
      if (resizing.includes("n")) {
        height = start.height - dy;
        y = start.winY + dy;
      }

      // Minimum boyutun altına inince konumu kilitle
      const minWidth = 320;
      const minHeight = 220;
      if (width < minWidth) {
        if (resizing.includes("w")) x = start.winX + (start.width - minWidth);
        width = minWidth;
      }
      if (height < minHeight) {
        if (resizing.includes("n")) y = start.winY + (start.height - minHeight);
        height = minHeight;
      }

      resize(win.id, { x, y, width, height });
    }

    function onUp() {
      setDragging(false);
      setResizing(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, resizing, move, resize, win.id]);

  if (win.minimized) return null;

  const definition = APP_DEFINITIONS[win.app];

  return (
    <section
      className={`mwin${isActive ? " is-active" : ""}${dragging ? " is-dragging" : ""}${
        win.maximized ? " is-maximized" : ""
      }`}
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: 100 + win.z,
      }}
      onPointerDown={() => focus(win.id)}
      aria-label={win.title}
      role="dialog"
    >
      {/* Boyutlandırma tutamaçları */}
      {!win.maximized &&
        RESIZE_EDGES.map((edge) => (
          <span
            key={edge}
            className={`mwin__resize mwin__resize--${edge}`}
            onPointerDown={onResizePointerDown(edge)}
            aria-hidden="true"
          />
        ))}

      {/* Başlık çubuğu */}
      <header
        className="mwin__titlebar"
        onPointerDown={onTitlePointerDown}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <span className="mwin__icon" aria-hidden="true">
          {win.icon || definition.icon}
        </span>
        <span className="mwin__title">{win.title}</span>

        <div className="mwin__controls">
          <button
            type="button"
            className="mwin__btn mwin__btn--min"
            onClick={() => toggleMinimize(win.id)}
            title="Küçült"
            aria-label="Küçült"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="5" x2="9" y2="5" />
            </svg>
          </button>
          <button
            type="button"
            className="mwin__btn mwin__btn--max"
            onClick={() => toggleMaximize(win.id)}
            title={win.maximized ? "Geri al" : "Büyüt"}
            aria-label={win.maximized ? "Geri al" : "Büyüt"}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="mwin__btn mwin__btn--close"
            onClick={() => close(win.id)}
            title="Kapat"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* İçerik */}
      <div className="mwin__body">{children}</div>
    </section>
  );
}
