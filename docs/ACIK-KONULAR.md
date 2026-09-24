# Açık Konular

> Bunlar **iş akışını bloklamaz**. İlgili faza gelindiğinde netleşecek.
> Kaynak: devir dokümanı §14.

| # | Konu | Ne zaman | Durum |
|---|---|---|---|
| 1 | **Köprü ↔ tarayıcı kısıtı** (mixed content / Private Network Access) | Faz 0 | ✅ **Çözüldü** — `127.0.0.1` güvenilir kaynak; CORS + PNA başlıkları |
| 2 | **Köprü güvenliği & dağıtımı** — token; nasıl kurulacak | Faz 3 | ✅ **Çözüldü** — Tauri sidecar (PyInstaller `.exe`) + otomatik token |
| 3 | **NocoDB tablo/şema tasarımı** | Faz 0-2 | ✅ **Çözüldü** — `Pixtool` projesi, 8 tablo eşlendi |
| 4 | **Kimlik & OTP akış detayı** — oturum süresi, hatalı deneme kilidi | Faz 1 | ✅ **Çözüldü** — HMAC token 8sa, 3 deneme + ceza ekranı |
| 5 | **Cihaz kimliği** — kalıcı `device_id` | Faz 3 | ✅ **Çözüldü** — hostname+MAC+platform → SHA256 |
| 6 | **Scriptler nerede durur, nerede çalışır** | Faz 2-3 | ✅ **Çözüldü** — dosya + `.meta.json`; çalıştırma köprü/SSH |
| 7 | **Zaafiyet taraması** — (a) nmap, (b) yerleşik, (c) OpenVAS/Nessus | Faz 3 | ⏳ Açık |
| 8 | **Migrasyon eşleme** — `secrets.json` → NocoDB | Faz 0-2 | ✅ **Bulundu** — `secrets.json` okundu, değerler kullanıldı |
| 9 | **Yedekleme stratejisi** — NocoDB dump/export | Faz 2-3 | ⏳ Açık |
| 10 | **Tarayıcı destek matrisi** | Faz 1 | ✅ Modern Chrome/Edge/Firefox |
| 11 | **Bildirimler** — Telegram yalnızca login değil | Faz 2-3 | ⏳ Kısmi (toast + OTP) |
| 12 | **Güncelleme mekanizması** — Tauri updater | Faz 4 | ⏳ Açık |
| 13 | **Versiyonlama** — semver + changelog + CI | Faz 4 | ⏳ Kısmi |
| 14 | **Geliştirme ortamı** | ✅ | ✅ **Çözüldü** — sunucudaki NocoDB |
| 15 | **Proje klasör adı** | ✅ | ✅ **Çözüldü** — `pixtool-next` |

---

## Faz 3/4'te çözülen teknik zorluklar (kayıt için)

| Sorun | Çözüm |
|---|---|
| PowerShell çıktısı UTF-8 değil → okuyucu iş parçacığı ölüyor, veri **boş** geliyor | `[Console]::OutputEncoding=UTF8` + `errors="replace"` |
| Windows konsolu kutu çizim karakterlerini kodlayamıyor (PyInstaller exe çöküyor) | `stream.reconfigure(encoding="utf-8", errors="replace")` |
| PyInstaller `--onefile` iki süreç → `child.kill()` kalıntı bırakıyor | `--parent-pid` bekçisi → `os._exit(0)` |
| Tauri'de `/api/` aynı kökende yok | Çalışma-zamanı köken algılama (`tauri://` → uzak sunucu) |
| `tauri.conf.json` `assetProtocol` ↔ Cargo `protocol-asset` uyuşmazlığı | Kullanılmayan özellik kaldırıldı |
| Rust `App::listen` → RunEvent için yanlış API | `.build()?.run(\|handle, event\| …)` |
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
