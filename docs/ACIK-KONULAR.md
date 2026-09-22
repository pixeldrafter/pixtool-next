# Açık Konular

> Bunlar **iş akışını bloklamaz**. İlgili faza gelindiğinde netleşecek.
> Kaynak: devir dokümanı §14.

| # | Konu | Ne zaman |
|---|---|---|
| 1 | **Köprü ↔ tarayıcı kısıtı** (mixed content / Private Network Access) → Tauri çözümü doğrulanacak | **Faz 0** |
| 2 | **Köprü güvenliği & dağıtımı** — token; nasıl kurulacak: (a) Tauri'ye gömme, (b) taşınabilir `.exe` (USB), (c) kurulum sihirbazı | Faz 3 |
| 3 | **NocoDB tablo/şema tasarımı** — ilk öneri: `users`, `devices`, `scripts`, `resources`, `logs`, `settings`, `permissions`, `licenses`, `audit` | Faz 0-2 |
| 4 | **Kimlik & OTP akış detayı** — oturum süresi, "beni hatırla", hatalı deneme kilidi | Faz 1 |
| 5 | **Cihaz kimliği** — kalıcı `device_id` (anakart / MAC / hostname karışımı) | Faz 3 |
| 6 | **Scriptler nerede durur, nerede çalışır** — saklama: NocoDB (metin/attachment); çalıştırma: yerel köprü **veya** SSH | Faz 2-3 |
| 7 | **Zaafiyet taraması** — (a) nmap, (b) yerleşik temel kontroller, (c) OpenVAS/Nessus | Faz 3 |
| 8 | **Migrasyon eşleme** — `secrets.json`, MySQL `users`, `config/*.json`, `local_scripts/` → NocoDB. **Sırlar önce rotate.** | Faz 0-2 |
| 9 | **Yedekleme stratejisi** — NocoDB dump/export + yerel düzenli export | Faz 2-3 |
| 10 | **Tarayıcı destek matrisi** — son 1-2 sürüm Chrome/Edge/Firefox + mobil. Win7 düştüğü için eski tarayıcı derdi yok | Faz 1 |
| 11 | **Bildirimler** — Telegram yalnızca login değil; script sonucu, hata, tarama raporu | Faz 2-3 |
| 12 | **Güncelleme mekanizması** — web: yeni deploy (otomatik); masaüstü kabuk: Tauri updater; köprü: kendi updater'ı | Faz 4 |
| 13 | **Versiyonlama** — semver + changelog + CI | Faz 4 |
| 14 | **Geliştirme ortamı** — ~~Docker NocoDB~~ → **çözüldü:** sunucudaki mevcut NocoDB'de test base | ✅ |
| 15 | ~~Proje klasör adı~~ → **çözüldü:** `pixtool-next` | ✅ |
| 16 | **Erişilebilirlik / performans** — klavye gezinme, "hareketi azalt", düşük güçlü makinede animasyon kısıtlama | Faz 1 |
| 17 | **Login animasyon örnekleri** — kullanıcı dosya olarak verecek (karar #7) | Faz 1 |
| 18 | **NocoDB API token + base id** — kullanıcı verecek | **Faz 0** |
| 19 | **Tauri araç zinciri** — Rust + Visual Studio C++ Build Tools (~6 GB) kurulacak | Faz 4 (veya gerekince) |
| 20 | **Sunucu tarafı dağıtım** — Yunohost'ta nasıl barınacak (yeni app? reverse proxy? subdomain?) | Faz 4 |

---

## Faz 0'ı ilgilendirenler

- **#1** Köprü ↔ tarayıcı kısıtı (mimariyi etkiler)
- **#3** NocoDB tablo şeması (backend adapter'ı etkiler)
- **#8** Migrasyon eşleme (sır rotate)
- **#14** ✅ çözüldü
- **#15** ✅ çözüldü
- **#18** NocoDB API token + base id — **kullanıcıdan bekleniyor**
