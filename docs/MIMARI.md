# Mimari

## Bütün resim

```
                      [ SUNUCU — internete açık ]
   ┌──────────────────────────────────────────────────────────────┐
   │  Web Arayüzü (React, statik)   → tarayıcı / mobil / desktop   │
   │  Backend API (FastAPI, Python) → iş mantığı, auth, orkestra   │
   │  n8n    → login / OTP / Telegram otomasyonu                   │
   │  NocoDB → TÜM VERİ (kullanıcı, cihaz, script, kaynak, log)    │
   └──────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  [Masaüstü Win10/11]     [Linux]              [Mobil]
   Tauri kabuğu            Tauri veya          Tarayıcı / PWA
   veya tarayıcı           tarayıcı
        │
        ▼
  [ PIXTOOL BRIDGE ]  ← localhost'ta küçük Python servisi
   • Yerel sistem bilgisi (CPU / RAM / disk / iç-dış IP)
   • Kurulu programlar + sürümleri
   • Script / komut çalıştırma + çıktı akışı
   • Boot taraması → sonucu API'ye / NocoDB'ye gönderir
```

## Neden bu mimari?

| Karar | Gerekçe |
|---|---|
| **Online** | Her cihazdan erişim; telefon dahil. Veri tek yerde. |
| **Yerel köprü** | Tarayıcı sistem bilgisi okuyamaz, script çalıştıramaz. Köprü bu boşluğu doldurur. |
| **NocoDB tek kaynak** | Senkron / çakışma derdi yok. Kullanıcı arayüzünden tablo yönetimi. |
| **FastAPI** | Python ekosistemi (paramiko, psutil) + otomatik OpenAPI → TS tip üretimi. |
| **React** | Web + mobil + masaüstü tek kod tabanı. Modern UI ekosistemi. |
| **Tauri** | Sistem webview'i, ~10-15 MB, az RAM. Electron'un ~180 MB'ına gerek yok. |

---

## Katmanlar

### 1. Arayüz — `apps/web`
React 19 + TypeScript + Vite. Kendi **pencere yöneticisi** ile işletim sistemi görünümü:
masaüstü, görev çubuğu, başlat menüsü, sürüklenebilir pencereler.

> **İş mantığı burada YOK.** Yalnızca API çağrısı + durum yönetimi.

### 2. Backend — `services/api`
FastAPI. Auth, orkestrasyon, NocoDB erişimi, SSH, script yürütme.

```
services/api/app/
├── main.py             # uygulama girişi, /health
├── core/
│   ├── config.py       # .env okuma (pydantic-settings)
│   └── security.py     # JWT, şifre hash
├── integrations/
│   ├── nocodb.py       # NocoDB REST adapter  ← TEK erişim noktası
│   ├── ssh.py          # uzak komut / dosya
│   └── n8n.py          # webhook tetikleme
├── models/             # Pydantic modelleri
└── routers/            # endpoint grupları
```

### 3. Yerel köprü — `services/bridge` (Faz 3)
`localhost`'ta çalışır, token doğrulaması yapar. Tauri kabuğu tarafından başlatılır.

### 4. Masaüstü kabuk — `apps/desktop` (Faz 4)
Tauri 2. Sistem webview'i kullanır; yerel köprüyü gömüp otomatik açar.

---

## Kritik tuzak: köprü ↔ tarayıcı iletişimi

Online arayüz **HTTPS**, yerel köprü `http://127.0.0.1:8765`. Tarayıcılar HTTPS
sayfadan HTTP localhost'a istekte bulunurken iki kısıt uygular:

1. **Mixed content** — HTTPS sayfa HTTP'ye istek atamaz
2. **Private Network Access** — public → private ağ isteği engellenir

**Sonuç:** Yerel sistem işleri tarayıcıdan **güvenilir şekilde yapılamaz.**

**Çözüm:** Yerel işler **Tauri kabuğundan** yapılır (native, kısıt yok).
Tarayıcı ve mobil yalnızca **uzak özellikleri** kullanır.

→ Faz 0'da doğrulanacak. Bkz. `ACIK-KONULAR.md`.

---

## Veri akışı örneği — script çalıştırma

```
1. Kullanıcı arayüzden "çalıştır" der
2. Arayüz → POST /api/scripts/{id}/run   (backend'e)
3. Backend → NocoDB'den script metnini çeker
4. Backend → politikayı uygular (confirm / whitelist / allow_all)
5. Hedef seçilir:
   a. Uzak sunucu   → backend SSH ile çalıştırır
   b. Yerel makine  → backend köprüye iletir; köprü çalıştırır
6. Çıktı akışı (WebSocket) → arayüzde terminal benzeri gösterim
7. Sonuç → NocoDB `logs` tablosuna yazılır
```

---

## Güvenlik ilkeleri

- Sırlar yalnızca `.env` — repoda **hiçbir** gerçek anahtar yok
- Komut politikası varsayılan `confirm`
- Köprü token doğrulaması yapar (yoksa herhangi bir web sitesi çağırabilir)
- JWT oturum + OTP ikinci faktör
- Eski kod tabanındaki düz metin sırlar **rotate edilecek**
