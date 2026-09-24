# Pixtool Bridge — Yerel Köprü (Faz 3)

Konsolda **"açılan bilgisayarın her şeyi"** görünsün diye yazılmış küçük bir
yerel servis. `127.0.0.1` üzerinde dinler; tarayıcı buraya istek atar.

---

## Neden gerekli?

Tarayıcı sandbox'ı donanımın tamamına erişemez:

| Bilgi | Tarayıcı | Köprü |
|---|---|---|
| İşlemci çekirdeği | ✅ (sayı) | ✅ (model + frekans + yük) |
| RAM miktarı | ~ (kaba) | ✅ (modül detayı) |
| Disk bölümleri | ❌ | ✅ |
| Kurulu programlar | ❌ | ✅ |
| Çalışan servisler | ❌ | ✅ |
| İşlem listesi | ❌ | ✅ |
| Gerçek IP / MAC | ❌ | ✅ |
| Ekran kartı | ~ (WebGL) | ✅ |
| Güvenlik durumu | ❌ | ✅ |

---

## Tarayıcı kısıtları — neden çalışır?

| Kısıt | Çözüm |
|---|---|
| **Mixed content** (HTTPS sayfa → HTTP istek) | `127.0.0.1` ve `localhost` tarayıcılarda **güvenilir kaynak** sayılır → engel yok |
| **Private Network Access** (public → private) | `Access-Control-Allow-Private-Network: true` başlığı gönderiliyor |
| **CORS** | `OPTIONS` ön kontrolü + `Access-Control-Allow-Origin` |
| **Yetkisiz erişim** | Her `/info` ve `/run` isteği `X-Pixtool-Token` ister |

> **Not:** Tauri kabuğu (Faz 4) kurulduğunda aynı köprü gömülü çalışır —
> ama köprü **Tauri'ye bağımlı değil**, bugün tarayıcıdan da çalışır.

---

## Çalıştırma

### Windows
```
start-bridge.bat          ← çift tıkla
```

### Linux / macOS
```bash
chmod +x start-bridge.sh
./start-bridge.sh
```

### Doğrudan
```bash
python pixtool_bridge.py                   # token otomatik üretilir
python pixtool_bridge.py --token GIZLI     # sabit token
python pixtool_bridge.py --port 9000       # farklı port
python pixtool_bridge.py --allow-origin https://pixtool.omercataloglu.com
```

Başlangıçta konsola **token** yazılır:

```
  ── TOKEN (arayüz Ayarlar > Köprü alanına girin) ──
  BuTokeniOrayaYapistirin
  ─────────────────────────────────────────────────
```

---

## Uçlar

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Servis durumu + cihaz kimliği (token gerekmez) |
| `GET` | `/info` | Tüm makine bilgisi (token gerekir) |
| `GET` | `/info?parts=cpu,memory` | Yalnızca seçili bölümler |
| `POST` | `/run` | Script çalıştır (token gerekir) |
| `OPTIONS` | * | CORS/PNA ön kontrolü |

### `/info` bölümleri

`system` · `cpu` · `memory` · `disks` · `network` · `gpu` · `processes` ·
`services` · `users` · `programs` · `security` · `environment`

### Örnek

```bash
TOKEN=BuTokeniOrayaYapistirin

curl -s -H "X-Pixtool-Token: $TOKEN" http://127.0.0.1:8765/health
curl -s -H "X-Pixtool-Token: $TOKEN" http://127.0.0.1:8765/info > rapor.json
curl -s -H "X-Pixtool-Token: $TOKEN" "http://127.0.0.1:8765/info?parts=cpu,memory"
```

### Script çalıştırma

```bash
curl -s -X POST http://127.0.0.1:8765/run \
  -H "X-Pixtool-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"executor":"powershell","script":"Get-Date"}'
```

Desteklenen yorumlayıcılar: `powershell` · `cmd` · `bash` · `python`
Zaman aşımı: en fazla 900 sn.

---

## Bağımlılıklar

**Zorunlu:** yok — yalnızca Python 3.10+ standart kütüphanesi.

**Önerilen:** `psutil` (RAM, disk, işlem, ağ detayı için)

```bash
pip install psutil
```

Kurulu değilse köprü **yine çalışır**; yalnızca standart kütüphaneden
toplanabilen bilgiler gelir ve `"psutil": false` döner.

---

## Güvenlik

- Yalnızca `127.0.0.1` dinler → **dışarıdan erişilemez**
- Token zorunlu (`secrets.compare_digest` ile sabit zamanlı karşılaştırma)
- `/run` yalnızca bilinen yorumlayıcıları kabul eder (keyfî komut yok)
- Çıktı boyutu sınırlı (stdout 20 KB, stderr 8 KB)
- `--allow-origin` ile yalnızca belirli kaynaklara izin verilebilir

**Öneri:** Tokenı paylaşmayın. Şüphelenirseniz köprüyü kapatıp yeni tokenla
başlatın.

---

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `Port kullanımda` | `--port 8766` ile başka port deneyin |
| Arayüz "köprü yok" diyor | Köprü çalışıyor mu? `curl http://127.0.0.1:8765/health` |
| `401 Yetkisiz` | Token yanlış — konsoldaki değeri kopyalayın |
| Eksik bilgi | `pip install psutil` |
| CORS hatası (tarayıcı konsolu) | `--allow-origin https://pixtool.omercataloglu.com` |

---

## Port

Varsayılan **8765**. Değiştirmek için:
```bash
python pixtool_bridge.py --port 9000
```
Ardından arayüzde Ayarlar > Köprü portu'nu da güncelleyin.
