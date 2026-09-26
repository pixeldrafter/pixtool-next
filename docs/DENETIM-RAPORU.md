# Pixtool Next — Uçtan Uca Denetim Raporu

- **Tarih:** 2026-09-26
- **Denetlenen:** Kurulu uygulama `C:\Program Files\Pixtool Next` (pixtool-desktop.exe 1.2.4, pixtool-bridge.exe) + uzak web `https://pixtool.omercataloglu.com` + kaynak çalışma ağacı `C:/Users/DOGUS/Desktop/Projeler/pixtool-next`.
- **Kapsam:** Yalnızca inceleme/çalıştırma/kanıt toplama. **Hiçbir kod değiştirilmedi.**
- **Yöntem:** Kurulu exe'yi komut satırından çalıştırıp log yakalama, `curl` ile köprü uçları, `netstat`/`tasklist`/`Win32_Process`, WebView2 uzak hata ayıklama (`--remote-debugging-port=9222`) üzerinden canlı sayfada JS değerlendirme.
- **ÖNEMLİ — çalışma ağacı denetim sırasında değişiyordu:** `git status` başlangıçta 2 dosya `M` gösterirken denetim sonunda 8 dosya `M` ve sürüm `1.2.5` olmuştu. Kanıtlar bu nedenle "kurulu derleme" (1.2.4) ile "canlı çalışma ağacı" olarak ayrıştırıldı.

---

## ÖZET (TL;DR)

Kullanıcının bildirdiği üç hata da **tek bir kök nedene** bağlıdır:

> Uzak origin (`https://pixtool.omercataloglu.com`) yüklendiğinde, kabuğun kendi komutları
> (`bridge_status`, `bridge_start`, `shell_version`, `bridge_stop`, …) **Tauri ACL tarafından reddediliyor**:
> `Command bridge_status not allowed by ACL`. Arayüz bu hatayı yutup `settings.bridge.token`
> değerine düşüyor; o değer de **boş (`""`)** olduğu için köprüye token'sız gidiyor ve korumalı
> uçlar **HTTP 401** dönüyor.

Köprü, portu ve token'ı sağlıklıdır; sorun arayüz ile kabuk arasındaki yetki köprüsündedir.

---

## BULGULAR

### BULGU 1 — [KRİTİK] Uzak origin'de kabuk komutları ACL ile reddediliyor

**Kanıt (canlı sayfada DevTools Protokolü ile ölçüldü):**

Uygulama `--remote-debugging-port=9222` ile çalıştırıldı; CDP ile hedef sayfa
`https://pixtool.omercataloglu.com/` üzerinde `Runtime.evaluate` çalıştırıldı:

```
href         = https://pixtool.omercataloglu.com/
internals    = object                     <-- window.__TAURI_INTERNALS__ VAR
tauri        = object                     <-- window.__TAURI__ VAR
invoke       = function                   <-- window.__TAURI__.core.invoke VAR
tauriKeys    = ["__TAURI_IIFE__","__TAURI__","__TAURI_PLUGIN_OPENER__","__TAURI_PLUGIN_PROCESS__","__TAURI_PLUGIN_SHELL__","__TAURI_PLUGIN_UPDATER__"]

shell_version           => ERR:Command shell_version not allowed by ACL
window_is_maximized     => ERR:Command window_is_maximized not allowed by ACL
ui_source               => ERR:Command ui_source not allowed by ACL
bridge_status           => ERR:Command bridge_status not allowed by ACL
bridge_start            => ERR:Command bridge_start not allowed by ACL
plugin:process|restart  => OK:null        <-- yalnızca eklenti (plugin) komutları geçiyor
```

Karşı kontrol — WebView2 aynı penceresi **yerel** origin'e yönlendirildi
(`Page.navigate -> http://tauri.localhost/`):

```
href           = http://tauri.localhost/
internals      = object
shell_version  = OK:"1.2.4"
bridge_status  = OK:{"running":true,"port":8765,"url":"http://127.0.0.1:8765","token":"IQV6C8rXrGG7jBJ9r52KQAAAAAAAAAAA","error":null}
```

→ Aynı komutlar **yerelde çalışıyor, uzakta ACL ile reddediliyor.**

**İlgili dosyalar:**
- `apps/desktop/src-tauri/capabilities/remote.json` (tamamı, ~33 satır) — uzak origin için izin listesi yalnızca core/plugin izinlerini içerir; **hiçbir uygulama komutu izni yok**:
  ```
  "local": false,
  "remote": { "urls": ["https://pixtool.omercataloglu.com"] },
  "permissions": ["core:default", "core:window:allow-*", "opener:default", "updater:default", "process:default", "process:allow-restart"]
  ```
- `apps/desktop/src-tauri/capabilities/default.json` — aynı liste, `"local": true`.
- `apps/desktop/src-tauri/gen/schemas/acl-manifests.json` — içinde `bridge_status` / `shell_version` / `ui_source` gibi **uygulama komutları hiç yok** (yalnızca core + plugin izinleri). Grep: `grep -a -o "bridge_status\|shell_version\|ui_source\|window_minimize" gen/schemas/acl-manifests.json` → **0 sonuç**.
- Tauri sürümü: `tauri 2.11.6` (`Cargo.lock`).

**Kök neden:** Tauri v2'de uygulamanın kendi `#[tauri::command]`'ları uzak origin için bir capability izniyle açıkça verilmedikçe ACL uyarınca reddedilir. `remote.json` bunları vermiyor; dolayısıyla `invoke_handler` ile kayıtlı tüm komutlar uzak sayfada erişilemez.

**Önerilen düzeltme:**
1. (Kalıcı) Uygulama komutları için ACL izinleri tanımlayıp `remote.json`'a eklemek (örn. `bridge_status`, `bridge_start`, `bridge_stop`, `shell_version`). Tauri v2'de uygulama komutları için izin seti üretimi/ataması gerekir.
2. (Uygulanmış yedek çözüm) Kabuğun token'ı sayfaya `window.eval` ile enjekte etmesi — `window.__PIXTOOL_BRIDGE__`. Bu, IPC'yi tamamen atlar (bkz. Bulgu 5). Bu yalnızca köprü kimliklerini çözer; `shell_version`/`bridge_stop`/`window_*` gibi diğer uygulama komutları uzakta **hâlâ çalışmaz**.

---

### BULGU 2 — [KRİTİK] Arayüz boş token ile gidiyor (`settings.bridge.token === ""`)

**Kanıt:**

`localStorage["pixtool.settings"]` (canlı sayfadan CDP ile okundu):

```json
{"state":{"settings":{ ...,
  "bridge":{"enabled":true,"url":"http://127.0.0.1:8765","token":"","autoProbe":true,"allowRun":false}
}},"version":2}
```

- Varsayılan ayar: `apps/web/src/settings/defaults.ts:104-111` → `bridge.token: ""`.
- Yedek zincir: `apps/web/src/console/bridge.ts:168` `resolveBridgeOptions()` → önce kabuk, olmazsa `fallback` (ayarlar). Kotarma yolu (`apps/web/src/lib/runTarget.ts:142-145`), dosya yöneticisi (`apps/web/src/lib/useBridgeFsOptions.ts:27-29`) ve widget'lar (`apps/web/src/widgets/useHardwareMetrics.ts:159,216`) aynı fonksiyona düşer.
- LevelDB taraması (`%LOCALAPPDATA%\com.omercataloglu.pixtool\EBWebView\Default\Local Storage\leveldb`): kayıtlı anahtarlar `pixtool.files.v1`, `pixtool.desktop.items`, `pixtool.games.active`, `pixtool.tools.*`, `pixtool.omercataloglu.com` — **bayat/sabit bir token bulunmadı**; token varsayılan olarak boş.

**Sonuç:** ACL reddi → `bridgeFromTauri()` hatayı yutar (`apps/web/src/console/bridge.ts:145-155` civarı `try/catch`) → `resolveBridgeOptions` `fallback`'e (boş token) döner → korumalı uçlara token'sız istek → **401**.

**Kullanıcı hata mesajlarının kaynağı:**
- “Köprü yanıt verdi ama bilgi alınamadı (token kontrol edin).” → `apps/web/src/console/probe.ts:310-315` (önce token'sız `/health` 200 döner, sonra `/info` 401 döner).
- “Köprü HTTP 401” → `apps/web/src/lib/fsApi.ts:127` (`probeBridge` health dışı çağrı).
- “Yetkisiz — X-Pixtool-Token gerekli” → köprü 401 gövdesi (`services/bridge/pixtool_bridge.py:1949,2005,2038,2131`).
- “Köprü tokenı geçersiz.” → `apps/web/src/lib/runTarget.ts:175-177` (401 dalı).

**Önerilen düzeltme:** Bulgu 1 çözülünce token kabuktan gelecektir. Ek olarak, arayüzdeki yedek davranış, boş token ile korumalı uca istek atmak yerine kullanıcıya net bir "kabuk bağlantısı kurulamadı" durumu göstermeli.

---

### BULGU 3 — [ORTA] Kurulu 1.2.4 derlemesi ve sunucudaki web, `__PIXTOOL_BRIDGE__` yedek yamasını içermiyor

**Kanıt:**
- Kurulu ikili: `grep -a -c "__PIXTOOL_BRIDGE__" "C:/Program Files/Pixtool Next/pixtool-desktop.exe"` → **0**. (`bridge_status`, `köprü hazır` stringleri var → 1.)
- Kurulum dosyası: `releases/Pixtool Next_1.2.4_x64-setup.exe` (NSIS, sıkışık) — doğrudan string taraması anlamsız; ama kurulu exe'de yok.
- Sunucudaki web: `https://pixtool.omercataloglu.com/assets/index-B4-sk0KE.js` indirildi; `grep -a -c "__PIXTOOL_BRIDGE__"` → **0**, `__TAURI_INTERNALS__` → 3, `bridge_status` → 2. → Sunucudaki arayüz de enjeksiyon okumasını içermiyor.
- Canlı ölçüm: `window.__PIXTOOL_BRIDGE__` → **null**.

**Zaman damgası uyumu:** `pixtool-desktop.exe` derleme zamanı `Sep 26 12:46`; yama içeren kaynak dosyaların mtime'ı `12:58–12:59`. Yani kurulu derleme yamadan **önce** üretilmiş.

**Kök neden/etki:** Kurulu uygulama + sunucudaki web kombinasyonunda yedek enjeksiyon yok; tek çare olan IPC de Bulgu 1 nedeniyle reddediliyor → hata kaçınılmaz.

**Önerilen düzeltme:** Yama (1.2.5) derlenip kurulmalı **ve** düzeltilmiş web sunucuya dağıtılmalı (ikisi birlikte; sadece exe veya sadece web yeterli değil).

---

### BULGU 4 — [BİLGİ] Köprü tarafı sağlıklı (sorun köprüde değil)

**Kanıt (kurulu köprü, çalışan uygulamanın başlattığı 127.0.0.1:8765):**

```
/health            -> HTTP 200  {"ok":true,"service":"pixtool-bridge","version":"1.0.0","psutil":true,"platform":"Windows","device_id":"dev-_4xflsCU8bfN7DKp2W","token_required":true}
/ping  no-token    -> HTTP 401  {"ok":false,"error":"Yetkisiz — X-Pixtool-Token gerekli."}
/ping  wrong-token -> HTTP 401  {"ok":false,"error":"Yetkisiz — X-Pixtool-Token gerekli."}
/ping  correct     -> HTTP 200  {"ok":true,"service":"pixtool-bridge","version":"1.0.0"}
/info?parts=system correct -> HTTP 200  {"ok":true,"bridge_version":"1.0.0","psutil":true, report.system: hostname=DESKTOP-V53UQUF, platform=Windows, release=11, version=10.0.26200}
```

Köprü komut satırı (`Win32_Process`):
```
"C:\Program Files\Pixtool Next\pixtool-bridge.exe" --port 8765 --token 8UWFYwuar7bXDPLkc52KQAAAAAAAAAAA --parent-pid 18536
```

Kurulu uygulama başlangıç logu (stdout yakalandı):
```
[pixtool] arayüz uzaktan yüklendi: https://pixtool.omercataloglu.com
[pixtool] köprü hazır: http://127.0.0.1:8765
```
→ **“[pixtool] köprü hazır:” VAR.** `[bridge_status] çağrıldı` logu yok (bu log yalnızca yeni çalışma ağacında eklenmiş; kurulu 1.2.4 derlemesinde yok).

**Bağımsız köprü testi (madde 7):** `pixtool-bridge.exe --port 8909 --token TESTT --parent-pid <canlı pid>`:
```
/ping  TESTT  -> 200 {"ok":true,"service":"pixtool-bridge","version":"1.0.0"}
/ping  WRONG  -> 401 {"ok":false,"error":"Yetkisiz — X-Pixtool-Token gerekli."}
/info?parts=system TESTT -> 200 {"ok":true,"bridge_version":"1.0.0","psutil":true, ...}
```
→ Token doğruysa 200, yanlış/boşsa 401. Köprü beklenen davranışı sergiliyor.

---

### BULGU 5 — [ORTA] Aynı ACL reddi diğer kabuk komutlarını da vuruyor

Uzak origin'de ACL ile reddedilen komutlar, yalnızca köprü token'ını etkilemez. Arayüzün kullandığı diğer kabuk komutları da çalışmaz:

- `apps/web/src/updater/UpdateBanner.tsx:163` → `invoke("bridge_stop")` ve `:238` → `invoke("shell_version")`; uzakta ACL hatası (`catch` ile yutuluyor → güncelleme öncesi köprü durdurma ve sürüm gösterimi sessizce başarısız).
- `apps/web/src/lib/openExternal.ts:44-47` → `invoke("bridge_status")` (harici açma köprü token'ı IPC'den çekemez).
- `apps/desktop/src-tauri/src/lib.rs` içindeki `window_minimize`, `window_close`, `window_toggle_maximize`, `window_is_maximized`, `window_set_fullscreen`, `window_is_fullscreen`, `ui_source`, `navigate_ui`, `reload_ui` — uzakta ACL reddi. (Arayüzde literal `invoke("window_*")` kullanımı bulunamadı; dolayısıyla bu komutların kullanıcıya etkisi **test edilemedi**, ancak ACL reddi kanıtlı.)

**Not:** Çalışma ağacındaki düzeltme (`git diff`, dosyalar denetim sırasında değişti):
- `apps/desktop/src-tauri/src/lib.rs` — `inject_bridge_credentials()` ile `window.__PIXTOOL_BRIDGE__` enjeksiyonu (`window.eval`), `bridge_start` sonrası ve `navigate_ui`/`reload_ui`/açılışta tekrarlı enjeksiyon.
- `apps/web/src/console/bridge.ts` — `readInjectedBridge()` ve `bridgeFromTauri()` içinde IPC'den önce enjekte kimlikleri okuma + yeniden deneme döngüsü.
- Sürüm `1.2.4` → `1.2.5` (`tauri.conf.json`, `Cargo.toml`).
- **`capabilities/remote.json` ve `capabilities/default.json` DEĞİŞMEMİŞ** (md5 sabit: `remote.json` = `7a68b10d89eeebc86d3471cc727bc055`). Yani ACL kök nedeni, diğer komutlar için hâlâ açık.

---

### BULGU 6 — [DÜŞÜK] Köprü token'ı komut satırında düz metin

`Win32_Process.CommandLine` ile token herhangi bir yerel süreç tarafından okunabiliyor (`--token ...`). Yerel köprü olsa da, aynı makinedeki başka bir kullanıcı/süreç token'ı görebilir. **Öneri:** token'ı komut satırı yerine ortam değişkeni/kısa ömürlü dosya ile iletmek.

---

## DENETİM SIRASINDA ÇALIŞTIRILAN TEMEL KOMUTLAR

```bash
# 1) Kurulu exe çalıştırma + log
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" \
  "/c/Program Files/Pixtool Next/pixtool-desktop.exe" > /tmp/px_desktop.log 2>&1 &
# -> [pixtool] arayüz uzaktan yüklendi: https://pixtool.omercataloglu.com
# -> [pixtool] köprü hazır: http://127.0.0.1:8765

# 2) Köprü uçları
curl -s -H "X-Pixtool-Client: web" http://127.0.0.1:8765/health
curl -s http://127.0.0.1:8765/ping                       # 401
curl -s -H "X-Pixtool-Token: WRONG" http://127.0.0.1:8765/ping   # 401
curl -s -H "X-Pixtool-Token: <token>" http://127.0.0.1:8765/ping # 200

# 3) Token (komut satırı)
powershell -Command "Get-CimInstance Win32_Process -Filter \"name='pixtool-bridge.exe'\" | %{ \$_.CommandLine }"

# 4) Canlı WebView ölçümü (CDP ws://127.0.0.1:9222)
#    invoke("bridge_status") -> ERR:Command bridge_status not allowed by ACL   [remote]
#    invoke("bridge_status") -> OK:{...,"token":"..."}                          [local: tauri.localhost]

# 5) Bağımsız köprü
"/c/Program Files/Pixtool Next/pixtool-bridge.exe" --port 8909 --token TESTT --parent-pid <pid>
```

---

## KANITLANAN KÖK NEDEN

**Hipotez (“arayüz uzak origin'den yüklendiği için `window.__TAURI__.core.invoke("bridge_status")` ya hiç çalışmıyor ya da beklenen token'ı döndürmüyor; web `settings.bridge.token`'a düşüyor”): DOĞRU — ancak mekanizması biraz farklı.**

Ölçümler bunu netleştirdi:

1. Uzak origin'de `window.__TAURI_INTERNALS__` **var**, `window.__TAURI__` **var** ve `core.invoke` **bir fonksiyon**. Yani “IPC hiç yok” iddiası **yanlış**.
2. Buna rağmen `invoke("bridge_status")` **`Command bridge_status not allowed by ACL`** hatası fırlatıyor. Aynı komut **yerel** origin'de (`http://tauri.localhost/`) sorunsuz çalışıp gerçek token'ı döndürüyor.
3. Sebep: Tauri v2, uzak origin için uygulamanın kendi komutlarını **capability/ACL** ile açıkça izinli olmadıkça reddeder. `apps/desktop/src-tauri/capabilities/remote.json` yalnızca core/plugin izinlerini listeliyor; uygulama komutları için izin yok.
4. `bridgeFromTauri()` hatayı `catch` ile yutup `null` döndürüyor → `resolveBridgeOptions()` ayarlara (`settings.bridge.token`) düşüyor.
5. `settings.bridge.token` **boş (`""`)** (varsayılan; localStorage'da da `""`). Böylece arayüz köprüye **token'sız** gidiyor; `/health` (korumasız) 200 dönüyor ama `/info`, `/run`, `/fs/*` **401** dönüyor.

Yani gerçek kök neden “arayüz köprüye yanlış token'la gidiyor” ifadesinin teknik karşılığıdır: **token hiç ulaşmıyor (boş kalıyor), çünkü kabuğun token'ını taşıyan özel komut uzak origin'de ACL tarafından bloke ediliyor.** Köprü tarafında bir arıza yok.

**Kalıcı düzeltme:** Uygulama komutlarına uzak origin için ACL izni tanımlayıp `remote.json`'a eklemek. **Yedek düzeltme (çalışma ağacında uygulanıyor):** kabuğun token'ı `window.__PIXTOOL_BRIDGE__` üzerinden enjekte etmesi + web'in bunu okuması — bu, 401 semptomunu giderir, fakat ACL ile bloke olan diğer uygulama komutlarını (`shell_version`, `bridge_stop`, `window_*`) düzeltmez.

---

## TEST EDİLEMEYEN / AÇIK NOKTALAR

- “Yetkisiz — X-Pixtool-Token gerekli” hatasının **GUI'de birebir görüntüsü** bu ortamda ekran görüntüsüyle doğrulanamadı; ancak aynı koşul (uzak origin + boş token) canlı olarak ölçüldü ve 401 davranışı doğrulandı.
- `window_minimize`/`window_close` gibi pencere kontrol komutlarının arayüzdeki kullanım yeri literal aramada bulunamadı; kullanıcıya etkisi **test edilemedi** (ACL reddi ise kanıtlı).
- Sunucudaki web’in hangi git revizyonundan derlendiği kesin değil; yalnızca `__PIXTOOL_BRIDGE__` içermediği kanıtlandı.
- Çalışma ağacı denetim sırasında değişti (sürüm 1.2.5'e yükseldi); nihai 1.2.5 derlemesinin davranışı bu rapor kapsamında derlenip test edilmedi.
