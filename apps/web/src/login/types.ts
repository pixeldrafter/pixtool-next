/**
 * Login sistemi tipleri.
 *
 * Tasarım: her login formu **kendi görsel dilini** taşır. OTP adımı ve şaka
 * balonu bu dile uyum sağlar — bu yüzden `LoginTheme` tek bir yerde tanımlanır
 * ve tüm alt bileşenler ona göre çizilir.
 *
 * Yeni bir form eklemek için:
 *   1. `themes.ts` → tema tanımı
 *   2. `registry.ts` → kayıt satırı
 *   3. `forms/` → bileşen
 */

import type { LoginFormId } from "../settings/types";

export type { LoginFormId };

// ----------------------------------------------------------------------
//  Kimlik bilgileri
// ----------------------------------------------------------------------
export interface LoginCredentials {
  username: string;
  password: string;
}

// ----------------------------------------------------------------------
//  Tema
// ----------------------------------------------------------------------

/** Şaka balonunun görsel biçimi. */
export type JokeStyle = "card" | "speech" | "terminal" | "ticker" | "frost";

/** OTP kutularının görsel biçimi. */
export type OtpStyle = "boxes" | "underline" | "glow" | "paws" | "snow";

/** Animasyon karakteri — hareket yoğunluğunu belirler. */
export type MotionStyle = "minimal" | "playful" | "glow" | "frost";

/** Konuşma tonu — başarı/hata mesajlarının üslubu. */
export type ThemeTone = "professional" | "friendly" | "playful";

export interface LoginThemeColors {
  /** Sayfa zemini */
  bg: string;
  /** Form kartı yüzeyi */
  surface: string;
  /** Kenarlık */
  border: string;
  /** Vurgu rengi (buton, odak, ilerleme) */
  accent: string;
  /** Birincil metin */
  text: string;
  /** İkincil metin */
  muted: string;
  /** Hata rengi */
  error: string;
  /** Başarı rengi */
  success: string;
}

export interface LoginTheme {
  id: LoginFormId;
  /** Ayarlar ekranında görünen ad */
  name: string;
  /** Kısa açıklama */
  hint: string;
  colors: LoginThemeColors;
  font: string;
  motion: MotionStyle;
  jokeStyle: JokeStyle;
  otpStyle: OtpStyle;
  tone: ThemeTone;
}

// ----------------------------------------------------------------------
//  Form sözleşmesi
// ----------------------------------------------------------------------

/**
 * Her login formunun uyacağı arayüz.
 *
 * Form **yalnızca kimlik bilgilerini toplar**. Doğrulama, OTP ve hata yönetimi
 * `LoginScreen` içindedir — böylece formlar birbirinden bağımsız kalır.
 */
export interface LoginFormProps {
  theme: LoginTheme;
  /** Ayarlardan gelen etiketler (kullanıcı özelleştirebilir) */
  labels: {
    username: string;
    password: string;
  };
  /** Kullanıcı gönderdiğinde çağrılır */
  onSubmit: (credentials: LoginCredentials) => void;
  /** İstek sürüyor mu */
  loading: boolean;
  /** Hata mesajı (varsa) */
  error: string | null;
  /** Giriş kilitli mi (OTP aşamasında veya ceza sırasında) */
  disabled: boolean;
  /** Gönder düğmesi etiketi */
  submitLabel?: string;
}

// ----------------------------------------------------------------------
//  Akış adımları
// ----------------------------------------------------------------------
export type LoginStep =
  | "credentials"
  | "otp"
  | "punishment"
  | "success";

/**
 * OTP kutularının görsel durumu.
 *
 *   idle      → normal
 *   verifying → doğrulanıyor (nabız efekti)
 *   error     → hatalı kod: kutular kırmızıya döner ve SALLANIR
 *   success   → doğru kod: kutular sırayla yeşile döner ve ZIPLAR
 */
export type OtpStatus = "idle" | "verifying" | "error" | "success";

export interface OtpChallenge {
  /** Sunucudan gelen meydan okuma kimliği */
  challengeId: string;
  /** Kaç hane */
  length: number;
  /** Kalan deneme hakkı */
  attemptsLeft: number;
  /**
   * Geliştirme kipi: sunucu OTP'yi yanıtta döndürür.
   * Telegram/n8n yapılandırılmadığında ekranda gösterilir.
   */
  devCode?: string;
  /** Kodun gönderildiği kanal açıklaması */
  channelLabel: string;
}
