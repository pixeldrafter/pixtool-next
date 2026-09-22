# Hasat Planı — Eski Kod Tabanlarından Devralınacaklar

Eski kod **çöpe gitmiyor**. Aşağıdaki tablo neyin nereye taşınacağını gösterir.

## Kaynaklar

| Kısa ad | Konum | Ne |
|---|---|---|
| **v5** | `Desktop\Pixtool Global Gemini Pro v5` | Çalışan PyQt6 ürünü, ~7.850 satır / 39 dosya |
| **v6** | `Desktop\Projeler\Pixtool Global v6` | PySide6 yeniden yazım denemesi (Tem 2026), NocoDB prototipi |
| **demo** | `Desktop\Projeler\PixtoolDesktopDemo` | "PixOS" işletim sistemi kabuğu prototipi (PySide6) |

> ⚠️ Bu klasörler **sadece okunur**. Buraya kopyalanmaz, referans alınır.

---

## v6 → Backend'e taşınacak (yüksek değer)

| v6 dosyası | Hedef | Not |
|---|---|---|
| `app/core/db/nocodb_client.py` | `services/api/app/integrations/nocodb.py` | NocoDB REST istemcisi |
| `app/core/config/config_manager.py` | `services/api/app/core/config.py` | `.env` okuma |
| `app/core/remote/ssh_manager.py` | `services/api/app/integrations/ssh.py` | Paramiko SSH |
| `app/core/remote/sftp_client.py` | `services/api/app/integrations/` | SFTP dosya işlemleri |
| `app/core/scripts/script_runner.py` | `services/api/app/services/script_runner.py` | Script yürütme |
| `app/core/scripts/script_catalog.py` | `services/api/app/services/` | Script kataloğu |
| `app/core/scripts/run_logger.py` | `services/api/app/services/` | Çalıştırma logu |
| `app/core/security/crypto.py` | `services/api/app/core/security.py` | Kripto yardımcıları |
| `app/core/security/vault.py` | `services/api/app/core/` | Sır kasası |
| `tools/bootstrap_nocodb.py` | `scripts/nocodb/` | NocoDB tablo kurulumu — **doğrudan kullanılır** |
| `tools/update_nocodb_schema.py` | `scripts/nocodb/` | Şema güncelleme |
| `tools/import_scripts.py` | `scripts/nocodb/` | Script aktarımı |
| `scripts_library/windows/*.ps1` | NocoDB `scripts` tablosu | 20 hazır PowerShell aracı |
| `app/core/console_ui.py` (29 KB) | `apps/web/src/screens/boot/` | **Boot animasyonu — harfiyen port edilir** (karar #10) |

## v5 → Referans / taşınacak

| v5 dosyası | Hedef |
|---|---|
| `core/console_ui.py` | Boot animasyonu kaynağı (asıl sürüm) |
| `config/themes.json` | Tema tokenları → CSS değişkenleri |
| `config/permissions.json` | RBAC modeli → NocoDB `permissions` |
| `config/scripts.json` | Script kütüphanesi → NocoDB `scripts` |
| `ui/login_window.py` | Login akışı referansı (animasyon örüntüleri) |
| `ui/pages/*.py` | Ekran gereksinimleri referansı |
| `core/*` | İş mantığı referansı |

> 🔴 **v5'te düz metin sırlar var** (`config/*.json`, `credentials/secrets.json`).
> Bu değerler bu depoya **alınmaz** ve **rotate edilir**.

## demo → Konsept referansı

| demo dosyası | Hedef |
|---|---|
| `desktop.py` (338 satır) | React masaüstü: duvar kağıdı, ikonlar, sağ tık menüsü |
| `taskbar.py` (105) | React görev çubuğu |
| `start_menu.py` (150) | React başlat menüsü |
| `app_windows.py` (91) | React pencere yöneticisi |
| `theme.py` (66) | Renk paleti / neon tema tokenları |
| `welcome.py` (84) | Karşılama akışı |
| `pixos.jpg` | Duvar kağıdı adayı |

**Yaklaşım:** Bu dosyalar **okunur**, davranış ve görsel dil anlaşılır, React'te
yeniden yazılır. Kod birebir taşınmaz (farklı dil / çatı).

---

## Taşınmayacaklar

| Ne | Neden |
|---|---|
| `v5/ui/pages/dashboard.py` (277 satır) | **Ölü kod** — hiçbir yerde kullanılmıyor |
| `v5/config/*.json` içindeki gerçek sırlar | Güvenlik — rotate edilecek |
| `v5/credentials/secrets.json` | Güvenlik — rotate edilecek |
| PyQt6 / PySide6 UI kodu | Arayüz React'te yeniden yazılıyor |
| `v6/.venv/` | Ortama özel, yeniden kurulur |
| `__pycache__/` | Derleme çıktısı |

---

## Sıra

1. **Faz 0:** `console_ui.py` okunur → boot ekranı web'de yazılır; `bootstrap_nocodb.py` gözden geçirilir
2. **Faz 0:** `nocodb_client.py` → backend adapter (referans)
3. **Faz 2:** script / SSH / SFTP modülleri taşınır
4. **Faz 2:** `scripts_library/windows/*.ps1` NocoDB'ye aktarılır
5. **Faz 3:** cihaz taraması ve köprü mantığı
