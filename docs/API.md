# Backend API — Uç Noktalar

Taban adres (geliştirme): `http://127.0.0.1:8000`
OpenAPI arayüzü: `/docs`

---

## Genel

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/` | Servis kimliği |
| GET | `/health` | Canlılık kontrolü (bağımlılık çağrısı yapmaz) |
| GET | `/api/v1/status` | Yapılandırma özeti + NocoDB bağlantı testi |

### `GET /api/v1/status` — örnek yanıt

```json
{
  "app": { "name": "Pixtool Next", "version": "0.1.0", "env": "development" },
  "features": {
    "db_adapter": "nocodb",
    "command_policy": "confirm",
    "platforms": { "windows": "10,11", "linux": "ubuntu,debian" }
  },
  "integrations": {
    "nocodb": {
      "configured": true,
      "placeholder": true,
      "reachable": false,
      "ok": false,
      "base_url": "https://nocodb.SENIN-DOMAININ.com",
      "detail": "NocoDB adresi hâlâ şablon değer…"
    },
    "n8n": { "configured": false },
    "telegram": { "configured": false },
    "bridge": { "configured": false }
  },
  "warnings": ["NocoDB adresi şablon değer — .env içinde gerçek adres girilmeli."]
}
```

---

## Kimlik doğrulama

Akış: **şifre → OTP → oturum tokenı**

### `POST /api/v1/auth/login`

```json
{ "username": "admin", "password": "pixtool" }
```

Başarılı yanıt (`200`):

```json
{
  "ok": true,
  "otp_required": true,
  "challenge_id": "…",
  "code_length": 6,
  "attempts_left": 3,
  "channel": "totp",
  "message": "Doğrulama kodu gönderildi.",
  "dev_otp": "488779"
}
```

- `dev_otp` **yalnızca demo kipinde** dolar (n8n/Telegram kurulu değilken ve
  `APP_ENV != production`). Arayüz bunu ekranda gösterir.
- Hatalı kimlik bilgisinde `401`.

### `POST /api/v1/auth/verify-otp`

```json
{ "challenge_id": "…", "code": "488779" }
```

Başarılı: `{ "ok": true, "token": "…", "message": "Doğrulama başarılı." }`

Başarısız: `{ "ok": false, "attempts_left": 2, "message": "Kod hatalı. 2 deneme hakkın kaldı." }`

> 3 yanlış denemede meydan okuma **kapanır** ve arayüz ceza ekranını açar
> (The Impossible Light Bulb, 2 dakika).

### `POST /api/v1/auth/resend-otp`

```json
{ "challenge_id": "…" }
```

Yeni kod üretir, deneme hakkını sıfırlar.

### `GET /api/v1/auth/session`

`Authorization: Bearer <token>` başlığını doğrular.

```json
{ "ok": true, "username": "admin" }
```

**Token biçimi:** HMAC-SHA256 ile imzalanmış, süreli (12 saat).
Sır: `API_SECRET_KEY`. Boşsa geliştirme anahtarına düşer ve başlangıçta uyarır.

---

## Cihaz raporu

Açılışta makinenin bilgisi toplanır; kullanıcı onaylarsa kaydedilir.

### `POST /api/v1/devices/report`

```json
{
  "report": { "browser": {…}, "hardware": {…}, "gpu": {…} },
  "collected_at": "2026-09-22T12:00:00Z",
  "user_agent": "Mozilla/5.0 …"
}
```

Yanıt:

```json
{ "ok": true, "device_id": "dev-280b985c8c4db8cb", "stored_in": "local", "message": "…" }
```

- `stored_in`: `"nocodb"` (yapılandırılmışsa) veya `"local"`
- `device_id`: kararlı parmak izi — platform, ekran, çekirdek sayısı, GPU,
  saat dilimi. Sayfa yükleme süresi gibi **geçici** alanlar kimliği etkilemez.
- NocoDB yazımı başarısız olursa **otomatik olarak yerel dosyaya** düşer
  → veri kaybı olmaz.

Yerel depo: `services/api/data/device-reports.jsonl`

### `GET /api/v1/devices?limit=50`

Kayıtlı cihaz raporlarını listeler (en yeniler önce). `limit` 1-500 arası.

---

## Hata biçimi

FastAPI standardı:

```json
{ "detail": "Kullanıcı adı veya parola hatalı." }
```

| Kod | Anlam |
|---|---|
| 401 | Kimlik bilgisi hatalı |
| 404 | Doğrulama oturumu bulunamadı |
| 422 | İstek gövdesi geçersiz (Pydantic doğrulaması) |

---

## Ortam değişkenleri (ilgili)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `APP_ENV` | `development` | `production` → demo kipi kapanır |
| `API_SECRET_KEY` | (boş) | Token imzalama anahtarı |
| `AUTH_DEMO_USER` | `admin` | Demo kullanıcı |
| `AUTH_DEMO_PASSWORD` | `pixtool` | Demo parola |
| `AUTH_OTP_LENGTH` | `6` | Kod uzunluğu |
| `AUTH_OTP_MAX_ATTEMPTS` | `3` | Ceza öncesi deneme hakkı |
| `NOCODB_BASE_URL` | (boş) | NocoDB kök adresi |
| `NOCODB_API_TOKEN` | (boş) | NocoDB API tokenı |
| `NOCODB_TABLE_DEVICES` | (boş) | Cihaz tablosu adı |
| `N8N_LOGIN_WEBHOOK` | (boş) | Gerçek OTP kanalı |

---

## Test

```bash
cd services/api
.venv\Scripts\python.exe -m pytest -v
```

Kapsam: sağlık (5), kimlik doğrulama (21), cihaz raporu (9) — **35 test**.
