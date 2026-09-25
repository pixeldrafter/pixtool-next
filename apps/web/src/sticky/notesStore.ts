/**
 * Masaüstü yapışkan notları — durum deposu.
 *
 * Notlar `zustand` + `persist` ile localStorage'da saklanır (metin küçüktür).
 * Her notun rengi, konumu, boyutu ve z-sırası vardır.
 *
 * Windows Sticky Notes renk paleti kullanılır.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Yapışkan kağıt renkleri (Windows Sticky Notes paleti + genişletilmiş). */
export const NOTE_COLORS = [
  { id: "yellow", label: "Sarı", bg: "#fef3a0", ink: "#4a3f00" },
  { id: "green", label: "Yeşil", bg: "#c8f0a8", ink: "#1d3f0a" },
  { id: "pink", label: "Pembe", bg: "#ffc9dd", ink: "#5c0f30" },
  { id: "blue", label: "Mavi", bg: "#b8dcff", ink: "#0b2f52" },
  { id: "purple", label: "Mor", bg: "#d9c4ff", ink: "#2c1355" },
  { id: "orange", label: "Turuncu", bg: "#ffd4a8", ink: "#5a2d00" },
  { id: "mint", label: "Nane", bg: "#a8f0e4", ink: "#03423a" },
  { id: "white", label: "Beyaz", bg: "#f4f4f2", ink: "#242427" },
  { id: "coral", label: "Mercan", bg: "#ffb3a7", ink: "#5e1508" },
  { id: "lime", label: "Fıstık", bg: "#e2f78a", ink: "#3b4a00" },
  { id: "sky", label: "Gökyüzü", bg: "#a5e8ff", ink: "#04384d" },
  { id: "lavender", label: "Lavanta", bg: "#c9bff2", ink: "#2b1b58" },
  { id: "sand", label: "Kum", bg: "#efdfc4", ink: "#4a3718" },
  { id: "rose", label: "Gül", bg: "#ffd0d0", ink: "#5c1414" },
  { id: "teal", label: "Deniz", bg: "#9fe0d4", ink: "#02352d" },
  { id: "graphite", label: "Grafit", bg: "#d4d7dc", ink: "#1f2229" },
] as const;

/**
 * Not temaları — rengin üzerine uygulanan görsel işleme.
 *
 * `pastel` düz kâğıt, `paper` ince çizgili, `grid` kareli, `neon` parlayan
 * kenar, `dark` karartılmış gövde (açık renkleri koyu zemine çevirir).
 */
export const NOTE_THEMES = [
  { id: "pastel", label: "Düz", icon: "▪" },
  { id: "paper", label: "Çizgili", icon: "☰" },
  { id: "grid", label: "Kareli", icon: "▦" },
  { id: "neon", label: "Neon", icon: "✦" },
  { id: "dark", label: "Koyu", icon: "●" },
] as const;

export type NoteThemeId = (typeof NOTE_THEMES)[number]["id"];

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

export interface StickyNote {
  id: string;
  text: string;
  color: NoteColorId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  /** Oluşturulma zamanı (sıralama / teşhis) */
  createdAt: number;
  /** Küçültülmüş (yalnızca başlık görünür) */
  collapsed: boolean;
  /** Görsel tema (çizgili, kareli, neon…) */
  theme: NoteThemeId;
  /** Yazı boyutu (px) */
  fontSize: number;
  /** Sabitlenmiş — sürüklenemez */
  pinned: boolean;
}

interface StickyState {
  notes: StickyNote[];
  topZ: number;

  add: (options?: { x?: number; y?: number; color?: NoteColorId; text?: string }) => string;
  update: (id: string, patch: Partial<StickyNote>) => void;
  remove: (id: string) => void;
  bringToFront: (id: string) => void;
  clearAll: () => void;
}

/** Rastgele kimlik. */
function makeId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Yeni notun varsayılan boyutu. */
const DEFAULT_SIZE = { width: 210, height: 190 };

/** Notları kademeli yerleştirmek için kaydırma. */
function nextOffset(count: number): { x: number; y: number } {
  const step = 26;
  const index = count % 9;
  return { x: 340 + index * step, y: 90 + index * step };
}

export const useStickyStore = create<StickyState>()(
  persist(
    (set, get) => ({
      notes: [],
      topZ: 1,

      add: (options = {}) => {
        const state = get();
        const spot = nextOffset(state.notes.length);
        const topZ = state.topZ + 1;

        const note: StickyNote = {
          id: makeId(),
          text: options.text ?? "",
          color: options.color ?? "yellow",
          x: options.x ?? spot.x,
          y: options.y ?? spot.y,
          width: DEFAULT_SIZE.width,
          height: DEFAULT_SIZE.height,
          z: topZ,
          createdAt: Date.now(),
          collapsed: false,
          theme: "pastel",
          fontSize: 12.5,
          pinned: false,
        };

        set({ notes: [...state.notes, note], topZ });
        return note.id;
      },

      update: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...patch } : note,
          ),
        })),

      remove: (id) =>
        set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),

      bringToFront: (id) =>
        set((state) => {
          const topZ = state.topZ + 1;
          return {
            topZ,
            notes: state.notes.map((note) =>
              note.id === id ? { ...note, z: topZ } : note,
            ),
          };
        }),

      clearAll: () => set({ notes: [], topZ: 1 }),
    }),
    {
      name: "pixtool.stickies",
      version: 2,
      // v1 → v2: tema, yazı boyutu ve sabitleme alanları eklendi.
      migrate: (persisted, version) => {
        const state = persisted as { notes?: Partial<StickyNote>[] } | undefined;
        if (version < 2 && state?.notes) {
          state.notes = state.notes.map((note) => ({
            theme: "pastel",
            fontSize: 12.5,
            pinned: false,
            ...note,
          }));
        }
        return state as never;
      },
    },
  ),
);

/** Renk kimliğinden palet girdisini bulur (bilinmeyen → sarı). */
export function noteColor(id: NoteColorId) {
  return NOTE_COLORS.find((item) => item.id === id) ?? NOTE_COLORS[0];
}
