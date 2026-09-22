/**
 * i18n kancası.
 *
 * Kullanım:
 *   const { t, lang, setLang } = useI18n();
 *   <h1>{t("app.overview")}</h1>
 *   <span>{t("scripts.count", { n: 18 })}</span>
 *
 * Dil, ayarlardan (`settings.general.lang`) okunur ve oradan değiştirilir.
 */

import { useCallback, useMemo } from "react";

import { useSettingsStore } from "../settings/store";
import { DICTIONARIES, listMissingTranslations, type Dictionary, type Lang } from "./dictionaries";

/** Şablon parametrelerini uygular: "Merhaba {name}" + {name:"Ömer"} */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export interface I18n {
  /** Aktif dil */
  lang: Lang;
  /** Dili değiştirir (ayarlara yazar) */
  setLang: (lang: Lang) => void;
  /** Çeviri — anahtar yoksa anahtarı döndürür */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Aktif sözlük (nadiren doğrudan erişim için) */
  dictionary: Dictionary;
  /** Eksik çeviriler (geliştirme aracı) */
  missing: string[];
}

export function useI18n(): I18n {
  const lang = useSettingsStore((state) => state.settings.general.lang);
  const update = useSettingsStore((state) => state.update);

  const dictionary = DICTIONARIES[lang] ?? DICTIONARIES.tr;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Aktif dilde yoksa Türkçe'ye düş (kısmi çeviri desteği)
      const template = dictionary[key] ?? DICTIONARIES.tr[key] ?? key;
      return interpolate(template, params);
    },
    [dictionary],
  );

  const setLang = useCallback(
    (next: Lang) => {
      update("general", { lang: next });
    },
    [update],
  );

  const missing = useMemo(() => listMissingTranslations(lang), [lang]);

  return { lang, setLang, t, dictionary, missing };
}

export { listMissingTranslations };
export type { Dictionary, Lang };
