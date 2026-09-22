# Yol Haritası

## Faz 0 — İskelet & temel altyapı ← **ŞU AN BURADAYIZ**

- [x] Proje klasörü + araç zinciri (Git 2.55, pnpm 12.5)
- [x] Kök dosyalar: `README`, `AGENTS`, `.gitignore`, `.env.example`, workspace
- [x] Dokümanlar
- [ ] `git init` + ilk commit
- [ ] **Backend:** FastAPI iskeleti + `/health` + `.env` okuma
- [ ] **Backend:** NocoDB adapter + bağlantı testi
- [ ] **Arayüz:** React + Vite iskeleti + tasarım tokenları
- [ ] **Arayüz:** Boot ekranı portu (`console_ui.py` → web)
- [ ] **Arayüz:** Masaüstü kabuğu iskeleti (masaüstü, görev çubuğu, pencere)
- [ ] `.env` gerçek değerlerle doldurulması
- [ ] Kritik tuzağın doğrulanması (köprü ↔ tarayıcı)

**Çıkış kriteri:** `pnpm dev:api` + `pnpm dev:web` çalışıyor; arayüz backend'e
bağlanıp NocoDB durumunu gösteriyor; boot ekranı akıyor.

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
- [ ] Köprü dağıtımı (Tauri'ye gömme / taşınabilir .exe / kurulum)

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

---

## Faz 0 açık işler (hemen)

1. `git init` + ilk commit
2. `services/api` FastAPI iskeleti + venv + `/health` testi
3. `apps/web` React iskeleti
4. `.env` gerçek değerlerle
5. NocoDB bağlantı testi
