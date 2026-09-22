# Yol Haritası

## Faz 0 — İskelet & temel altyapı ← **Neredeyse tamam**

- [x] Proje klasörü + araç zinciri (Git 2.55, pnpm 12.5, Node 25, Python 3.14)
- [x] Kök dosyalar: `README`, `AGENTS`, `.gitignore`, `.gitattributes`, `.env.example`, workspace
- [x] Dokümanlar (KARARLAR, MIMARI, YOL-HARITASI, HASAT, ACIK-KONULAR)
- [x] `git init` + ilk commit (`main`, 37 dosya)
- [x] **Backend:** FastAPI iskeleti + `/health` + `.env` okuma (pydantic-settings)
- [x] **Backend:** NocoDB adapter + bağlantı testi + şablon-adres tespiti
- [x] **Backend:** 5 duman testi (pytest) — hepsi geçti
- [x] **Arayüz:** React 19 + Vite 7 + TS strict + tasarım tokenları
- [x] **Arayüz:** Boot ekranı (5 faz, konsol dizisi) + masaüstü kabuğu
- [x] **Arayüz:** API istemcisi + Vite proxy (CORS'suz erişim doğrulandı)
- [x] **Arayüz:** tip kontrolü + üretim derlemesi temiz (35 modül, 234 KB)
- [x] Sırların git dışı tutulması doğrulandı (`.env`, `.venv`, `node_modules`, `dist`)
- [ ] **`.env` gerçek değerlerle doldurulması** ← *kullanıcı bekleniyor*
- [ ] **NocoDB API token + base id** ← *kullanıcı bekleniyor*
- [ ] NocoDB tablo şeması kurulumu (`tools/bootstrap_nocodb.py` hasadı)
- [ ] Kritik tuzağın doğrulanması (köprü ↔ tarayıcı)

### Doğrulanan sonuçlar

| Ölçüm | Sonuç |
|---|---|
| Backend `/health` | ✅ 846 ms'de ayakta |
| Arayüz (Vite) | ✅ 326 ms'de hazır |
| Vite proxy → `/api/v1/status` | ✅ HTTP 200 |
| Boot ekranı | ✅ 5 faz oynuyor |
| Backend testleri | ✅ 5 passed |
| Tip kontrolü | ✅ temiz |
| Üretim derlemesi | ✅ 35 modül · 234 KB JS · 7,8 KB CSS |
| `.env` git durumu | ✅ takip edilmiyor |

> **Not:** NocoDB henüz **şablon adreste** (`nocodb.SENIN-DOMAININ.com`) olduğu için
> sistem onu "bağlı değil" olarak raporluyor — bu **beklenen** davranış.
> Ekran yanıltıcı şekilde yeşil göstermiyor; şablon değeri ayrıca uyarı olarak listeliyor.

---

## Faz 0 açık işler (kullanıcı bekleniyor)

1. `.env` içine **gerçek sunucu adresleri** — NocoDB / n8n / Telegram şu an `senin-domainin.com` şablonu
2. NocoDB **API token** + **base id**
3. Ardından: tablo şeması kurulumu + gerçek bağlantı testi

---

## Faz 1'e geçmeden alınacak kararlar

1. **Login animasyon örnekleri** — kullanıcı dosya olarak verecek (karar #7)
2. **TailwindCSS + shadcn/ui** kurulumu — Faz 0'da özel CSS tokenları kullanıldı
   (boot ve masaüstü ekranları zaten tamamen özel stilli); form/tablo ekranları için
   UI kütüphanesi Faz 2'de eklenecek
3. **Framer Motion** — pencere animasyonları
4. **Tema setleri:** Windows (Fluent) + KDE (Breeze) token grupları

---

## Faz 1 — OS kabuğu & login

### Adım A2 — Cursor, duvar kağıdı, boşta ekranı ← **TAMAMLANDI**

- [x] **Örümcek imleci** — 8 bacaklı, yürüme döngüsü, ağ izi (canvas, bağımlılıksız)
- [x] **Sürüngen imleci** — halkalı gövde, etkileşimli (arayüz öğelerine ilgi gösterir), dil/blink
- [x] **Spider Clock** — sistem saatine bağlı analog saat + kadranda yürüyen örümcek
- [x] **Pixel Bat** — box-shadow piksel sanatı, 6 yarasa, ay atmosferi
- [x] **Boşta ekranı** — hareketsizlik takibi, seçilebilir ekran (Pixel Bat / Spider Clock / siyah)

### Adım B — Login sistemi ← **TAMAMLANDI**

- [x] **6 form portu** — Lamp (varsayılan), Animated, Animated Border, Panda, Panda Page, Yeti
- [x] **Login kayıt defteri** — yeni form eklemek 5 adım
- [x] **Form teması** — her form kendi rengi/fontu/animasyon karakteri/OTP biçimi/şaka biçimi
- [x] **100 şaka** — v5'ten devralındı, forma göre temalı sunum, rastgele döner
- [x] **OTP adımı** — 5 görsel varyant (boxes / underline / glow / paws / snow)
- [x] **Ceza ekranı** — Impossible Light Bulb, 2 dk geri sayım, çekilebilir ip, yerel sesler
- [x] **Backend kimlik doğrulama** — OTP meydan okuması, HMAC token, demo kipi (21 test)

### Adım C1 — Konsol + akış ← **TAMAMLANDI**

- [x] **Makine envanteri** — gerçek veri: çekirdek, bellek, ekran, GPU (WebGL), ağ, pil, depolama, medya
- [x] **Köprü beklenen alanlar** — sahte veri yok, açıkça işaretli (12 alan)
- [x] **Akış yöneticisi** — `flow.order` ayarına göre dinamik adımlar
- [x] **Konsol kapalı modu** — sessiz açılış (adım atlanır)
- [x] **Rapor kaydetme** — onay sorusu + NocoDB/yerel hedef (9 test)

### Adım C2 — Kabuk ← **KISMEN**

- [x] Sekme tabanlı pencere geçişi + görev çubuğu
- [x] Ayarlar penceresi (7 bölüm)
- [ ] Gerçek pencere yöneticisi (sürükle, boyutlandır, z-sırası)
- [ ] Başlat menüsü + masaüstü ikonları
- [ ] Command Palette (Ctrl+K)

### Adım C3 — Bekleme & kapatma ← **KISMEN**

- [x] **Animasyonlu kapatma** — Animated Logout (figür + kapı + ışık sönmesi)
- [ ] **Interactive Deadline** ilerleme çubukları
- [ ] **bg.gif** bekleme perdesi
- [ ] i18n altyapısı (Türkçe varsayılan)

- [x] **Ayar çekirdeği** — şema (`types.ts`), varsayılanlar, kayıt defteri, zustand + localStorage kalıcılığı
- [x] **Şema evrimi** — `mergeDeep` ile eski kayıtlar bozulmaz (**13 test geçti**)
- [x] **Tema motoru** — Windows / KDE / Neon, saf CSS `[data-theme]` blokları
- [x] **Ayar senkronizasyonu** — `useThemeSync` ayarları DOM'a uygular
- [x] **Duvar kağıdı katmanı** — gradyan / düz / görsel / karartma
- [x] **Ayarlar ekranı** — 7 bölüm, anında uygulanır
- [x] **Açılış akışı düzenleyici** — sıra kullanıcı tarafından değiştirilebilir
- [x] **Yeniden kullanılabilir pencere** bileşeni + görev çubuğu sekme geçişi
- [x] **Referans organizasyonu** — ham demolar `_referans/`'ta (git dışı)
- [x] **Ses varlıkları** — Impossible Light Bulb sesleri yerelleştirildi (5 dosya, 51 KB)
- [ ] Cursor sistemi (Spider, Reptile)
- [ ] Duvar kağıdı: Spider Clock portu
- [ ] Duvar kağıdı: Pixel Bat portu

### Adım B — Login sistemi (sıradaki)

- [ ] Login kayıt defteri + `LoginHost` ortak akış
- [ ] 6 form portu (Lamp varsayılan)
- [ ] 100 şaka — forma göre temalı sunum, rastgele
- [ ] OTP adımı — seçili formun temasıyla
- [ ] Telegram / n8n OTP entegrasyonu
- [ ] Ceza ekranı — 3×yanlış → 2 dk geri sayım + ses

### Adım C — Kabuk & bekleme sistemleri

- [ ] Pencere yöneticisi (sürükle, boyutlandır, küçült, z-sırası)
- [ ] Başlat menüsü + masaüstü ikonları
- [ ] Command Palette (Ctrl+K)
- [ ] Animated Logout → kapatma düğmesi
- [ ] Interactive Deadline → ilerleme çubukları
- [ ] bg.gif → belirsiz bekleme perdesi
- [ ] Pixel Bat → boşta ekranı + panik ekranı
- [ ] i18n altyapısı (Türkçe varsayılan)
- [ ] Erişilebilirlik: klavye gezinme, "hareketi azalt" ✅ *(tema motorunda hazır)*

---

## Faz 2 — Özellikler

- [ ] **Overview** — ECharts grafikleri, sistem durumu
- [ ] **Scripts** — katalog, editör, çalıştırma, çıktı akışı
- [ ] **Files** — SFTP dosya yöneticisi
- [ ] **Terminal** — xterm.js + SSH
- [ ] **Users** — RBAC, izinler
- [ ] **Settings** — tema, politika, bağlantılar
- [ ] **Database** — NocoDB tablo görünümü
- [ ] **Resources** — kaynak yönetimi

---

## Faz 3 — Yerel köprü

- [ ] Köprü servisi (psutil + paramiko), token doğrulaması
- [ ] Sistem bilgisi (CPU / RAM / disk / iç-dış IP)
- [ ] Kurulu programlar + sürümleri (Win: kayıt defteri; Linux: dpkg/rpm)
- [ ] Script çalıştırma + çıktı akışı
- [ ] Boot taraması → NocoDB `devices` tablosu
- [ ] Cihaz kimliği (device_id: anakart / MAC / hostname)
- [ ] Zaafiyet taraması (küçükten: temel kontroller → nmap)
- [ ] Köprü dağıtımı (Tauri'ye gömme / taşınabilir `.exe` / kurulum)

---

## Faz 4 — Platform

- [ ] Masaüstü paketleri: `msi` / `nsis` (Windows), `deb` / `AppImage` (Linux)
- [ ] Mobil uyarlama (PWA, dokunmatik)
- [ ] Tauri updater (masaüstü kabuk güncellemesi)
- [ ] Sunucu dağıtımı (systemd + nginx + HTTPS)

---

## Faz 5 — İleride

- [ ] Agent modeli (karar #9)
- [ ] Ticari kısım: lisanslama, kod imzalama, marka (karar #1)
- [ ] Script versiyonlama / geçmiş
- [ ] Gelişmiş zaafiyet taraması (OpenVAS / Nessus)
