/**
 * Ayar deposu.
 *
 * • `zustand` + `persist` → localStorage'da saklanır, sayfa yenilenince korunur.
 * • Derin birleştirme (merge) ile şema güncellendiğinde eski kayıtlar bozulmaz.
 * • Her ayar değişikliği anında uygulanır (abone olan bileşenler yeniden çizilir).
 *
 * Faz 2'de buraya NocoDB `settings` tablosundan gelen sunucu ayarları
 * eklenecek: öncelik → kullanıcı > sunucu > varsayılan.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "./defaults";
import { mergeDeep, isPlainObject } from "./merge";
import type { PixSettings } from "./types";

// ----------------------------------------------------------------------
//  Tarayıcı dışı ortamlarda (test, SSR) güvenli depolama
// ----------------------------------------------------------------------
function getStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  // Kalıcılık olmadan çalış (vitest / Node)
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  } as unknown as Storage;
}

// ----------------------------------------------------------------------
//  Depo
// ----------------------------------------------------------------------
interface SettingsState {
  settings: PixSettings;
  /** Kayıtlı sürüm ile kod sürümü uyuşmuyor mu (kullanıcıya bilgi vermek için) */
  migrated: boolean;

  /** Tek bir üst düzey grubu günceller (derin birleştirme ile). */
  update: <K extends keyof PixSettings>(section: K, patch: Partial<PixSettings[K]>) => void;
  /** Tüm ayarları değiştirir. */
  replace: (settings: PixSettings) => void;
  /** Varsayılanlara döndürür. */
  reset: () => void;
  /** Yalnızca bir grubu varsayılana döndürür. */
  resetSection: <K extends keyof PixSettings>(section: K) => void;
  /** JSON dışa aktarma (yedek / cihazlar arası taşıma). */
  exportJson: () => string;
  /** JSON içe aktarma. */
  importJson: (json: string) => { ok: true } | { ok: false; error: string };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      migrated: false,

      update: (section, patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [section]: mergeDeep(state.settings[section], patch),
          },
        })),

      replace: (settings) => set({ settings: mergeDeep(DEFAULT_SETTINGS, settings) }),

      reset: () => set({ settings: DEFAULT_SETTINGS, migrated: false }),

      resetSection: (section) =>
        set((state) => ({
          settings: { ...state.settings, [section]: DEFAULT_SETTINGS[section] },
        })),

      exportJson: () => JSON.stringify(get().settings, null, 2),

      importJson: (json) => {
        try {
          const parsed: unknown = JSON.parse(json);
          if (!isPlainObject(parsed)) {
            return { ok: false, error: "Kök nesne bekleniyordu." };
          }
          set({ settings: mergeDeep(DEFAULT_SETTINGS, parsed), migrated: false });
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Geçersiz JSON.",
          };
        }
      },
    }),
    {
      name: "pixtool.settings",
      version: SETTINGS_VERSION,
      storage: createJSONStorage(getStorage),

      // Kayıtlı ayarı şemayla birleştir → yeni alanlar varsayılandan gelir
      merge: (persisted, current) => {
        const incoming = isPlainObject(persisted) ? persisted["settings"] : undefined;
        return {
          ...current,
          settings: mergeDeep(DEFAULT_SETTINGS, incoming),
        };
      },

      // Sürüm uyuşmazlığında: ayarları varsayılanla birleştir ama kullanıcıyı uyar
      migrate: (persisted, version) => {
        const incoming = isPlainObject(persisted) ? persisted["settings"] : undefined;
        if (version !== SETTINGS_VERSION) {
          return {
            settings: mergeDeep(DEFAULT_SETTINGS, incoming),
            migrated: true,
          } as unknown as SettingsState;
        }
        return persisted as unknown as SettingsState;
      },

      // Yalnızca ayarlar saklanır, fonksiyonlar değil
      partialize: (state) => ({ settings: state.settings, migrated: state.migrated }),
    },
  ),
);

// ----------------------------------------------------------------------
//  Kısayol seçiciler (bileşenlerde tekrar tekrar yazmamak için)
// ----------------------------------------------------------------------
export const selectSettings = (state: SettingsState): PixSettings => state.settings;
export const selectAppearance = (state: SettingsState) => state.settings.appearance;
export const selectFlow = (state: SettingsState) => state.settings.flow;
export const selectLogin = (state: SettingsState) => state.settings.login;
export const selectIdle = (state: SettingsState) => state.settings.idle;
export const selectPower = (state: SettingsState) => state.settings.power;
export const selectLoading = (state: SettingsState) => state.settings.loading;
