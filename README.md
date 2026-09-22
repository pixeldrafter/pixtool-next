# Pixtool Next

Uzak sistem yönetim paneli — **online**, işletim sistemi gibi görünen, web + mobil + masaüstü hedefli.

> Bu klasör **yeni çalışmanın** deposudur. Eski kod tabanları (`Pixtool Global v6`,
> `PixtoolDesktopDemo`, `Pixtool Global Gemini Pro v5`) buradan **ayrıdır**; yalnızca
> referans ve hasat kaynağı olarak kullanılır. Bkz. `docs/HASAT.md`.
> Ham demolar `_referans/` altındadır (git dışı).

---

## Ne yapıyor?

Tarayıcıdan veya masaüstü kabuğundan erişilen, kendini bir **işletim sistemi gibi** sunan
(çoklu pencere, masaüstü, görev çubuğu, önyükleme dizisi) bir uzak sistem yönetim paneli:

- Sunucuya SSH ile bağlanıp komut çalıştırma, dosya yönetimi, terminal
- Yerel makinede script çalıştırma (yerel köprü üzerinden)
- NocoDB üzerinden tüm veri: kullanıcı, cihaz, script, kaynak, log
- Login + OTP (n8n / Telegram)
- Sistem monitörü, ağ araçları, zaafiyet taraması

---

## Açılış akışı

```
Giriş (login + OTP)  →  Konsol (makine envanteri)  →  Boot  →  Masaüstü
```

Sıra **Ayarlar → Açılış Akışı**'ndan değiştirilebilir. Konsol ayrıntı seviyesi
`Kapalı` yapılırsa konsol adımı tamamen atlanır (sessiz açılış — kimseyi rahatsız etmez).

---

## Mimari

```
                    [ SUNUCU — internete açık ]
   ┌──────────────────────────────────────────────────────┐
   │  Web Arayüzü (React, statik)  → tarayıcı / mobil / desktop
   │  Backend API (FastAPI, Python) → iş mantığı, auth, orkestrasyon
   │  n8n     → login / OTP / Telegram otomasyonu
   │  NocoDB  → TÜM VERİ
   └──────────────────────────────────────────────────────┘
                          ▲ HTTPS
        ┌─────────────────┼─────────────────┐
   [Masaüstü Win10/11] [Linux]          [Mobil]
    Tauri kabuğu        Tauri/tarayıcı   Tarayıcı / PWA
        │
        ▼
   [ PIXTOOL BRIDGE ]  ← localhost'ta Python servisi
     sistem bilgisi · kurulu programlar · script çalıştırma · boot taraması
```

Ayrıntı: `docs/MIMARI.md`

---

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Arayüz | React 19 + TypeScript + Vite 7 |
| Stil | Özel CSS + tasarım tokenları (3 tema) |
| Durum | zustand (localStorage kalıcılığı) |
| Backend | FastAPI + Pydantic v2 |
| Veri | NocoDB (REST adapter) |
| Yerel köprü | Python (psutil + paramiko) — Faz 3 |
| Masaüstü kabuk | Tauri 2 — Faz 4 |
| Paket yöneticisi | pnpm (workspace) |
| Test | pytest · vitest |

---

## Klasör yapısı

```
pixtool-next/
├── apps/
│   └── web/                    # React arayüzü
│       └── src/
│           ├── settings/       # Ayar çekirdeği (şema, store, merge)
│           ├── theme/          # Tema motoru (Windows / KDE / Neon)
│           ├── login/          # 6 login formu + OTP + ceza ekranı + şakalar
│           ├── console/        # Makine envanteri konsolu
│           ├── cursor/         # Özel imleçler (örümcek / sürüngen)
│           ├── wallpaper/      # Spider Clock · Pixel Bat
│           ├── idle/           # Boşta kalma ekranı
│           ├── boot/           # Önyükleme animasyonu
│           └── desktop/        # Masaüstü kabuğu + Ayarlar + Kapatma
├── services/
│   └── api/                    # FastAPI backend
│       └── app/
│           ├── core/           # Ayarlar, güvenlik
│           ├── models/         # Pydantic şemaları
│           ├── routers/        # auth, devices
│           ├── services/       # Kimlik doğrulama mantığı
│           └── integrations/   # NocoDB
├── docs/                       # Kararlar, mimari, yol haritası, hasat, özelleştirme, API
├── _referans/                  # Ham demolar (GİT DIŞI)
└── package.json                # workspace kökü
```

---

## Hızlı başlangıç

### Gereksinimler

- **Node.js** 22+ (mevcut: v25) ve **pnpm**
- **Python** 3.12+ (mevcut: 3.14)
- **Git**
- *(Faz 4)* Rust + Visual Studio C++ Build Tools → Tauri için

### Kurulum

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam dosyası
copy .env.example .env      # Windows
# .env içini doldur (NocoDB, n8n, SSH …)

# 3. Backend sanal ortamı
pnpm setup:api
```

### Çalıştırma

```bash
# Backend (http://127.0.0.1:8000)
pnpm dev:api

# Arayüz (http://localhost:5173)
pnpm dev:web
```

OpenAPI arayüzü: <http://127.0.0.1:8000/docs>

---

## İlk giriş (demo kipi)

NocoDB / n8n / Telegram yapılandırılmadan önce sistem **demo kipiyle** çalışır:

| Alan | Değer |
|---|---|
| Kullanıcı adı | `admin` |
| Parola | `pixtool` |
| OTP | Ekranda gösterilir (geliştirme kipi) |

> ⚠️ Demo kipi `APP_ENV=production` iken **otomatik kapanır**. Gerçek kullanımda
> NocoDB + n8n/Telegram entegrasyonu kurulmalıdır.
> `.env` içinde `AUTH_DEMO_USER` / `AUTH_DEMO_PASSWORD` ile değiştirilebilir.

---

## Denenecekler

| Ne | Nerede |
|---|---|
| 🎨 Tema değiştir (Windows / KDE / Neon) | Ayarlar → Görünüm |
| 🔑 Login formu değiştir (6 form) | Ayarlar → Giriş → Login formu |
| 📐 Arayüz ölçeği, duvar kağıdı karartma | Ayarlar → Görünüm |
| 🕷️ Cursor: örümcek / sürüngen | Ayarlar → Görünüm → Cursor |
| 🕷️🦇 Duvar kağıdı: Spider Clock / Pixel Bat | Ayarlar → Görünüm → Arkaplan |
| 💡 Ceza ekranı (lamba + 2 dk geri sayım) | Giriş → OTP'yi 3 kez yanlış gir |
| 😄 Şakalar (100 adet, forma göre temalı) | Giriş ekranında otomatik |
| 🦇 Boşta ekranı | 5 dk hareketsiz kal |
| ⏻ Animasyonlu kapatma | Görev çubuğu → Kapat |
| ▶️ Akış sırasını değiştir | Ayarlar → Açılış Akışı |
| 💾 Ayarları yedekle (JSON) | Ayarlar → en altta |

---

## Kalite

```bash
pnpm typecheck     # TypeScript
pnpm test          # vitest (arayüz)
pnpm test:api      # pytest (backend)
pnpm lint:api      # ruff
pnpm build         # üretim derlemesi
```

Mevcut durum: **35 backend testi**, **13 arayüz testi** — hepsi geçiyor.

---

## Dokümanlar

| Dosya | İçerik |
|---|---|
| `docs/KARARLAR.md` | Alınan kilitli kararlar |
| `docs/MIMARI.md` | Mimari detayı ve gerekçeler |
| `docs/YOL-HARITASI.md` | Faz 0-5 planı ve ilerleme durumu |
| `docs/HASAT.md` | Eski kod tabanlarından neyin taşınacağı |
| `docs/OZELLESTIRME.md` | Özelleştirme sistemi + içerik yerleştirme haritası |
| `docs/API.md` | Backend uç noktaları |
| `docs/ACIK-KONULAR.md` | Sonradan netleşecek, bloklamayan konular |

---

## Durum

**Faz 0 ✓ · Faz 1 büyük ölçüde ✓** — ayrıntı: `docs/YOL-HARITASI.md`

Çalışan: kimlik doğrulama + OTP, ceza ekranı, makine envanteri konsolu,
cihaz raporu kaydı, 3 tema, 6 login formu, 2 özel imleç, 2 animasyonlu duvar
kağıdı, boşta ekranı, animasyonlu kapatma, kapsamlı ayar sistemi.

## Lisans

Kişisel proje. Ticari kısım (lisans / imzalama / marka) **askıda**.
