# Alınan Kararlar (KİLİTLİ)

> Kaynak: `PIXTOOL-NEXT-CONTEXT.md` v3 (21 Eylül 2026) — bu projeye devredilen kilitli kararlar.
> Değiştirilmesi gerekiyorsa burada güncellenir ve gerekçesi yazılır.

| # | Konu | Karar |
|---|---|---|
| 1 | **Kapsam** | Kişisel kullanım. Ticari kısım (lisans / imzalama / marka) **askıda**. |
| 2 | **Çalışma modeli** | **ONLINE.** İnternete açık, kendi sunucuda barınır. Backend/API oradadır. |
| 3 | **Ayarlar** | `pixtool.env` → bu depoda `.env` olarak. Sırlar repoya girmez. |
| 4 | **Backend dili** | ✅ **PYTHON.** Rust'a çeviri yok. |
| 5 | **Veri** | ✅ **NocoDB = her şey.** Tüm veri API token ile oradan. |
| 6 | **Kimlik** | **Login + OTP korunuyor.** n8n + Telegram ile OTP akışı. |
| 7 | **Login tasarımı** | Kullanıcı beğendiği animasyonlu login örneklerini dosya olarak verecek. |
| 8 | **Komut güvenliği** | **Seçilebilir:** `confirm` / `whitelist` / `allow_all`. |
| 9 | **Agent** | **Şimdilik yok.** Proje bitince. |
| 10 | **Boot** | Sadece açılışta. Mevcut konsol boot'u **harfiyen** korunur + yeni taramalar. |
| 11 | **Görünüm** | **Çoklu pencere**, işletim sistemi gibi, profesyonel. **Temalar: Windows + Linux KDE.** |
| 12 | **Mobil** | **İsteniyor.** Tarayıcı / PWA. |
| 13 | **Dil** | **Türkçe.** i18n altyapısı kurulur, çeviri sonra. |
| 14 | **MVP sırası** | Login+OTP → Boot/Kabuk → Overview → Scripts → Files → Terminal → Users → Settings → DB → Resources |
| 15 | **Windows** | ✅ Win10 (1809+) + Win11. **Win7 İPTAL.** |
| 16 | **Linux** | ✅ Ubuntu / Debian. |
| 17 | **Migrasyon** | Kurulumda **tek seferlik script** ile eski veriler taşınır. |
| 18 | **macOS** | ❌ Yok. |

---

## Sonradan eklenen mimari karar (22 Eylül 2026)

| # | Konu | Karar |
|---|---|---|
| 19 | **Arayüz yığını** | ✅ **React + FastAPI + Tauri** (PySide6 devam edilmiyor). |
| 20 | **Proje adı / konum** | `pixtool-next` — yeni klasör, eski kodla karışmaz. |
| 21 | **Eski kod** | Hasat edilir (bkz. `HASAT.md`), çöpe gitmez. PySide6 UI yeniden yazılır. |
| 22 | **Yerel NocoDB (Docker)** | ⛔ Gerekmiyor — sunucudaki mevcut NocoDB'de **test base** kullanılır. |
