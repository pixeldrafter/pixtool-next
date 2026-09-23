# Canlı Kurulum (Deployment)

> **Canlı adres:** https://pixtool.omercataloglu.com
> **Sunucu:** `213.142.148.38` (Debian 12, Yunohost 12, 3 çekirdek / 4 GB RAM / 40 GB disk)

---

## Mimari

```
                     [ Yunohost sunucusu ]
  ┌──────────────────────────────────────────────────────────┐
  │  nginx (Yunohost yönetir)                                │
  │    ├── /            → /opt/pixtool/web   (statik React)  │
  │    └── /api/        → 127.0.0.1:8000     (FastAPI)       │
  │                                                          │
  │  systemd: pixtool-api.service   (uvicorn, TEK işçi)      │
  │  sertifika: Let's Encrypt (otomatik yenilenir)           │
  └──────────────────────────────────────────────────────────┘
```

## Sunucu yerleşimi

```
/opt/pixtool/
├── api/                   FastAPI uygulaması
│   ├── app/                 kaynak kod
│   ├── .venv/               Python sanal ortamı
│   ├── .env                 üretim ayarları (chmod 600)
│   ├── logs/                SSH denetim kaydı (ssh-audit.jsonl)
│   └── data/                yerel cihaz raporları
├── web/                   üretim arayüzü (React derlemesi)
├── scripts_library/       18 PowerShell scripti
└── docs/
```

## Yapılandırılan bileşenler

| Bileşen | Dosya / Konum |
|---|---|
| **Domain** | `yunohost domain add pixtool.omercataloglu.com` |
| **Sertifika** | `yunohost domain cert install` → Let's Encrypt |
| **Servis** | `/etc/systemd/system/pixtool-api.service` |
| **nginx** | `/etc/nginx/conf.d/pixtool.omercataloglu.com.d/pixtool.conf` |
| **SSO** | `/etc/ssowat/conf.json.persistent` |

---

## ⚠️ Kritik: TEK İŞÇİ (workers=1)

OTP meydan okumaları **bellekte** tutulur. `--workers 2` ile:

```
İstek 1 → İşçi A  → challenge oluşturulur
İstek 2 → İşçi B  → challenge BULUNAMAZ  ← hata
```

Bu yüzden servis **tek işçiyle** çalışır. Ölçeklenmek gerekirse ortak depo
(Redis) eklenmeli.

---

## Servis yönetimi

```bash
# Durum
systemctl status pixtool-api

# Yeniden başlat
systemctl restart pixtool-api

# Günlükler (canlı)
journalctl -u pixtool-api -f

# nginx
nginx -t && systemctl reload nginx
```

## Güncelleme (yeni sürüm yayınlama)

```bash
# 1. Yerel: arayüzü derle
pnpm --filter @pixtool/web build

# 2. Dosyaları yükle (psftp/scp)
#    apps/web/dist/*      → /opt/pixtool/web/
#    services/api/app/*   → /opt/pixtool/api/app/

# 3. Servisi yeniden başlat
systemctl restart pixtool-api
```

## Yedekleme

```bash
# Ayarlar ve veriler
tar -czf pixtool-backup.tar.gz /opt/pixtool/api/.env /opt/pixtool/api/data

# Yunohost tarafı
yunohost backup create --apps pixtool --system
```

---

## Bilinen durumlar

| Konu | Durum |
|---|---|
| **App_ENV** | `development` — NocoDB/n8n kurulana kadar **demo giriş** aktif |
| **SSO** | Uygulamanın kendi girişi var; Yunohost SSO devrede değil |
| **NocoDB** | Yapılandırılmadı (token bekliyor) |
| **n8n OTP** | Yapılandırılmadı — OTP ekranda gösteriliyor (demo) |
| **Yerel köprü** | Faz 3 — henüz yok |
| **Tauri kabuğu** | Faz 4 — Rust + VS Build Tools gerekir |

### Canlıya geçişte yapılacaklar

1. **NocoDB token'ı gir** → `/opt/pixtool/api/.env` içinde
   `NOCODB_BASE_URL` + `NOCODB_API_TOKEN` doldur
2. **n8n + Telegram OTP kur** → gerçek iki adımlı doğrulama
3. **`APP_ENV=production`** yap → demo giriş otomatik kapanır
4. **SSH anahtarı kur** → `SSH_DEFAULT_PASSWORD` kaldırılabilir
5. Servisi yeniden başlat: `systemctl restart pixtool-api`

> ⚠️ 3. adımı yapmadan önce mutlaka NocoDB kullanıcı tablosu kurulmalı —
> yoksa giriş yapılamaz.

---

## Geliştirme araçları

Aynı araçlar canlı siteye karşı da çalışır:

```bash
# Canlı sitede uçtan uca test
PX_DEMO_USER=admin PX_DEMO_PASSWORD=... \
  node tools/e2e-test.mjs --url https://pixtool.omercataloglu.com

# Canlı ekran görüntüsü
node tools/screenshot.mjs --url "https://pixtool.omercataloglu.com/?step=desktop"
```

## Sunucu erişimi

Kimlik bilgileri **proje dışında**:
```
%USERPROFILE%\.ssh\pixtool-server.env
```
(SSH kullanıcı/parola + canlı kurulum sırları: `PX_DEMO_PASSWORD`,
`PX_API_SECRET_KEY`)
