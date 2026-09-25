# Pixtool Next

Kendini bir **işletim sistemi gibi** sunan, uzak sistem yönetim paneli.
Tarayıcıdan, mobil tarayıcıdan veya masaüstü kabuğundan (Tauri) erişilir;
çoklu pencere, masaüstü, görev çubuğu ve önyükleme dizisi ile gerçek bir
masaüstü deneyimi verir.

> Bu depo **self-hosted** bir kurulum içindir. Tüm veri katmanı NocoDB,
> kimlik doğrulama ve OTP akışı n8n + Telegram üzerinden çalışır.

---

## Özellikler

- **Masaüstü deneyimi:** pencereler, görev çubuğu, başlat menüsü, masaüstü
  kısayolları, yapışkan notlar, donanım widget kartları (CPU/RAM/Disk/Sıcaklık).
- **Yerel köprü (Python):** çalıştırılan makinenin canlı envanteri — anakart,
  BIOS, RAM modülleri, diskler, ağ, sıcaklıklar, kurulu programlar, servisler.
- **Script kütüphanesi:** PowerShell/bash script'lerini seçip çalıştırma.
- **Dosya yöneticisi:** yerel disk (köprü) ve uzak sunucu (SFTP); sürükle-bırak
  ile yükleme/indirme, Windows tarzı arayüz.
- **Kullanıcı yönetimi + paylaşım:** roller, uygulama bazlı yetkiler, kullanıcılar
  arası dosya/not paylaşımı.
- **Kalıcılık:** notlar, masaüstü öğeleri, widget'lar ve ayarlar kullanıcıya özel
  olarak sunucuda saklanır (cihazlar arası taşınır).
- **Snapshot / geri dön:** masaüstünün o anki hâlini kaydet, saniyeler içinde geri yükle.
- **Otomatik güncelleme:** masaüstü kabuğu imzalı güncellemeyi indirip kurar.

---

## Mimari

```
apps/web        React arayüzü (masaüstü + pencereler)
apps/desktop    Tauri masaüstü kabuğu (Rust) + otomatik güncelleme
services/api    FastAPI backend (NocoDB veri katmanı, kimlik, script, paylaşım)
services/bridge Makinede çalışan yerel Python köprüsü (donanım envanteri, dosya, script)
services/n8n    n8n iş akışı örnekleri (OTP / kayıt onayı)
```

Veri akışı: **Arayüz → API → NocoDB** ve **Arayüz → Köprü (localhost) → İşletim sistemi**.

---

## Gereksinimler

- **Node.js** ≥ 22 + **pnpm**
- **Python** ≥ 3.11 (köprü ve API için)
- **NocoDB** (veri katmanı)
- *(Opsiyonel)* **n8n** + **Telegram bot** (OTP ve bildirimler)
- *(Opsiyonel)* **Rust** (masaüstü kabuğunu derlemek için)

---

## Hızlı Başlangıç

```bash
# 1) Ortam değişkenleri
cp .env.example .env
#    .env içini doldur (NocoDB, Telegram, API_SECRET_KEY, …)

# 2) Bağımlılıklar
pnpm install
pnpm setup:api            # Python sanal ortamı + bağımlılıklar

# 3) Backend
pnpm dev:api              # http://127.0.0.1:8000

# 4) Arayüz
pnpm dev:web              # http://localhost:5173
```

### Yerel köprü

```bash
pnpm build:bridge         # tek dosya exe üretir (PyInstaller)
# ya da doğrudan:
cd services/bridge && python pixtool_bridge.py
```

Köprü başlarken bir **token** yazdırır. Arayüz, masaüstü kabuğunda bu token'ı
kabuktan otomatik alır; tarayıcıda Ayarlar → Köprü bölümüne elle girilir.

### Masaüstü kabuk (Tauri)

```bash
pnpm dev:desktop          # geliştirme
pnpm build:desktop        # dağıtım derlemesi
```

---

## Yapılandırma

Tüm ayarlar `.env` dosyasındadır (`.env.example` şablonuna bakın). Öne çıkanlar:

| Anahtar | Açıklama |
|---|---|
| `API_SECRET_KEY` | Oturum tokenı imzalama anahtarı (güçlü bir değer verin) |
| `API_ALLOWED_ORIGINS` | CORS izinli kökenler |
| `NOCODB_BASE_URL` / `NOCODB_API_TOKEN` / `NOCODB_BASE_ID` | NocoDB bağlantısı |
| `NOCODB_TABLE_*` | NocoDB tablo kimlikleri |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | OTP ve bildirimler |
| `BRIDGE_TOKEN` | Yerel köprü erişim tokenı |
| `COMMAND_POLICY` | `confirm` \| `whitelist` \| `allow_all` |

> **Güvenlik:** `.env` asla commit edilmez. Gerçek token/şifreleri yalnızca
> yerel `.env` içinde tutun.

---

## Dağıtım

`tools/deploy.mjs` katmanlı dağıtım sunar (kendi sunucunuz için uyarlayın):

```bash
node tools/deploy.mjs web      # arayüz (anında)
node tools/deploy.mjs api      # backend
node tools/deploy.mjs shell    # masaüstü kabuğu (imzalı kurulum üretir)
node tools/deploy.mjs all
```

Arka uç, systemd servisi (`pixtool-api`) veya Docker ile çalıştırılabilir.
Nginx örnek yapılandırması ve systemd unit'i `docs/` altındadır.

### Otomatik güncelleme

Masaüstü kabuğu, imzalı kurulumu sunucudaki `latest.json` ucundan kontrol eder.
İmzalama anahtarı `tauri signer generate` ile üretilir; private key **repoya
konmaz**. `tauri.conf.json` içindeki `plugins.updater.endpoints` ve `pubkey`
kendi dağıtımınıza göre ayarlanır.

---

## Kişiselleştirme

Bu bir **şablondur**: marka adı, alan adı, logosu ve metinleri kendi
kurulumunuza göre değiştirin. Arayüz metinleri `apps/web/src/i18n/dictionaries.ts`
içinde; görünüm `apps/web/src/settings/` altında; giriş ekranı
`apps/web/src/login/` altındadır.

---

## Lisans

Bu depo, kullandığınız kuruluma göre kendi lisansınızla yayınlanmak üzere
hazırlanmıştır. Üçüncü taraf bileşenlerin lisansları kendi paketlerinde geçerlidir.
