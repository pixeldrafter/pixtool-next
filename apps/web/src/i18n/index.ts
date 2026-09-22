/**
 * Çoklu dil desteği (i18n).
 *
 * Kullanım:
 *   import { useI18n } from "@/i18n";
 *   const { t, lang, setLang } = useI18n();
 */

export { useI18n, listMissingTranslations, type I18n } from "./useI18n";
export { DICTIONARIES, tr, en, type Dictionary, type Lang } from "./dictionaries";
