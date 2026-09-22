# Özelleştirme Sistemi

> **İlke:** Kullanıcı **her şeyi** özelleştirebilir. Kodda sabit varsayım yoktur;
> davranışlar ayarlara bağlıdır. Ayarlar menüsü kalabalıklaşabilir — bu bilinçli bir tercih.

---

## 1. Ayar katmanları

```
①  defaults.ts        → kodda yazılı varsayılanlar
②  localStorage       → kullanıcı ayarları (anında uygulanır, kalıcı)
③  NocoDB `settings`  → sunucu ayarları (Faz 2, cihazlar arası ortak)
```

**Öncelik:** kullanıcı (②) > sunucu (③) > varsayılan (①)

**Şema evrimi:** Ayarlar `version` alanı taşır. Uygulama yeni bir alan kazandığında
eski kayıt `mergeDeep` ile varsayılanlarla birleştirilir → **kullanıcı ayarları kaybolmaz**.
(Kanıt: `src/settings/merge.test.ts` — 13 test)

---

## 2. Klasör yapısı

```
apps/web/src/
├── settings/                  # Ayar çekirdeği
│   ├── types.ts                  PixSettings şeması (tüm ayarlar)
│   ├── defaults.ts               Onaylanan kararlar varsayılan olarak
│   ├── registry.ts               Seçenek listeleri (Settings UI bunlardan üretir)
│   ├── merge.ts                  Derin birleştirme (şema evrimi)
│   ├── merge.test.ts             13 test
│   ├── store.ts                  zustand + persist (localStorage)
│   └── index.ts                  useSettings(), useAppearance() kancaları
│
├── theme/                     # Tema motoru
│   ├── useThemeSync.ts           Ayar → DOM (<html data-theme>)
│   ├── ThemeBackdrop.tsx         Duvar kağıdı katmanı
│   └── ThemeBackdrop.css
│
├── styles/
│   ├── tokens.css                TEMA BLOKLARI: windows / kde / neon
│   └── global.css
│
└── desktop/
    ├── Window.tsx                Yeniden kullanılabilir pencere çerçevesi
    ├── Desktop.tsx               Masaüstü kabuğu + görev çubuğu
    ├── StatusWindow.tsx          Bağlantı durumu
    └── SettingsWindow.tsx        Ayarlar ekranı (7 bölüm)
```

---

## 3. Tema motoru

Tema geçişi **JS ile stil yazmadan**, saf CSS ile olur (hızlı, bakımı kolay):

```html
<html data-theme="windows">   <!-- veya kde / neon -->
```

```css
:root, [data-theme="neon"] { --bg-void: #05070a; --accent: #00ff9c; ... }
[data-theme="windows"]     { --bg-void: #0f0f0f; --accent: #60cdff; ... }
[data-theme="kde"]         { --bg-void: #111315; --accent: #3daee9; ... }
```

**Semantik tokenlar** temaya göre değişir: `--bg-*`, `--text-*`, `--accent`,
`--border-*`, `--radius-*`, `--font-*`, `--shadow-window`

**Sabit kalanlar:** `--neon-*` paleti (boot ekranı her temada yeşil terminal kalır),
`--space-*` ölçeği, hareket süreleri.

### Yeni tema eklemek
1. `tokens.css` içine `[data-theme="yeniTema"] { ... }` bloğu
2. `types.ts` → `ThemeId` birleşimine ekle
3. `registry.ts` → `THEME_OPTIONS` listesine ekle
→ Ayarlar ekranında otomatik görünür.

---

## 4. İçerik yerleştirme haritası

Kullanıcının beğendiği tasarımların nereye entegre edileceği.

| İçerik | Yerleştirileceği yer | Ayar anahtarı |
|---|---|---|
| **Login Form Lamp** 🔵 | Login — **varsayılan** | `login.form = "lamp"` |
| Animated Login Form | Login (seçenek) | `login.form = "animated"` |
| Animated Border Login Form | Login (seçenek) | `login.form = "animatedBorder"` |
| Panda Login Form | Login (seçenek) | `login.form = "panda"` |
| Panda Login Page | Login (seçenek) | `login.form = "pandaPage"` |
| Yeti Login Form Animation | Login (seçenek) | `login.form = "yeti"` |
| **100 şaka** (v5 `jokes.json`) | Her login formunun **temasına uygun**, rastgele | `login.jokes.*` |
| **Telegram OTP** | Login → OTP adımı (temaya uygun) | `login.otp.*` |
| **Impossible Light Bulb** 💡 | 3×yanlış OTP → 2 dk ceza ekranı | `login.punishment.*` |
| **Spider Clock** 🕷️ | 🔵 Varsayılan duvar kağıdı (sistem saati) | `appearance.wallpaper.kind` |
| Spider Cursor | Cursor seçeneği | `appearance.cursor.kind` |
| Reptile Interactive Cursor | Cursor seçeneği | `appearance.cursor.kind` |
| **Animated Logout** | Kapatma düğmesi | `power.animatedShutdown` |
| **Interactive Deadline** | Belirli süreli ilerleme çubukları | `loading.progressBarStyle` |
| **bg.gif** 🖼️ | Belirsiz bekleme perdesi + açılış splash'ı | `loading.waitingCurtain` |
| **Pixel Bat** 🦇 | Boşta ekranı + panik/kilit ekranı + duvar kağıdı | `idle.screen` |

### İki belirsiz içeriğin gerekçesi

**🦇 Pixel Bat → Boşta ekranı + Panik ekranı**
Yarasalar karanlıkta uçar; hem görsel olarak temaya uyar hem de v5'teki
`ui/panic_screen.py` (213 satır) işlevini geri getirir.

**🖼️ bg.gif → Belirsiz bekleme perdesi**
Temiz iş bölümü:

| Durum | Kullanılan |
|---|---|
| **Belirli süreli** ilerleme (kopyalama, indirme) | Interactive Deadline |
| **Belirsiz** bekleme (bağlanılıyor, senkronize, taranıyor) | bg.gif |

İkisi çakışmaz: Deadline "ne kadar kaldı belli", bg.gif "bekle, biliyorum".

---

## 5. Akış yapılandırması

Onaylanan akış: **Giriş → Konsol → Boot → Masaüstü**

Ancak sıra **değiştirilebilir** (Ayarlar → Açılış Akışı → yukarı/aşağı taşı).

```
flow.order = ["login", "console", "boot", "desktop"]
```

### "Her şeyi ekrana bas" anahtarı

```
consoleVerbosity = "everything"  → makinenin tüm bilgisi akar
                 = "summary"     → yalnızca önemli satırlar
                 = "off"         → hiçbir şey akmaz, sessizce boot edilip masaüstü açılır
```

`off` seçildiğinde **kimse rahatsız olmaz** (kullanıcı isteği).

---

## 6. Referans klasörü

```
pixtool-next/
├── _referans/                     ← orijinaller (GIT'E GİRMEZ)
│   └── hosuma-giden-icerikler/      33 dosya, 1.8 MB ham demo
│
└── apps/web/src/                  ← PORT EDİLMİŞ React kodu (repoda bu olur)
```

**Neden:** Ham demolar 3. parti kod. Repoda yalnızca **bizim yazdığımız** kod bulunur.
`_referans/` yalnızca bakmak/kıyaslamak için saklanır.

---

## 7. Varlıklar (assets)

```
apps/web/public/
└── audio/
    └── bulb/                     ← The Impossible Light Bulb sesleri (yerel)
        ├── bear-groan-long.mp3      21 KB
        ├── bear-groan-short.mp3      9 KB
        ├── door-open.mp3            10 KB
        ├── door-close.mp3            9 KB
        └── click.mp3                 2 KB
```

> ⚠️ Bu sesler aslında CodePen CDN'inden yükleniyordu. **Kendi sunucumuzda
> barındırıyoruz** — dış bağımlılık yok.

---

## 8. Bilinen riskler

| # | Risk | Durum |
|---|---|---|
| 1 | Impossible Light Bulb **MorphSVGPlugin** (GSAP Club — ücretli) kullanıyor | 🟡 Port ederken GSAP core + CSS ile yeniden yazmayı deneyeceğiz; olmazsa konuşulur |
| 2 | Login formları Google Fonts CDN'inden yüklüyor (`Inter`, `Poppins`, `Source Sans Pro`) | 🟡 Kendi sunucumuzda barındırmak önerilir |
| 3 | bg.gif 1.3 MB | 🟢 Yerel olduğu için sorun değil; gerekirse optimize edilir |
