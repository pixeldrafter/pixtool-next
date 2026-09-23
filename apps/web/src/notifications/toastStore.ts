/**
 * Bildirim (toast) deposu.
 *
 * Windows 11 bildirimleri gibi: sağ altta belirir, birkaç saniye sonra
 * kendiliğinden kaybolur. Kullanıcı tıklayarak da kapatabilir.
 */

import { create } from "zustand";

export type ToastKind = "info" | "ok" | "warn" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Kaynak uygulama adı (Windows bildirimlerinde üstte görünür) */
  source?: string;
  /** Otomatik kapanma süresi (ms). 0 → elle kapatılana kadar kalır. */
  duration: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "createdAt" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** Aynı anda en fazla bu kadar bildirim gösterilir. */
const MAX_VISIBLE = 4;

function makeId(): string {
  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  push: (toast) => {
    const id = makeId();
    const entry: Toast = {
      id,
      kind: toast.kind,
      title: toast.title,
      message: toast.message,
      source: toast.source,
      duration: toast.duration ?? 5000,
      createdAt: Date.now(),
    };

    set((state) => {
      // Yığın sınırı: en eskileri düşür
      const next = [...state.toasts, entry];
      return { toasts: next.slice(-MAX_VISIBLE) };
    });

    // Kendiliğinden kapan
    if (entry.duration > 0) {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      }, entry.duration);
    }

    return id;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/**
 * Depo dışından kolay kullanım.
 *
 *   toast.ok("Kaydedildi", "Ayar dosyası güncellendi");
 */
export const toast = {
  info: (title: string, message?: string, source?: string) =>
    useToastStore.getState().push({ kind: "info", title, message, source }),
  ok: (title: string, message?: string, source?: string) =>
    useToastStore.getState().push({ kind: "ok", title, message, source }),
  warn: (title: string, message?: string, source?: string) =>
    useToastStore.getState().push({ kind: "warn", title, message, source, duration: 7000 }),
  error: (title: string, message?: string, source?: string) =>
    useToastStore.getState().push({ kind: "error", title, message, source, duration: 9000 }),
};
