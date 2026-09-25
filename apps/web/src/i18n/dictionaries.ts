/**
 * Çoklu dil desteği (i18n) — altyapı.
 *
 * Karar #13: "Türkçe varsayılan, i18n altyapısı kurulur, çeviri sonra."
 *
 * Tasarım:
 *   • Sözlükler düz nesnedir — bağımlılık yok
 *   • `t(key)` anahtarı çevirir; bulunamazsa **anahtarı** döndürür (sessiz hata yok)
 *   • Parametre desteği: `t("greeting", { name: "Ömer" })`
 *   • Eksik çeviri tespiti: `listMissingTranslations()`
 */

export type Lang = "tr" | "en";

/** Sözlük yapısı: anahtar → metin */
export type Dictionary = Record<string, string>;

// ----------------------------------------------------------------------
//  Türkçe (varsayılan — tam)
// ----------------------------------------------------------------------
export const tr: Dictionary = {
  // --- Genel ---
  "app.name": "Pixtool Next",
  "app.tagline": "Uzak sistem yönetim paneli",
  "common.ok": "Tamam",
  "common.cancel": "İptal",
  "common.save": "Kaydet",
  "common.close": "Kapat",
  "common.refresh": "Yenile",
  "common.retry": "Tekrar dene",
  "common.search": "Ara",
  "common.loading": "Yükleniyor…",
  "common.empty": "Sonuç yok",
  "common.error": "Hata",
  "common.warning": "Uyarı",
  "common.confirm": "Onayla",
  "common.running": "Çalışıyor…",
  "common.notConfigured": "Yapılandırılmadı",
  "common.configured": "Yapılandırıldı",
  "common.connected": "Bağlı",
  "common.disconnected": "Bağlı değil",

  // --- Başlat menüsü ---
  "start.title": "Başlat",
  "start.search": "Uygulama ara…",
  "start.hint": "↑↓ gez · Enter aç · Esc kapat · Ctrl+K",
  "start.group.monitor": "İzleme",
  "start.group.manage": "Yönetim",
  "start.group.system": "Sistem",

  // --- Uygulamalar ---
  "app.overview": "Genel Bakış",
  "app.overview.desc": "Sistem durumu, entegrasyonlar, uzak kaynaklar",
  "app.resources": "Kaynaklar",
  "app.resources.desc": "Bu makine ve uzak sunucu kapasitesi",
  "app.status": "Bağlantı Durumu",
  "app.status.desc": "Backend, NocoDB, n8n, Telegram durumu",
  "app.scripts": "Script Kütüphanesi",
  "app.scripts.desc": "Hazır PowerShell araçları",
  "app.terminal": "Terminal",
  "app.terminal.desc": "SSH ile uzak komut çalıştır",
  "app.files": "Dosya Yöneticisi",
  "app.files.desc": "SFTP ile uzak dosyalar",
  "app.users": "Kullanıcılar",
  "app.users.desc": "Uzak sistemdeki hesaplar",
  "app.database": "Veritabanı",
  "app.database.desc": "NocoDB tablo eşlemeleri ve kayıtlar",
  "app.tools": "Araçlar",
  "app.tools.desc": "Hesap makinesi, Mayın Tarlası, Yılan, XOX",
  "app.notes": "Yapışkan Notlar",
  "app.notes.desc": "Renkli notlar — tema ve renk seçenekleri",
  "app.settings": "Ayarlar",
  "app.settings.desc": "Tema, görünüm, giriş, akış",
  "app.about": "Pixtool Hakkında",
  "app.about.desc": "Sürüm, kısayollar, bileşen demoları",

  // --- Giriş ---
  "login.username": "Kullanıcı adı",
  "login.password": "Parola",
  "login.submit": "Giriş yap",
  "login.otp.title": "İki adımlı doğrulama",
  "login.otp.verify": "Doğrula",
  "login.otp.resend": "Kodu tekrar gönder",
  "login.otp.cancel": "Vazgeç",
  "login.otp.error": "Kod hatalı",
  "login.otp.success": "Doğrulandı!",
  "login.punishment.title": "Ampulü yak",

  // --- Sistem durumu ---
  "status.backend": "Backend API",
  "status.nocodb": "NocoDB (veri)",
  "status.n8n": "n8n (otomasyon)",
  "status.telegram": "Telegram (OTP)",
  "status.bridge": "Yerel Köprü",
  "status.policy": "Komut Politikası",
  "status.session": "Oturum",
  "status.report": "Cihaz Raporu",

  // --- Scriptler ---
  "scripts.title": "Script Kütüphanesi",
  "scripts.run": "Çalıştır",
  "scripts.category": "Kategori",
  "scripts.platform": "Platform",
  "scripts.lines": "Satır",
  "scripts.file": "Dosya",
  "scripts.author": "Yazar",
  "scripts.version": "Sürüm",
  "scripts.allCategories": "Tüm kategoriler",

  // --- Terminal ---
  "terminal.title": "Terminal",
  "terminal.placeholder": "komut girin…",
  "terminal.run": "Çalıştır",
  "terminal.clear": "Temizle",
  "terminal.policyWarn": "Komut politikası onay gerektiriyor:",

  // --- Dosyalar ---
  "files.title": "Dosya Yöneticisi",
  "files.up": "Üst dizin",
  "files.name": "Ad",
  "files.size": "Boyut",
  "files.permissions": "İzin",
  "files.modified": "Değişim",

  // --- Kullanıcılar ---
  "users.title": "Kullanıcılar",
  "users.fetch": "Kullanıcıları çek",
  "users.onlyShell": "Yalnızca kabuk erişimi",

  // --- Ayarlar ---
  "settings.title": "Ayarlar",
  "settings.section.general": "Genel",
  "settings.section.flow": "Açılış Akışı",
  "settings.section.appearance": "Görünüm",
  "settings.section.login": "Giriş",
  "settings.section.idle": "Boşta",
  "settings.section.power": "Güç",
  "settings.section.loading": "Yükleme",
  "settings.resetSection": "Bu bölümü sıfırla",
  "settings.resetAll": "Tümünü sıfırla",
};

// ----------------------------------------------------------------------
//  İngilizce (kısmi — altyapı gösterimi)
// ----------------------------------------------------------------------
export const en: Dictionary = {
  "app.name": "Pixtool Next",
  "app.tagline": "Remote system management panel",
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.refresh": "Refresh",
  "common.retry": "Retry",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.empty": "No results",
  "common.error": "Error",
  "common.warning": "Warning",
  "common.confirm": "Confirm",
  "common.running": "Running…",
  "common.notConfigured": "Not configured",
  "common.configured": "Configured",
  "common.connected": "Connected",
  "common.disconnected": "Disconnected",

  "start.title": "Start",
  "start.search": "Search apps…",
  "start.hint": "↑↓ navigate · Enter open · Esc close · Ctrl+K",
  "start.group.monitor": "Monitoring",
  "start.group.manage": "Management",
  "start.group.system": "System",

  "app.overview": "Overview",
  "app.overview.desc": "System status, integrations, remote resources",
  "app.resources": "Resources",
  "app.resources.desc": "This machine and remote server capacity",
  "app.status": "Connection Status",
  "app.status.desc": "Backend, NocoDB, n8n, Telegram status",
  "app.scripts": "Script Library",
  "app.scripts.desc": "Ready-made PowerShell tools",
  "app.terminal": "Terminal",
  "app.terminal.desc": "Run remote commands over SSH",
  "app.files": "File Manager",
  "app.files.desc": "Remote files over SFTP",
  "app.users": "Users",
  "app.users.desc": "Accounts on the remote system",
  "app.database": "Database",
  "app.database.desc": "NocoDB table mappings",
  "app.settings": "Settings",
  "app.settings.desc": "Theme, appearance, login, flow",
  "app.about": "About Pixtool",
  "app.about.desc": "Version, shortcuts, component demos",

  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.otp.title": "Two-factor authentication",
  "login.otp.verify": "Verify",
  "login.otp.resend": "Resend code",
  "login.otp.cancel": "Cancel",
  "login.otp.error": "Invalid code",
  "login.otp.success": "Verified!",
  "login.punishment.title": "Turn on the bulb",

  "status.backend": "Backend API",
  "status.nocodb": "NocoDB (data)",
  "status.n8n": "n8n (automation)",
  "status.telegram": "Telegram (OTP)",
  "status.bridge": "Local Bridge",
  "status.policy": "Command Policy",
  "status.session": "Session",
  "status.report": "Device Report",

  "scripts.title": "Script Library",
  "scripts.run": "Run",
  "scripts.category": "Category",
  "scripts.platform": "Platform",
  "scripts.lines": "Lines",
  "scripts.file": "File",
  "scripts.author": "Author",
  "scripts.version": "Version",
  "scripts.allCategories": "All categories",

  "terminal.title": "Terminal",
  "terminal.placeholder": "enter command…",
  "terminal.run": "Run",
  "terminal.clear": "Clear",
  "terminal.policyWarn": "Command policy requires confirmation:",

  "files.title": "File Manager",
  "files.up": "Parent directory",
  "files.name": "Name",
  "files.size": "Size",
  "files.permissions": "Perms",
  "files.modified": "Modified",

  "users.title": "Users",
  "users.fetch": "Fetch users",
  "users.onlyShell": "Shell access only",

  "settings.title": "Settings",
  "settings.section.general": "General",
  "settings.section.flow": "Boot Flow",
  "settings.section.appearance": "Appearance",
  "settings.section.login": "Login",
  "settings.section.idle": "Idle",
  "settings.section.power": "Power",
  "settings.section.loading": "Loading",
  "settings.resetSection": "Reset this section",
  "settings.resetAll": "Reset everything",
};

export const DICTIONARIES: Record<Lang, Dictionary> = { tr, en };

/** Türkçe'de olup İngilizce'de eksik olan anahtarlar (çeviri takibi). */
export function listMissingTranslations(lang: Lang = "en"): string[] {
  const target = DICTIONARIES[lang];
  return Object.keys(tr).filter((key) => !(key in target));
}
