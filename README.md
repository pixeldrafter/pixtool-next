# Pixtool Next

Uzak sistem yönetim paneli — **online**, işletim sistemi gibi görünen, web + mobil + masaüstü hedefli.

> Bu klasör **yeni çalışmanın** deposudur. Eski kod tabanları (`Pixtool Global v6`,
> `PixtoolDesktopDemo`, `Pixtool Global Gemini Pro v5`) buradan **ayrıdır**; yalnızca
> referans ve hasat kaynağı olarak kullanılır. Bkz. `docs/HASAT.md`.

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
| Arayüz | React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui |
| Animasyon | Framer Motion |
| Terminal | xterm.js |
| Grafikler | ECharts |
| OS kabuğu | Kendi pencere yöneticisi (react-rnd + zustand) |
| Backend | FastAPI (Python 3.12+) + Pydantic v2 |
| Veri | NocoDB (REST adapter) |
| Yerel köprü | Python (psutil + paramiko) |
| Masaüstü kabuk | Tauri 2 (Win10/11 + Linux) |
| Paket yöneticisi | pnpm (workspace) |
| Test | pytest · vitest · Playwright |

---

## Klasör yapısı

```
pixtool-next/
├── apps/
│   ├── web/              # React arayüzü
│   └── desktop/          # Tauri kabuğu (sonraki faz)
├── services/
│   ├── api/              # FastAPI backend
│   └── bridge/           # Yerel köprü (Faz 3)
├── packages/
│   └── shared/           # Paylaşılan tipler / sabitler
├── docs/                 # Kararlar, mimari, yol haritası, hasat planı
└── scripts/              # Geliştirme yardımcı scriptleri
```

---

## Hızlı başlangıç

### Gereksinimler

- **Node.js** 22+ (mevcut: v25) ve **pnpm**
- **Python** 3.12+ (mevcut: 3.14)
- **Git**
- *(Sonraki faz)* Rust + Visual Studio C++ Build Tools → Tauri için

### Kurulum

```bash
# Bağımlılıklar
pnpm install

# Ortam dosyası
cp .env.example .env
# .env içini doldur (NocoDB, n8n, SSH ...)

# Backend
cd services/api
python -m venv .venv
.venv/Scripts/activate      # Windows
pip install -r requirements.txt
```

### Çalıştırma

```bash
# Backend (http://127.0.0.1:8000)
pnpm dev:api

# Arayüz (http://127.0.0.1:5173)
pnpm dev:web
```

### Sağlık kontrolü

```bash
curl http://127.0.0.1:8000/health
```

---

## Dokümanlar

| Dosya | İçerik |
|---|---|
| `docs/KARARLAR.md` | Alınan kilitli kararlar (18 madde) |
| `docs/MIMARI.md` | Mimari detayı ve gerekçeler |
| `docs/YOL-HARITASI.md` | Faz 0-5 planı |
| `docs/HASAT.md` | Eski kod tabanlarından neyin taşınacağı |
| `docs/ACIK-KONULAR.md` | Sonradan netleşecek, bloklamayan konular |

---

## Durum

**Faz 0** — iskelet & temel altyapı. Ayrıntı: `docs/YOL-HARITASI.md`

## Lisans

Kişisel proje. Ticari kısım (lisans / imzalama / marka) **askıda**.
