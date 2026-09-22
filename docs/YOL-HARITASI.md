# Yol Haritası

## Faz 0 — İskelet & temel altyapı ✅ **TAMAMLANDI**

- [x] Proje klasörü + araç zinciri (Git 2.55, pnpm 12.5, Node 25, Python 3.14)
- [x] Kök dosyalar: `README`, `AGENTS`, `.gitignore`, `.gitattributes`, `.env.example`, workspace
- [x] Dokümanlar (KARARLAR, MIMARI, YOL-HARITASI, HASAT, OZELLESTIRME, API, ACIK-KONULAR)
- [x] `git init` + commit'ler
- [x] **Backend:** FastAPI + `/health` + `/api/v1/status` + NocoDB adapter
- [x] **Backend:** 35 test (sağlık, kimlik doğrulama, cihaz raporu)
- [x] **Arayüz:** React 19 + Vite 7 + TS strict + tasarım tokenları
- [x] **Arayüz:** Boot ekranı + API istemcisi + Vite proxy
- [x] Sırların git dışı tutulması doğrulandı

---

## Faz 1 — OS kabuğu & login ✅ **BÜYÜK ÖLÇÜDE TAMAMLANDI**

### Ayar & tema altyapısı ✅

- [x] **Ayar çekirdeği** — şema, varsayılanlar, kayıt defteri, zustand + localStorage
- [x] **Şema evrimi** — `mergeDeep` ile eski kayıtlar bozulmaz (13 test)
- [x] **Tema motoru** — Windows / KDE / Neon, saf CSS `[data-theme]` blokları
- [x] **Ayar senkronizasyonu** — tema, hareket, ölçek DOM'a uygulanır
- [x] **Ayarlar ekranı** — 7 bölüm, akış sıralayıcı, JSON dışa/içe aktarma
- [x] **ErrorBoundary** — boş ekran yerine okunabilir hata ekranı

### Görsel sistemler ✅

- [x] **6 login formu** — referans tasarımların **birebir** portu
- [x] **100 şaka** — forma göre temalı sunum, rastgele
- [x] **OTP adımı** — 4 görsel durum (idle / verifying / error / success)
  - hatalı kod → kutular **kırmızı + sallanma** + kırmızı ✕
  - doğru kod → kutular **sırayla yeşil + zıplama** + ilerleme çubuğu
- [x] **Ceza ekranı** — Impossible Light Bulb, 2 dk geri sayım, çekilebilir ip, yerel sesler
- [x] **Örümcek imleci** — 8 bacak, yürüme döngüsü, ağ izi
- [x] **Sürüngen imleci** — halkalı gövde, arayüz öğelerine ilgi
- [x] **Spider Clock** — sistem saatine bağlı, kadranda yürüyen örümcek
- [x] **Pixel Bat** — box-shadow piksel sanatı, 6 yarasa
- [x] **Boşta ekranı** — hareketsizlik takibi, seçilebilir ekran
- [x] **Animasyonlu kapatma** — Animated Logout

### Kabuk ✅

- [x] **Pencere yöneticisi** — sürükle, 8 yönden boyutlandır, küçült, büyüt, z-sırası
- [x] **Masaüstü ikonları** — çift tık / Enter
- [x] **Başlat menüsü** — arama, klavye gezinme, Ctrl+K
- [x] **Görev çubuğu** — açık pencereler, aktif vurgu, kullanıcı, saat, kapat
- [x] **Hakkında penceresi** — yapılandırma özeti, kısayollar, bileşen demoları

### Bekleme sistemleri ✅

- [x] **DeadlineBar** — Interactive Deadline portu (kırmızı/beyaz, yürüyen figür, kalan süre)
- [x] **WaitingCurtain** — bg.gif bekleme perdesi (Esc ile iptal)

### Konsol & akış ✅

- [x] **Makine envanteri** — gerçek tarayıcı/donanım verisi (çekirdek, GPU, ağ, pil, depolama)
- [x] **Köprü beklenen alanlar** — sahte veri yok, açıkça işaretli
- [x] **Akış yöneticisi** — `flow.order` ayarına göre dinamik adımlar
- [x] **Sessiz açılış** — konsol kapalıysa adım atlanır
- [x] **Rapor kaydetme** — onay sorusu → NocoDB / yerel dosya

### Eksik kalanlar

- [ ] **i18n altyapısı** — şu an yalnızca Türkçe (karar #13)
- [ ] **Command Palette (Ctrl+K)** — şimdilik başlat menüsü açıyor
- [ ] **Dosya yöneticisi / Terminal / Script kütüphanesi pencereleri** — iskelet hazır

---

## Faz 2 — Özellikler (sıradaki)

- [ ] **Overview** — ECharts grafikleri
- [ ] **Scripts** — katalog, editör, çalıştırma, çıktı akışı
- [ ] **Files** — SFTP dosya yöneticisi
- [ ] **Terminal** — xterm.js + SSH
- [ ] **Users** — RBAC, izinler
- [ ] **Database** — NocoDB tablo görünümü
- [ ] **Resources** — kaynak yönetimi
- [ ] **NocoDB tablo şeması** — `bootstrap_nocodb.py` hasadı

---

## Faz 3 — Yerel köprü

- [ ] Köprü servisi (psutil + paramiko), token doğrulaması
- [ ] Sistem bilgisi (CPU / RAM / disk / iç-dış IP)
- [ ] Kurulu programlar + sürümleri
- [ ] Script çalıştırma + çıktı akışı
- [ ] Boot taraması → NocoDB `devices`
- [ ] Cihaz kimliği
- [ ] Zaafiyet taraması

---

## Faz 4 — Platform

- [ ] Masaüstü paketleri (Tauri: msi/nsis, deb/AppImage)
- [ ] Mobil uyarlama (PWA)
- [ ] Sunucu dağıtımı (systemd + nginx + HTTPS)

---

## Faz 5 — İleride

- [ ] Agent modeli (karar #9)
- [ ] Ticari kısım (karar #1)

---

## Geliştirme araçları

| Araç | Kullanım |
|---|---|
| `tools/screenshot.mjs` | Chrome headless ile tasarım doğrulama |
| `?demo=otp` | OTP durumlarını tek ekranda gör |
| `?login=<form>` | Login formunu geçici değiştir |
| `?theme=<tema>` | Temayı geçici değiştir |
| `?step=desktop` | Akış adımlarını atla |

---

## Kalite durumu

```
PASS ✔  arayüz tip kontrolü      PASS ✔  arayüz testleri (13)
PASS ✔  arayüz derlemesi         PASS ✔  backend lint + format
PASS ✔  backend testleri (35)
```
