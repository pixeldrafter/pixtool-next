# Dağıtım ve Güncelleme

Pixtool **iki katmandır** ve güncelleme sıklıkları çok farklıdır. Bu yüzden
her aşama için yeniden derleme **gerekmez**.

| Katman | Ne | Ne sıklıkla değişir | Nasıl güncellenir | Süre |
|---|---|---|---|---|
| **web** | React arayüzü | Her geliştirmede | `node tools/deploy.mjs web` | ~10 sn |
| **api** | FastAPI backend | Backend değişince | `node tools/deploy.mjs api` | ~15 sn |
| **scripts** | Script kütüphanesi | Script eklenince | `node tools/deploy.mjs scripts` | ~5 sn |
| **shell** | Tauri exe + köprü | **Nadir** | `node tools/deploy.mjs shell` | ~3 dk |

---

## Neden arayüz için yeniden derleme yok?

Masaüstü kabuğu (Tauri) açılışta **sunucuyu yoklar**:

```
Kabuk başlar
   ↓
Sunucu erişilebilir mi?  ──── evet ──→  UZAK arayüz yüklenir
   │                                     (sunucudan, her zaman güncel)
   └──── hayır ──→  GÖMÜLÜ kopya yüklenir
                     (çevrimdışı yedek)
```

Böylece:
- Arayüz değişikliği → sunucuya kopyala → **uygulamayı yeniden aç, yeter**
- Yalnızca **kabuk** (Rust kodu, pencere davranışı, köprü exe'si) değişirse derleme gerekir

**Örnek akış:**

```bash
# 1) Arayüzde buton rengini değiştirdin
pnpm build
node tools/deploy.mjs web
# → Bitti. Masaüstü uygulamasını yeniden aç, yeni renk orada. (10 saniye)

# 2) Yeni bir araç ekledin (arayüz)
pnpm build && node tools/deploy.mjs web
# → Bitti.

# 3) Köprüye yeni bir toplayıcı ekledin (Python)
pnpm build:bridge          # exe'yi üret
node tools/deploy.mjs bridge shell
# → Derleme gerekli (kabuk binary'si değişti)

# 4) Pencere çerçevesini değiştirdin (Rust)
node tools/deploy.mjs shell
# → Derleme gerekli
```

---

## Komutlar

```bash
node tools/deploy.mjs --check          # canlı durumu göster (dağıtım yapmaz)
node tools/deploy.mjs web              # sadece arayüz
node tools/deploy.mjs api web          # ikisi birden
node tools/deploy.mjs all              # web + api + scripts (+ shell)
node tools/deploy.mjs scripts          # script kütüphanesi
node tools/deploy.mjs shell            # kabuk derle + yayınla
node tools/deploy.mjs shell --notes "Ne değişti"   # sürüm notu ile
```

Dağıtım sonrası **canlı durum otomatik gösterilir**:

```
Canlı durum
  web JS    : assets/index-BcWnAJyT.js
  api       : active
  surum ucu : 200
  http      : 200
  scriptler : 20
  kurulumlar: 1
```

---

## Güncelleme kanalı: **kendi sunucumuz**

```
https://pixtool.omercataloglu.com/api/v1/app/version
https://pixtool.omercataloglu.com/api/v1/app/download
```

Sunucuda:

```
/opt/pixtool/releases/
    shell.json                          → { version, notes, released }
    Pixtool Next_1.0.0_x64-setup.exe    → kurulum paketi
```

### Neden GitHub değil?

| | Kendi sunucu | GitHub Releases |
|---|---|---|
| Kurulum | ✅ Zaten var | Repo + token gerekir |
| Gizlilik | ✅ Özel kalır | Public repo = herkes görür |
| Kontrol | ✅ Tam | GitHub politikalarına bağlı |
| CDN | ⚠️ Tek sunucu | ✅ Global CDN |
| Sürüm yönetimi | ⚠️ Elle | ✅ Etiketler, notlar |

**Karar: kendi sunucu.** Proje özel ve tek kullanıcılı; sunucu zaten var.
GitHub yalnızca şu durumlarda mantıklı olur: açık kaynak yapmak, çok sayıda
kullanıcıya dağıtmak veya indirme trafiğini CDN'e taşımak.

---

## Uygulama içi güncelleme bildirimi

Arayüz açılışta `/api/v1/app/version` ucunu okur. **Kabuk sürümü** daha
yeniyse sağ üstte bildirim çıkar:

```
⬆ Yeni sürüm var: 1.1.0  (kurulu 1.0.0)
   Düzeltmeler ve yeni özellikler
   Pixtool Next_1.1.0_x64-setup.exe · 18.2 MB
   [⬇ İndir]  [⟳]  [✕]
```

- Bildirim **6 saatte bir** ve her açılışta kontrol edilir
- İndirme sunucudan gelir (GitHub'a gerek yok)
- `✕` ile o oturum için gizlenir
- Zorunlu güncellemeler `shell.json` içinde `"mandatory": true` ile işaretlenir

---

## Kabuk sürümünü yayınlama

```bash
# 1) Sürümü yükselt
#    apps/desktop/package.json     → "version": "1.1.0"
#    apps/desktop/src-tauri/tauri.conf.json → "version": "1.1.0"
#    apps/desktop/src-tauri/Cargo.toml      → version = "1.1.0"

# 2) Derle ve yayınla
node tools/deploy.mjs shell --notes "1.1.0 — tarayıcı sekmesi, dosya arama"

# 3) Doğrula
node tools/deploy.mjs --check
```

Kurulum paketi sunucuya yüklenir ve `/api/v1/app/download` üzerinden
yayınlanır. Kullanıcıların uygulaması bir sonraki açılışta bildirimi görür.

---

## Arayüzün hangi sunucudan yükleneceğini değiştirme

Kabuk varsayılan olarak `https://pixtool.omercataloglu.com` adresini kullanır.
Farklı bir adres için ortam değişkeni:

```powershell
# Geliştirme sırasında yerel Vite sunucusunu kullan
$env:PIXTOOL_UI_URL = "http://localhost:5173"
pnpm dev:desktop
```

Kod: `apps/desktop/src-tauri/src/lib.rs` → `ui_remote_url()`

---

## Sorun giderme

**Arayüz güncellenmedi**
```bash
node tools/deploy.mjs --check      # canlı JS hash'ini gör
# Masaüstü uygulamasında: Ctrl+R veya pencereyi kapat-aç
```

**Uygulama eski arayüzü gösteriyor**
- Sunucu erişilemezse gömülü kopya yüklenir (çevrimdışı yedek)
- İnternet bağlantısını kontrol et, `--check` ile sunucuyu doğrula

**Derleme `cargo not found` diyor**
- Rust kurulu mu: `winget install Rustlang.Rustup`
- `deploy.mjs` cargo'yu `%USERPROFILE%\.cargo\bin` altında arar

**Kurulum indirilemiyor (404)**
- `releases` katmanını dağıt: `node tools/deploy.mjs releases`
- Sunucuda dosya var mı: `/opt/pixtool/releases/`
