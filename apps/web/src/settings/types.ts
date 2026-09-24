/**
 * Ayarlar şeması.
 *
 * Tasarım ilkesi: **kullanıcı her şeyi özelleştirebilir** (karar: kullanıcı isteği).
 * Bu yüzden hemen her davranış bir ayara bağlıdır; kodda sabit varsayım yoktur.
 *
 * Katmanlar:
 *   varsayılan (defaults.ts) → bu depoda yazılı
 *   kullanıcı  (localStorage)  → tarayıcıda saklı, anında uygulanır
 *   sunucu     (NocoDB `settings`) → Faz 2'de; cihazlar arası ortak
 *
 * Öncelik: kullanıcı > sunucu > varsayılan
 */

// ----------------------------------------------------------------------
//  Akış
// ----------------------------------------------------------------------

/** Uygulama açılış adımları. Sırası kullanıcı tarafından değiştirilebilir. */
export type FlowStep = "login" | "console" | "boot" | "desktop";

export interface FlowSettings {
  /** Açılış adımlarının sırası. Tam ve eksiksiz olmalıdır. */
  order: FlowStep[];
  /**
   * Konsol ayrıntı seviyesi — "her şeyi ekrana bas" anahtarı.
   *   off        → konsol atlanır, doğrudan boot edilir (kimseyi rahatsız etmez)
   *   summary    → özet satırlar
   *   everything → makinenin tüm bilgisi akar
   */
  consoleVerbosity: "off" | "summary" | "everything";
  /** Açılış sonunda "bu bilgileri kaydet?" sorulsun mu. */
  askSaveReport: boolean;
  /** Rapor nereye kaydedilsin. */
  reportTarget: "nocodb" | "local";
}

// ----------------------------------------------------------------------
//  Görünüm
// ----------------------------------------------------------------------

/** Tema kimlikleri. Yeni tema eklemek için theme/themes.ts'e kayıt yeterlidir. */
export type ThemeId = "windows" | "kde" | "neon";

export type WallpaperKind =
  | "solid"
  | "gradient"
  | "image"
  | "video"
  | "spider-clock"
  | "pixel-bat";

export interface WallpaperSettings {
  kind: WallpaperKind;
  /** kind === "image" iken: yerel dosya yolu veya harici URL */
  source: string;
  /** Görselin karartılma oranı (0-1) — pencere okunabilirliği için */
  dim: number;
  /** Arkaplan animasyonu hızı (0.25 - 2) */
  speed: number;
}

export type CursorKind = "default" | "spider" | "reptile" | "none";

export interface CursorSettings {
  kind: CursorKind;
  /** İz/kuyruk uzunluğu */
  trail: number;
  /** Özel cursor görseli (kind === "default" iken geçerli) */
  image: string;
}

export interface AppearanceSettings {
  theme: ThemeId;
  wallpaper: WallpaperSettings;
  cursor: CursorSettings;
  /** Erişilebilirlik: hareketi azalt (ACIK-KONULAR #16) */
  motion: "full" | "reduced";
  /** Arayüz ölçeği (0.85 - 1.3) */
  scale: number;
  /** Masaüstü ikon boyutu (Windows'taki gibi) */
  iconSize: "small" | "medium" | "large";
  /** Bildirim sesleri */
  soundEnabled: boolean;
}

// ----------------------------------------------------------------------
//  Login
// ----------------------------------------------------------------------

export type LoginFormId =
  | "lamp"
  | "animated"
  | "animatedBorder"
  | "panda"
  | "pandaPage"
  | "yeti";

export interface LoginSettings {
  /** Aktif login formu — sıkıldıkça değiştirilir. */
  form: LoginFormId;
  /**
   * Lamp formu: açılışta lamba **yanık** (giriş formu görünür) başlasın mı?
   *
   * Referans tasarımda form, lamba ipi çekilene kadar gizlidir. Gerçek bir
   * giriş ekranında formun hemen görünmesi daha kullanışlıdır — bu yüzden
   * varsayılan `true`. Kapatılırsa orijinal etkileşim korunur:
   * önce ipi çekmen gerekir.
   */
  lampStartLit: boolean;
  /** Kullanıcı adı alanı etiketi (formlar arası ortak) */
  usernameLabel: string;
  passwordLabel: string;
  /** Giriş ekranındaki şakalar */
  jokes: {
    enabled: boolean;
    /** Kaç saniyede bir yeni şaka (0 = sabit) */
    rotateSeconds: number;
    /** Form temasına göre şaka sunumu */
    style: "theme" | "plain";
  };
  /** İki adımlı doğrulama */
  otp: {
    enabled: boolean;
    length: number;
    /** Kaç yanlış denemeden sonra ceza ekranı açılır */
    maxAttempts: number;
    /** OTP nereden gönderilir */
    channel: "telegram" | "n8n" | "totp";
    /**
     * OTP ekranının tasarımı.
     *
     *   "yeti"    → Yeti login formunun görsel diliyle (VARSAYILAN)
     *   "classic" → gönderilen login formunun temasına uyan kutular
     */
    style: "yeti" | "classic";
  };
  /** Ceza ekranı (The Impossible Light Bulb) */
  punishment: {
    enabled: boolean;
    /** Geri sayım süresi (saniye) */
    countdownSeconds: number;
    /** Kapı/zil sesi çalınsın mı */
    sound: boolean;
    /** Bu süre boyunca girdi tamamen kilitlenir */
    lockInput: boolean;
  };
}

// ----------------------------------------------------------------------
//  Boşta kalma & güç
// ----------------------------------------------------------------------

export type IdleScreenId = "none" | "pixel-bat" | "spider-clock" | "black";

export interface IdleSettings {
  enabled: boolean;
  /** Kaç dakika hareketsizlikten sonra */
  minutes: number;
  screen: IdleScreenId;
  /** Devam etmek için parola istensin mi */
  requirePassword: boolean;
  /** Boşta ekranındaki ses */
  sound: boolean;
}

export interface PowerSettings {
  /** Kapatma düğmesinde animasyonlu buton kullanılsın mı (Animated Logout) */
  animatedShutdown: boolean;
  /** Kapatmadan önce onay istensin mi */
  confirmShutdown: boolean;
}

// ----------------------------------------------------------------------
//  Bekleme & yükleme
// ----------------------------------------------------------------------

export interface LoadingSettings {
  /** Belirli süreli işlemlerde Interactive Deadline kullan */
  progressBarStyle: "deadline" | "simple";
  /** Belirsiz beklemelerde bg.gif perdesi */
  waitingCurtain: boolean;
  /** Bekleme perdesi karartma oranı */
  curtainDim: number;
}

// ----------------------------------------------------------------------
//  Kök şema
// ----------------------------------------------------------------------

export interface PixSettings {
  /** Şema sürümü — göç (migration) için */
  version: number;

  general: {
    /** Arayüz dili (i18n) */
    lang: "tr" | "en";
    /** Geliştirici modu — ekstra günlük ve hata ayrıntısı */
    devMode: boolean;
  };

  flow: FlowSettings;
  appearance: AppearanceSettings;
  login: LoginSettings;
  idle: IdleSettings;
  power: PowerSettings;
  loading: LoadingSettings;
  bridge: BridgeSettings;
}

/**
 * Yerel köprü ayarları (Faz 3).
 *
 * Konsol, `127.0.0.1:8765` üzerindeki küçük servisten **gerçek** makine
 * bilgisini alır. Servis kapalıysa konsol "köprü bekleniyor" gösterir.
 */
export interface BridgeSettings {
  /** Köprü kullanılsın mı */
  enabled: boolean;
  /** Köprü adresi (örn. `http://127.0.0.1:8765`) */
  url: string;
  /** Erişim tokenı (köprü başlarken konsola yazdırır) */
  token: string;
  /** Konsol açılışta köprüyü otomatik sorgulasın mı */
  autoProbe: boolean;
  /** Köprü üzerinden script çalıştırma izni (komut politikasına ek) */
  allowRun: boolean;
}

/** Ayar gruplarının kimlikleri (Settings ekranı sekmeleri için). */
export type SettingsSection =
  | "general"
  | "flow"
  | "appearance"
  | "login"
  | "idle"
  | "power"
  | "loading"
  | "bridge";
