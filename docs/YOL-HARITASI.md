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

- [ ] Çoklu pencere yöneticisi (sürükle, boyutlandır, küçült, kapat)
- [ ] Görev çubuğu + başlat menüsü
- [ ] Masaüstü ikonları
- [ ] Tema motoru: **Windows (Fluent)** + **Linux KDE (Breeze)**
- [ ] Command Palette (Ctrl+K)
- [ ] Animasyonlu login + OTP ekranı
- [ ] i18n altyapısı (Türkçe varsayılan)
- [ ] Erişilebilirlik: klavye gezinme, "hareketi azalt"

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
