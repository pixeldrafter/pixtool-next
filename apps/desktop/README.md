# Pixtool Next — Masaüstü Kabuğu (Tauri 2)

Web arayüzünü **native bir pencerede** çalıştırır ve **yerel köprüyü** otomatik
başlatır. Tarayıcı çubuğu yok → gerçek "işletim sistemi" hissi.

---

## Gereksinimler (yalnızca **geliştirme** için)

| Araç | Neden |
|---|---|
| **Rust** (`rustup`) | Tauri çekirdeği |
| **MSVC Build Tools** | Windows'ta bağlayıcı (`link.exe`) |
| **Node 22+ / pnpm** | arayüz derlemesi |
| **Windows SDK** | MSVC ile birlikte gelir |

> **Kullanıcı için gereksinim YOK.** Kurulum dosyası Python, Rust veya Node
> gerektirmez — hepsi paketin içindedir.

---

## Kurulum (geliştirme)

```bash
# 1. Rust (winget ile)
winget install --id Rustlang.Rustup -e

# 2. Bağımlılıklar
pnpm install

# 3. Arayüzü derle (kabuk bunu gömerek çalışır)
pnpm build

# 4. Masaüstü kabuğunu çalıştır (sıcak yenileme)
pnpm dev:desktop
```

---

## Derleme (dağıtım)

```bash
# Köprüyü bağımsız .exe'ye derle (Python gerekmesin)
pnpm build:bridge

# Sidecar'ı yerleştir
cp services/bridge/dist/pixtool-bridge.exe \
   apps/desktop/src-tauri/binaries/pixtool-bridge-x86_64-pc-windows-msvc.exe

# Kurulum dosyasını üret
pnpm build:desktop
```

Çıktı:

```
apps/desktop/src-tauri/target/release/
├── pixtool-desktop.exe              6-7 MB   (uygulama)
├── pixtool-bridge.exe               9 MB     (yerel köprü, sidecar)
└── bundle/nsis/
    └── Pixtool Next_1.0.0_x64-setup.exe  12 MB  ← kullanıcıya verilecek
```

---

## Mimari

```
┌──────────────────────────────────────────────────────────────┐
│  pixtool-desktop.exe  (Tauri · WebView2 = Chromium)          │
│                                                              │
│   ┌────────────────────────┐   ┌───────────────────────────┐ │
│   │  React arayüzü         │   │  Rust çekirdeği           │ │
│   │  (gömülü dist/)        │◄──┤  • pencere kontrolleri    │ │
│   │                        │   │  • köprü yaşam döngüsü    │ │
│   └───────────┬────────────┘   └────────────┬──────────────┘ │
│               │                             │ spawn          │
│               │ fetch 127.0.0.1:8765       ▼                │
│               │                  ┌───────────────────────┐  │
│               └─────────────────►│  pixtool-bridge.exe   │  │
│                                  │  (psutil/PowerShell)  │  │
│                                  └───────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
                               ▼
                  https://pixtool.omercataloglu.com
                  (nginx → FastAPI · NocoDB · n8n)
```

### Neden köprü ayrı bir süreç?

Köprü Python'dur (`psutil` + PowerShell). Rust'ta yeniden yazmak yerine
**sidecar** olarak paketlenir:

- kullanıcı **Python kurmak zorunda kalmaz** (PyInstaller ile derlendi)
- **token Rust tarafında üretilir** → kullanıcı elle girmez
- uygulama kapanınca köprü de kapanır (**ebeveyn bekçisi**)

---

## Önemli teknik kararlar

### 1. Çerçevesiz pencere

```json
{ "decorations": false, "shadow": true }
```

Native başlık çubuğu kapalı — tasarımımız kendi "OS" çubuğunu çiziyor.
`decorations: false` iken Windows 11 yuvarlak köşeleri `shadow: true` ile korunur.

### 2. Çalışma-zamanı API adresi

`lib/api.ts` kökeni algılar:

| Ortam | Köken | API tabanı |
|---|---|---|
| Tarayıcı | `https://pixtool...` | `""` (aynı köken) |
| Tauri | `tauri://localhost` | `https://pixtool.omercataloglu.com` |

Bu sayede **tek derleme** hem webde hem masaüstünde çalışır.

### 3. Köprü neden `127.0.0.1`'den çağrılabiliyor?

HTTPS sayfadan HTTP isteği normalde **mixed content** olarak engellenir. Ancak
`127.0.0.1` ve `localhost` tarayıcılarda **potentially trustworthy origin**
sayılır → engel yok. Ek olarak:

- **CORS**: köprü `OPTIONS` ön kontrolünü yanıtlar
- **Private Network Access**: `Access-Control-Allow-Private-Access: true`

### 4. Ebeveyn bekçisi

PyInstaller `--onefile` **iki süreç** oluşturur (bootloader + gerçek süreç).
Tauri `child.kill()` yalnızca doğrudan çocuğu öldürür → kalıntı olurdu.

Çözüm: Rust kendi PID'ini `--parent-pid` ile geçer, köprü bunu izler ve
ebeveyn kaybolunca `os._exit(0)` ile **tüm zinciri** sonlandırır.

---

## Pencere kontrolleri (Rust → arayüz)

| Komut | Açıklama |
|---|---|
| `window_minimize` | Simge durumuna küçült |
| `window_toggle_maximize` | Büyüt / geri al |
| `window_is_maximized` | Durum sorgula |
| `window_close` | Kapat |
| `window_set_fullscreen` | Tam ekran |
| `window_is_fullscreen` | Tam ekran sorgusu |

Örnek (arayüzden):

```ts
const invoke = (window as any).__TAURI__?.core?.invoke;
await invoke("window_toggle_maximize");
```

## Köprü komutları

| Komut | Açıklama |
|---|---|
| `bridge_start({port?, token?})` | Köprüyü başlat (token üretilir) |
| `bridge_stop()` | Durdur |
| `bridge_status()` | Durum + port + token |

Arayüz `bridge_status`'ü çağırıp köprüyü otomatik bulur —
**kullanıcı token girmez.**

---

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `link.exe not found` | MSVC Build Tools kurun (`winget install Microsoft.VisualStudio.2022.BuildTools`) |
| `tauri: command not found` | `pnpm install` |
| Boş pencere | Önce `pnpm build` (arayüz gömülü gelir) |
| Köprü başlamıyor | `src-tauri/binaries/` içinde sidecar var mı? |
| `protocol-asset` hatası | `tauri.conf.json` → `security.assetProtocol` kaldırılmalı |

---

## Boyutlar

| | |
|---|---|
| Uygulama exe | 6.3 MB |
| Köprü exe | 8.8 MB |
| Kurulum (NSIS, sıkıştırılmış) | 12.1 MB |
| Bellek (boşta) | ~25 MB |
| Derleme süresi (ilk) | ~4 dk |
| Derleme süresi (önbellekli) | ~2.5 dk |
