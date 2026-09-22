/**
 * Pencere yöneticisi — durum deposu.
 *
 * Amaç: işletim sistemi hissi (karar #11). Pencereler sürüklenebilir,
 * boyutlandırılabilir, küçültülebilir ve z-sırası yönetilir.
 *
 * zustand ile tutulur; `Desktop` bu depoyu kullanır.
 */

import { create } from "zustand";

export type WindowApp = "status" | "settings" | "about" | "files" | "terminal" | "scripts";

export interface WindowState {
  id: string;
  app: WindowApp;
  title: string;
  icon: string;
  /** Konum (px, ekran koordinatı) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Yığın sırası — büyük olan üstte */
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Sürükleme öncesi normal konum (büyütmeden dönüş için) */
  restore?: { x: number; y: number; width: number; height: number };
}

export const APP_DEFINITIONS: Record<WindowApp, { title: string; icon: string; width: number; height: number }> = {
  status: { title: "Sistem Durumu", icon: "🖥️", width: 940, height: 620 },
  settings: { title: "Ayarlar", icon: "⚙️", width: 900, height: 660 },
  about: { title: "Pixtool Hakkında", icon: "ℹ️", width: 560, height: 420 },
  files: { title: "Dosya Yöneticisi", icon: "📁", width: 860, height: 580 },
  terminal: { title: "Terminal", icon: "⌨️", width: 760, height: 480 },
  scripts: { title: "Script Kütüphanesi", icon: "📜", width: 880, height: 600 },
};

interface WindowManagerState {
  windows: WindowState[];
  /** En üstteki z değeri */
  topZ: number;
  /** Masaüstünde odaklanmış pencere */
  activeId: string | null;

  open: (app: WindowApp) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, size: { x?: number; y?: number; width?: number; height?: number }) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  closeAll: () => void;
}

/** Aynı uygulamadan kaç pencere açık olduğunu sayar (başlık numarası için). */
function countApp(windows: WindowState[], app: WindowApp): number {
  return windows.filter((item) => item.app === app).length;
}

export const useWindowManager = create<WindowManagerState>()((set, get) => ({
  windows: [],
  topZ: 1,
  activeId: null,

  open: (app) => {
    const definition = APP_DEFINITIONS[app];
    const state = get();
    const existing = countApp(state.windows, app);

    // Aynı uygulama zaten açıksa onu öne getir (yeni pencere açma)
    const already = state.windows.find((item) => item.app === app);
    if (already) {
      get().focus(already.id);
      return already.id;
    }

    const topZ = state.topZ + 1;
    const index = state.windows.length;

    // Pencereleri kademeli yerleştir
    const offset = (index % 6) * 32;
    const maxWidth = Math.max(320, window.innerWidth - 80);
    const maxHeight = Math.max(280, window.innerHeight - 140);

    const width = Math.min(definition.width, maxWidth);
    const height = Math.min(definition.height, maxHeight);

    const id = `${app}-${Date.now().toString(36)}`;
    const windowState: WindowState = {
      id,
      app,
      title: existing > 0 ? `${definition.title} (${existing + 1})` : definition.title,
      icon: definition.icon,
      x: Math.max(24, Math.min(80 + offset, window.innerWidth - width - 24)),
      y: Math.max(24, Math.min(60 + offset, window.innerHeight - height - 100)),
      width,
      height,
      z: topZ,
      minimized: false,
      maximized: false,
    };

    set((prev) => ({
      windows: [...prev.windows, windowState],
      topZ,
      activeId: id,
    }));

    return id;
  },

  close: (id) =>
    set((state) => {
      const windows = state.windows.filter((item) => item.id !== id);
      const activeId =
        state.activeId === id ? (windows[windows.length - 1]?.id ?? null) : state.activeId;
      return { windows, activeId };
    }),

  focus: (id) =>
    set((state) => {
      const topZ = state.topZ + 1;
      return {
        topZ,
        activeId: id,
        windows: state.windows.map((item) =>
          item.id === id ? { ...item, z: topZ, minimized: false } : item,
        ),
      };
    }),

  move: (id, x, y) =>
    set((state) => ({
      windows: state.windows.map((item) =>
        item.id === id ? { ...item, x: Math.round(x), y: Math.round(y) } : item,
      ),
    })),

  resize: (id, size) =>
    set((state) => ({
      windows: state.windows.map((item) =>
        item.id === id
          ? {
              ...item,
              x: size.x ?? item.x,
              y: size.y ?? item.y,
              width: Math.max(320, size.width ?? item.width),
              height: Math.max(220, size.height ?? item.height),
            }
          : item,
      ),
    })),

  toggleMinimize: (id) =>
    set((state) => ({
      windows: state.windows.map((item) =>
        item.id === id ? { ...item, minimized: !item.minimized } : item,
      ),
      activeId: state.activeId === id ? null : state.activeId,
    })),

  toggleMaximize: (id) =>
    set((state) => {
      const target = state.windows.find((item) => item.id === id);
      if (!target) return state;

      if (target.maximized && target.restore) {
        return {
          windows: state.windows.map((item) =>
            item.id === id
              ? {
                  ...item,
                  maximized: false,
                  x: target.restore!.x,
                  y: target.restore!.y,
                  width: target.restore!.width,
                  height: target.restore!.height,
                }
              : item,
          ),
        };
      }

      const topZ = state.topZ + 1;
      return {
        topZ,
        windows: state.windows.map((item) =>
          item.id === id
            ? {
                ...item,
                maximized: true,
                z: topZ,
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight - 46, // görev çubuğu payı
                restore: {
                  x: item.x,
                  y: item.y,
                  width: item.width,
                  height: item.height,
                },
              }
            : item,
        ),
      };
    }),

  closeAll: () => set({ windows: [], activeId: null }),
}));
