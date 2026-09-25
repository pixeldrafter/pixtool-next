/**
 * Giriş ekranı metinleri — Türkçe.
 *
 * Tüm login formları bu sabitleri kullanır; böylece ibareler tek yerden
 * değişir ve formlar arasında tutarlı kalır.
 *
 * ⚠️ Formlar referans tasarımların birebir portudur; **yerleşim ve animasyon**
 * korunur, yalnızca **görünen metinler** Türkçeleştirilir.
 */

export const LOGIN_TEXT = {
  /** Form başlığı (kısa) */
  welcome: "Hoş Geldiniz",
  /** Kayan şerit metni */
  marquee: "Ömer Çataloğlu'nun Dünyasına hoş geldiniz",
  /** Alt bilgi — nabız animasyonlu */
  copyright: "Ömer Çataloğlu © 2026 – All Right reserved!",

  username: "Kullanıcı Adı",
  password: "Parola",
  usernamePlaceholder: "Kullanıcı adını yazın",
  passwordPlaceholder: "Parolanı yazın",

  signIn: "Giriş Yap",
  signingIn: "Giriş yapılıyor…",

  forgot: "Parolamı unuttum",
  register: "Yeni kullanıcı kaydı",

  /** Kayıt / parola formları */
  registerTitle: "Yeni Kullanıcı Kaydı",
  registerIntro:
    "Talebin Telegram üzerinden yöneticiye iletilir. Onaylandığında hesabın otomatik oluşturulur.",
  forgotTitle: "Parola Yenileme",
  forgotIntro:
    "Kullanıcı adını gönder — Telegram üzerinden yönetici onayıyla yeni parola talebin iletilir.",
  fullName: "Ad Soyad",
  email: "E-posta",
  note: "Not (isteğe bağlı)",
  send: "Gönder",
  sending: "Gönderiliyor…",
  cancel: "Vazgeç",
  back: "Geri",

  /** Durumlar */
  waiting: "Yönetici onayı bekleniyor…",
  waitingHint: "Telegram'daki bildirimi onayladığında bu ekran otomatik ilerler.",
  approved: "Talebin onaylandı!",
  rejected: "Talebin reddedildi.",
  timeout: "Süre doldu — yönetici yanıt vermedi.",
} as const;

/** Hoş geldiniz şeridinin varsayılan hızı (saniye / tam tur). */
export const MARQUEE_DURATION = 18;
