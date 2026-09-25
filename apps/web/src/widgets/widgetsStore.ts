/**
 * Masaüstü donanım widget'ları — kalıcı durum deposu.
 *
 * Widget'lar hava durumu kartları gibi masaüstünde durur: hangi metrikleri
 * göstereceğini kullanıcı seçer, sürükleyip konumlandırır, × ile kaldırır.
 *
 * Konum `x`/`y` piksel cinsindendir. Kayıtlar kullanıcıya göre ayrılmış yerel
 * önbellekte (`px:<kullanıcı>:pixtool.widgets`) tutulur ve `userSync` ile
 * sunucuya da yazılır (tarayıcı ↔ masaüstü kabuğu ↔ cihaz arası taşınır).
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { scopedStorage } from "../lib/scopedStorage";

/** Widget türü. */
export type WidgetKind = "cpu" | "memory" | "disk" | "thermal";

/** Kullanılabilir widget'ların tanımı (menü + başlık). */
export const WIDGET_KINDS: { id: WidgetKind; label: string; icon: string; hint: string }[] = [
  { id: "cpu", label: "İşlemci", icon: "🧠", hint: "Anlık CPU kullanımı" },
  { id: "memory", label: "Bellek", icon: "🧩", hint: "RAM kullanımı" },
  { id: "disk", label: "Disk", icon: "💽", hint: "Bölüm doluluk oranı" },
  { id: "thermal", label: "Sıcaklık", icon: "🌡️", hint: "Donanım sıcaklıkları" },
];

export interface WidgetInstance {
  id: string;
  kind: WidgetKind;
  /** Masaüstü konumu (px) */
  x: number;
  y: number;
}

interface WidgetsState {
  widgets: WidgetInstance[];
  /** Kart genişliği (px) — tüm widget'lar aynı genişlikte */
  width: number;

  add: (kind: WidgetKind, position?: { x?: number; y?: number }) => string;
  remove: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  clearAll: () => void;
}

function makeId(): string {
  return `wg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Varsayılan kart genişliği. */
export const WIDGET_WIDTH = 236;

/** Yeni widget için kademeli başlangıç konumu. */
function cascade(index: number): { x: number; y: number } {
  const stepX = 26;
  const stepY = 26;
  const baseX = 40;
  const baseY = 90;
  return { x: baseX + index * stepX, y: baseY + index * stepY };
}

export const useWidgetsStore = create<WidgetsState>()(
  persist(
    (set, get) => ({
      widgets: [],
      width: WIDGET_WIDTH,

      add: (kind, position) => {
        const id = makeId();
        const fallback = cascade(get().widgets.length);
        const x = position?.x ?? fallback.x;
        const y = position?.y ?? fallback.y;
        set((state) => ({
          widgets: [...state.widgets, { id, kind, x: Math.max(8, x), y: Math.max(8, y) }],
        }));
        return id;
      },

      remove: (id) =>
        set((state) => ({ widgets: state.widgets.filter((widget) => widget.id !== id) })),

      move: (id, x, y) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id ? { ...widget, x: Math.round(x), y: Math.round(y) } : widget,
          ),
        })),

      clearAll: () => set({ widgets: [] }),
    }),
    {
      name: "pixtool.widgets",
      version: 1,
      // Kullanıcıya göre ayrılmış yerel önbellek
      storage: createJSONStorage(() => scopedStorage()),
    },
  ),
);
