/**
 * Ayar modülü dışa aktarımları.
 *
 * Kullanım:
 *   import { useSettings, DEFAULT_SETTINGS, LOGIN_FORM_OPTIONS } from "@/settings";
 *
 *   const { settings, update } = useSettings();
 *   update("appearance", { theme: "kde" });
 */

export * from "./types";
export * from "./defaults";
export * from "./registry";
export { mergeDeep, isPlainObject } from "./merge";
export {
  useSettingsStore,
  selectSettings,
  selectAppearance,
  selectFlow,
  selectLogin,
  selectIdle,
  selectPower,
  selectLoading,
} from "./store";

import { useSettingsStore } from "./store";

/** Ayar deposuna kolay erişim. */
export function useSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const replace = useSettingsStore((state) => state.replace);
  const reset = useSettingsStore((state) => state.reset);
  const resetSection = useSettingsStore((state) => state.resetSection);
  const exportJson = useSettingsStore((state) => state.exportJson);
  const importJson = useSettingsStore((state) => state.importJson);
  const migrated = useSettingsStore((state) => state.migrated);

  return {
    settings,
    update,
    replace,
    reset,
    resetSection,
    exportJson,
    importJson,
    migrated,
  };
}

/** Yalnızca görünüm ayarları (sık kullanılan). */
export function useAppearance() {
  const appearance = useSettingsStore((state) => state.settings.appearance);
  const update = useSettingsStore((state) => state.update);
  return { appearance, update };
}
