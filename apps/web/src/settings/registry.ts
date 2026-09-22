/**
 * Ayar kayıt defteri — seçilebilir tüm değerlerin listesi.
 *
 * Settings ekranı bu listelerden otomatik olarak seçim kutuları üretir.
 * Yeni bir login formu / tema / cursor eklemek için yalnızca buraya kayıt
 * eklemek ve ilgili bileşeni yazmak yeterlidir.
 */

import type { CursorKind, IdleScreenId, LoginFormId, ThemeId, WallpaperKind } from "./types";

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

// ----------------------------------------------------------------------
//  Temalar
// ----------------------------------------------------------------------
export const THEME_OPTIONS: Option<ThemeId>[] = [
  { value: "windows", label: "Windows (Fluent)", hint: "Mica yüzeyler, yumuşak köşeler" },
  { value: "kde", label: "KDE Plasma (Breeze)", hint: "Breeze Dark paleti" },
  { value: "neon", label: "Neon (özgün)", hint: "Pixtool'un klasik siber görünümü" },
];

// ----------------------------------------------------------------------
//  Login formları
// ----------------------------------------------------------------------
export const LOGIN_FORM_OPTIONS: Option<LoginFormId>[] = [
  { value: "lamp", label: "Login Form Lamp", hint: "Varsayılan — lamba aydınlatmalı" },
  { value: "animated", label: "Animated Login Form", hint: "Kayan etiket animasyonu" },
  {
    value: "animatedBorder",
    label: "Animated Border Login Form",
    hint: "Dönen kenarlık ışığı",
  },
  { value: "panda", label: "Panda Login Form", hint: "Panda karakteri" },
  { value: "pandaPage", label: "Panda Login Page", hint: "Panda — tam sayfa" },
  { value: "yeti", label: "Yeti Login Form Animation", hint: "Kar temalı, en zengin animasyon" },
];

// ----------------------------------------------------------------------
//  Duvar kağıdı
// ----------------------------------------------------------------------
export const WALLPAPER_OPTIONS: Option<WallpaperKind>[] = [
  { value: "spider-clock", label: "🕷️ Spider Clock", hint: "Sistem saatini gösterir — varsayılan" },
  { value: "pixel-bat", label: "🦇 Pixel Bat", hint: "Yarasa animasyonu" },
  { value: "gradient", label: "Gradyan", hint: "Tema renklerinden üretilen yumuşak geçiş" },
  { value: "solid", label: "Düz renk", hint: "Tema arkaplan rengi" },
  { value: "image", label: "Kendi görselim", hint: "Yerel dosya veya harici URL" },
];

// ----------------------------------------------------------------------
//  Cursor
// ----------------------------------------------------------------------
export const CURSOR_OPTIONS: Option<CursorKind>[] = [
  { value: "default", label: "Sistem imleci", hint: "İşletim sistemi varsayılanı" },
  { value: "spider", label: "🕷️ Spider Cursor", hint: "Örümcek ağı izli imleç" },
  { value: "reptile", label: "🦎 Reptile Interactive", hint: "Etkileşimli sürüngen" },
  { value: "none", label: "Gizli", hint: "İmleci sakla (kiosk / sunum)" },
];

// ----------------------------------------------------------------------
//  Boşta ekranı
// ----------------------------------------------------------------------
export const IDLE_SCREEN_OPTIONS: Option<IdleScreenId>[] = [
  { value: "pixel-bat", label: "🦇 Pixel Bat", hint: "Karanlıkta uçan yarasalar — varsayılan" },
  { value: "spider-clock", label: "🕷️ Spider Clock", hint: "Örümcek saat" },
  { value: "black", label: "Sadece siyah", hint: "Ekran karartma" },
  { value: "none", label: "Kapalı", hint: "Boşta ekranı açılmaz" },
];

// ----------------------------------------------------------------------
//  Akış adımları (Türkçe etiketler)
// ----------------------------------------------------------------------
export const FLOW_STEP_LABELS: Record<string, string> = {
  login: "Giriş (login + OTP)",
  console: "Konsol (makine bilgisi)",
  boot: "Boot animasyonu",
  desktop: "Masaüstü",
};

// ----------------------------------------------------------------------
//  Konsol ayrıntı seviyesi
// ----------------------------------------------------------------------
export const VERBOSITY_OPTIONS: Option<"off" | "summary" | "everything">[] = [
  {
    value: "off",
    label: "Kapalı",
    hint: "Hiçbir şey akmaz — sessizce boot edilip masaüstü açılır",
  },
  { value: "summary", label: "Özet", hint: "Yalnızca önemli satırlar" },
  {
    value: "everything",
    label: "Her şey",
    hint: "Makinenin tüm bilgisi ekrana akar (önerilen)",
  },
];

// ----------------------------------------------------------------------
//  OTP ekranı tasarımı
// ----------------------------------------------------------------------
export const OTP_STYLE_OPTIONS: Option<"yeti" | "classic">[] = [
  {
    value: "yeti",
    label: "Yeti tasarımı",
    hint: "Yeti login formunun görsel dili — karakter tepki verir",
  },
  {
    value: "classic",
    label: "Klasik (forma uyumlu)",
    hint: "Gönderilen login formunun temasına uyan kutular",
  },
];
