# Yol Haritası

## Faz 0 — İskelet & temel altyapı ✅

- [x] Proje klasörü + araç zinciri (Git 2.55, pnpm 12.5, Node 25, Python 3.14)
- [x] Kök dosyalar, workspace, .gitignore/.gitattributes
- [x] Dokümanlar (KARARLAR, MIMARI, YOL-HARITASI, HASAT, OZELLESTIRME, API, ACIK-KONULAR)
- [x] Git deposu + commit'ler
- [x] Backend: FastAPI + NocoDB adapter + 60 test
- [x] Arayüz: React 19 + Vite 7 + TS strict

## Faz 1 — OS kabuğu & login ✅

- [x] Ayar çekirdeği (şema, store, `mergeDeep` + 13 test)
- [x] Tema motoru (Windows / KDE / Neon)
- [x] Ayarlar ekranı (7 bölüm, akış sıralayıcı, JSON aktarımı)
- [x] ErrorBoundary
- [x] **6 login formu** — referans tasarımların birebir portu
- [x] **100 şaka** — forma göre temalı
- [x] **OTP ekranı** — 2 tasarım (klasik/form teması + yeti), 4 durum animasyonu
- [x] **Ceza ekranı** — Impossible Light Bulb, 2 dk geri sayım, sesli
- [x] **2 özel imleç** (örümcek, sürüngen)
- [x] **2 animasyonlu duvar kağıdı** (Spider Clock, Pixel Bat)
- [x] Boşta ekranı, animasyonlu kapatma
- [x] Pencere yöneticisi (sürükle, boyutlandır, z-sırası)
- [x] Başlat menüsü (Ctrl+K, arama, gruplar)
- [x] Masaüstü ikonları + görev çubuğu
- [x] Bekleme bileşenleri (DeadlineBar, WaitingCurtain)
- [x] **i18n altyapısı** (TR tam, EN kısmi, 11 test)

## Faz 2 — Özellikler ✅

- [x] **Genel Bakış** — entegrasyon kartları, uzak kaynak göstergeleri
- [x] **Script Kütüphanesi** — 18 PowerShell scripti, kategori/arama, içerik, çalıştırma
- [x] **Terminal** — SSH komut çalıştırma, geçmiş, politika onayı
- [x] **Dosya Yöneticisi** — SFTP dizin gezinme
- [x] **Kullanıcılar** — uzak sistem hesapları (`getent passwd`)
- [x] **Veritabanı** — NocoDB durumu + tablo eşlemeleri
- [x] **Kaynaklar** — bu makine + uzak sunucu kapasitesi
- [x] Backend: script/SSH/SFTP uç noktaları (60 test)
- [ ] NocoDB tablo şeması kurulumu — *token bekleniyor*
- [ ] Script çalıştırma (yerel) — *Faz 3 köprüsü gerekli*

## Faz 3 — Yerel köprü

- [ ] Köprü servisi (psutil), token doğrulaması
- [ ] Yerel sistem bilgisi + kurulu programlar
- [ ] Yerel script çalıştırma + çıktı akışı
- [ ] Boot taraması → NocoDB `devices`
- [ ] Zaafiyet taraması

## Faz 4 — Platform

- [ ] Tauri masaüstü kabuğu (Rust + VS Build Tools gerekli)
- [ ] Paketleme (msi/nsis, deb/AppImage)
- [ ] Mobil uyarlama (PWA)
- [ ] Sunucu dağıtımı (systemd + nginx + HTTPS)

## Faz 5 — İleride

- [ ] Agent modeli · Ticari kısım (lisans/marka)

---

## Geliştirme araçları

| Araç | Ne yapar |
|---|---|
| `node tools/e2e-test.mjs` | **Gerçek tarayıcıda** giriş + OTP akışını test eder (CDP) |
| `node tools/screenshot.mjs` | Tüm ekranların görüntüsünü alır |
| `?demo=otp` | OTP'nin 4 durumunu + 2 tasarımı tek ekranda |
| `?step=desktop` | Akış adımlarını atlar |
| `?window=<ad>` | Doğrudan bir pencere açar |
| `?login=<form>` `?theme=<tema>` `?otp=<stil>` | Geçici geçersiz kılma |

---

## Kalite

```
arayuz    : tip ✔ · 24 test ✔ · derleme ✔
backend   : lint ✔ · format ✔ · 60 test ✔
E2E       : giriş ✔ · OTP hatalı ✔ · OTP doğru ✔ · konsol ✔
```

**Toplam: 84 otomatik test.**
