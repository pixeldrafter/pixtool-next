# Backend API — Uç Noktalar

Taban: `http://127.0.0.1:8000` · OpenAPI: `/docs`

---

## Genel

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/` | Servis kimliği |
| GET | `/health` | Canlılık kontrolü |
| GET | `/api/v1/status` | Yapılandırma + entegrasyon durumu + tablo eşlemeleri |

---

## Kimlik doğrulama

| Yöntem | Yol | Açıklama |
|---|---|---|
| POST | `/api/v1/auth/login` | Şifre + OTP gönderimi |
| POST | `/api/v1/auth/verify-otp` | Kod doğrulama → token |
| POST | `/api/v1/auth/resend-otp` | Kodu yeniden gönder |
| GET | `/api/v1/auth/session` | Token doğrulama |

**Akış:** şifre → OTP meydan okuması → kod → HMAC imzalı oturum tokenı (12 saat).

**Demo kipi:** n8n/Telegram yapılandırılmamışken ve `APP_ENV != production` iken
OTP yanıtta `dev_otp` alanında döner. Demo kullanıcı: `.env` → `AUTH_DEMO_USER` /
`AUTH_DEMO_PASSWORD` (varsayılan `admin` / `pixtool`).

> 3 yanlış kodda meydan okuma kapanır → arayüz ceza ekranını açar (2 dk).

---

## Script kütüphanesi

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/v1/scripts` | Kütüphaneyi listeler (18 script, 13 kategori) |
| GET | `/api/v1/scripts/{id}` | Script içeriği |
| POST | `/api/v1/scripts/{id}/run` | Çalıştırma (politika uygulanır) |

Kütüphane kökü: `<proje>/scripts_library/` · Desteklenen: `.ps1`, `.py`, `.sh`

**Metadata çıkarımı:** PowerShell `.SYNOPSIS` / `.DESCRIPTION` / `.AUTHOR` /
`.VERSION` blokları ayrıştırılır. Kategori dosya adı önekinden belirlenir
(`PixNet` → Ağ, `PixSecure` → Güvenlik, …).

**Güvenlik:** `{id}` içinde `/`, `\` veya `..` varsa **reddedilir** (yol geçişi engeli).
Ayrıca dosyanın gerçekten kütüphane kökü içinde olduğu doğrulanır.

**Politika:**
```
confirm    → status: "awaiting_confirmation"  (arayüz onay ister)
whitelist  → izinli liste dışındaysa 403
allow_all  → doğrudan
```

---

## Uzak erişim (SSH / SFTP)

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/v1/remote/status` | paramiko + yapılandırma durumu |
| POST | `/api/v1/remote/exec` | Uzak komut çalıştır |
| POST | `/api/v1/remote/list` | Dizin listele (salt okunur) |
| POST | `/api/v1/remote/info` | Sistem bilgisi (salt okunur) |

**Hedef çözümleme önceliği:** istek gövdesi → `.env` varsayılanları
(`SSH_DEFAULT_HOST`, `SSH_DEFAULT_USER`, `SSH_DEFAULT_PORT`, `SSH_DEFAULT_PASSWORD`).

**Güvenlik:**
- Parolalar **asla loglanmaz**
- Her işlem `<api>/logs/ssh-audit.jsonl` dosyasına yazılır (denetim izi)
- `confirm` politikasında `/exec` **403** döner; arayüz onay ister

**Örnek — `/api/v1/remote/info` yanıtı (gerçek sunucu):**
```json
{
  "ok": true,
  "hostname": "omercataloglu.com",
  "os": "Debian GNU/Linux 12 (bookworm)",
  "kernel": "6.1.0-52-amd64",
  "uptime": "up 2 weeks, 6 days",
  "cpu_cores": 3,
  "memory_total_mb": 3914,
  "memory_used_mb": 2166,
  "disk_total_gb": 40.0,
  "disk_used_gb": 24.0
}
```

---

## Cihaz raporu

| Yöntem | Yol | Açıklama |
|---|---|---|
| POST | `/api/v1/devices/report` | Makine raporunu kaydet |
| GET | `/api/v1/devices` | Kayıtlı raporları listele |

Hedef: NocoDB (yapılandırılmışsa) veya yerel `data/device-reports.jsonl`.
NocoDB yazımı başarısız olursa **otomatik yerel yedeğe** düşer.

`device_id`: platform + ekran + çekirdek + GPU + saat dilimi karışımı.
Sayfa yükleme süresi gibi geçici alanlar kimliği **etkilemez**.

---

## Hata biçimi

```json
{ "detail": "Açıklama" }
```

| Kod | Anlam |
|---|---|
| 401 | Kimlik bilgisi hatalı |
| 403 | Komut politikası engelledi |
| 404 | Kaynak bulunamadı |
| 422 | İstek gövdesi geçersiz |
| 502 | SSH bağlantı/komut hatası |

---

## Test

```bash
cd services/api
.venv\Scripts\python.exe -m pytest -v
```

**60 test:** sağlık (5) · kimlik (21) · cihaz (9) · script (25)
