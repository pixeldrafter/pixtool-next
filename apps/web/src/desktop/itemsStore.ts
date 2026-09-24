/**
 * Masaüstü öğeleri — kalıcı durum deposu.
 *
 * Bir "işletim sistemi" masaüstünde olması gerekenler:
 *   • Uygulama kısayolları **serbestçe sürüklenip** konumlandırılabilir
 *   • Kullanıcı **klasör** ve **metin dosyası** oluşturabilir
 *   • Her öğenin **ikonu değiştirilebilir** (yükleme veya URL)
 *   • Her öğe **yeniden adlandırılabilir / silinebilir**
 *
 * Konumlar `x`/`y` olarak piksel cinsinden saklanır. `gridSnap` açıkken
 * ızgaraya hizalanır (Windows'taki gibi).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WindowApp } from "./window/windowStore";

/** Öğe türü. */
export type DesktopItemKind = "app" | "folder" | "file";

export interface DesktopItem {
  id: string;
  kind: DesktopItemKind;
  /** Görünen ad */
  label: string;
  /** Konum (px) */
  x: number;
  y: number;
  /**
   * Özel ikon.
   *  • `data:image/...;base64,...` → kullanıcının yüklediği dosya
   *  • `https://...` → uzak görsel
   *  • `icon:<SystemIconName>` → yerleşik SVG ikon adı
   *  • boş → türün varsayılanı
   */
  icon?: string;
  /** `kind === "app"` ise açılacak uygulama */
  app?: WindowApp;
  /** `kind === "file"` ise metin içeriği */
  content?: string;
  /** Dosya uzantısı (kaydetme / açma davranışı için) */
  extension?: string;
  createdAt: number;
}

/** Izgara adımı (px). */
export const GRID_SIZE = 96;

interface ItemsState {
  items: DesktopItem[];
  /** Sürükleme ızgaraya hizalansın mı */
  gridSnap: boolean;
  /**
   * Varsayılan kısayollar bir kez eklendi mi?
   *
   * ⚠️ `useEffect` React StrictMode'da **iki kez** çalışır. Bayrak olmasa
   * kısayollar iki kez eklenirdi (20 öğe).
   */
  seeded: boolean;

  /** Varsayılan uygulama kısayollarını ekler (yalnızca bir kez). */
  seedApps: (entries: { label: string; app: WindowApp; icon: string }[]) => void;

  /** Yeni öğe ekler ve kimliğini döndürür. Konum verilmezse boş yer bulunur. */
  add: (
    item: Omit<DesktopItem, "id" | "createdAt" | "x" | "y"> & { x?: number; y?: number },
  ) => string;
  /** Var olan öğeyi günceller. */
  update: (id: string, patch: Partial<DesktopItem>) => void;
  /** Birden çok öğeyi taşır (çoklu sürükleme). */
  moveMany: (moves: { id: string; x: number; y: number }[]) => void;
  /** Öğeyi siler. */
  remove: (ids: string[]) => void;
  /** Izgara hizalamayı açar/kapatır. */
  setGridSnap: (value: boolean) => void;
  /** Tüm öğeleri varsayılana döndürür. */
  reset: () => void;
  /** Öğeleri konuma göre yeniden dizer (sıralama). */
  arrange: (mode: "name" | "kind" | "date") => void;
}

function makeId(): string {
  return `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Bir konumu ızgaraya hizalar. */
export function snap(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value);
}

/**
 * Boş bir konum bulur (mevcut öğelerle çakışmayan).
 *
 * Sütun sütun aşağı iner, sütun dolunca sağdaki sütuna geçer — Windows
 * masaüstü davranışı.
 */
function nextFreeSpot(items: DesktopItem[], viewportHeight = 800): { x: number; y: number } {
  const occupied = new Set(items.map((item) => `${item.x},${item.y}`));
  const startX = 16;
  const startY = 16;
  const perColumn = Math.max(1, Math.floor((viewportHeight - 120) / GRID_SIZE));

  for (let column = 0; column < 30; column += 1) {
    for (let row = 0; row < perColumn; row += 1) {
      const x = startX + column * GRID_SIZE;
      const y = startY + row * GRID_SIZE;
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: startX, y: startY };
}

export const useItemsStore = create<ItemsState>()(
  persist(
    (set, get) => ({
      items: [],
      gridSnap: true,
      seeded: false,

      seedApps: (entries) => {
        if (get().seeded || get().items.length > 0) {
          set({ seeded: true });
          return;
        }
        const perColumn = Math.max(1, Math.floor((window.innerHeight - 140) / GRID_SIZE));
        const created: DesktopItem[] = entries.map((entry, index) => ({
          id: makeId(),
          kind: "app",
          label: entry.label,
          app: entry.app,
          icon: entry.icon,
          x: 16 + Math.floor(index / perColumn) * GRID_SIZE,
          y: 16 + (index % perColumn) * GRID_SIZE,
          createdAt: Date.now() + index,
        }));
        set({ items: created, seeded: true });
      },

      add: (item) => {
        const id = makeId();
        const spot = nextFreeSpot(get().items);
        const created: DesktopItem = {
          id,
          createdAt: Date.now(),
          ...item,
          x: item.x ?? spot.x,
          y: item.y ?? spot.y,
        };
        set((state) => ({ items: [...state.items, created] }));
        return id;
      },

      update: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),

      moveMany: (moves) =>
        set((state) => {
          const map = new Map(moves.map((move) => [move.id, move]));
          return {
            items: state.items.map((item) => {
              const move = map.get(item.id);
              return move ? { ...item, x: move.x, y: move.y } : item;
            }),
          };
        }),

      remove: (ids) =>
        set((state) => {
          const set_ = new Set(ids);
          return { items: state.items.filter((item) => !set_.has(item.id)) };
        }),

      setGridSnap: (gridSnap) => set({ gridSnap }),

      reset: () => set({ items: [], seeded: false }),

      arrange: (mode) =>
        set((state) => {
          const sorted = [...state.items].sort((a, b) => {
            if (mode === "name") return a.label.localeCompare(b.label, "tr");
            if (mode === "kind") return a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, "tr");
            return a.createdAt - b.createdAt;
          });

          const perColumn = Math.max(1, Math.floor((window.innerHeight - 120) / GRID_SIZE));
          const laid = sorted.map((item, index) => ({
            ...item,
            x: 16 + Math.floor(index / perColumn) * GRID_SIZE,
            y: 16 + (index % perColumn) * GRID_SIZE,
          }));
          return { items: laid };
        }),
    }),
    {
      name: "pixtool.desktop.items",
      version: 1,
    },
  ),
);
