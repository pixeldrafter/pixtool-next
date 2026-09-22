/**
 * Tema uygulayıcı.
 *
 * Ayar deposundaki görünüm tercihlerini DOM'a yansıtır:
 *   • tema      → <html data-theme="...">
 *   • hareket   → <html data-motion="...">
 *   • ölçek     → --ui-scale değişkeni
 *
 * CSS tarafı (styles/tokens.css) `[data-theme="..."]` bloklarıyla renkleri
 * override eder. Böylece tema geçişi JS ile stil yazmadan, saf CSS ile olur
 * (daha hızlı ve bakımı kolay).
 */

import { useEffect } from "react";

import { useSettingsStore } from "../settings/store";
import type { ThemeId } from "../settings/types";

export interface AppliedTheme {
  theme: ThemeId;
  motion: "full" | "reduced";
  scale: number;
}

/** Verilen görünüm ayarlarını DOM'a uygular. */
export function applyTheme({ theme, motion, scale }: AppliedTheme): void {
  const root = document.documentElement;

  root.dataset["theme"] = theme;
  root.dataset["motion"] = motion;
  root.style.setProperty("--ui-scale", String(scale));

  // Ölçek: #root üzerinde zoom ile uygulanır (bkz. global.css)
  const container = document.getElementById("root");
  if (container) {
    container.style.zoom = String(scale);
  }
}

/**
 * Ayar deposunu izler ve tema değiştiğinde DOM'u günceller.
 * `App` içinde bir kez çağrılır.
 */
export function useThemeSync(): AppliedTheme {
  const theme = useSettingsStore((state) => state.settings.appearance.theme);
  const motion = useSettingsStore((state) => state.settings.appearance.motion);
  const scale = useSettingsStore((state) => state.settings.appearance.scale);

  useEffect(() => {
    applyTheme({ theme, motion, scale });
  }, [theme, motion, scale]);

  return { theme, motion, scale };
}
