# Pixtool Next — Ajan Çalışma Notları

Bu dosya, bu depoda çalışan yapay zeka ajanları için **bağlayıcı** talimatlardır.

---

## Proje kimliği

- **Ad:** Pixtool Next
- **Tür:** Uzak sistem yönetim paneli (online, web + mobil + masaüstü)
- **Dil:** Türkçe arayüz · İngilizce kod tanımlayıcıları
- **Durum:** Faz 0 (iskelet)

> ⚠️ Bu depo **eskilerle karışmaz**. Eski kod tabanları (`Pixtool Global v6`,
> `PixtoolDesktopDemo`, `Pixtool Global Gemini Pro v5`) ayrı klasörlerdedir ve
> yalnızca **okunmak** için referanstır. Bkz. `docs/HASAT.md`.

---

## Komutlar

### Kök (pnpm workspace)

| Amaç | Komut |
|---|---|
| Bağımlılık kur | `pnpm install` |
| Arayüz geliştirme | `pnpm dev:web` |
| Backend geliştirme | `pnpm dev:api` |
| Tüm testler | `pnpm test` |
| Lint | `pnpm lint` |
| Tip kontrolü | `pnpm typecheck` |
| Derleme | `pnpm build` |

### Backend (`services/api`)

| Amaç | Komut |
|---|---|
| Sanal ortam | `python -m venv .venv` |
| Etkinleştir (Win) | `.venv\Scripts\activate` |
| Bağımlılıklar | `pip install -r requirements.txt` |
| Çalıştır (dev) | `uvicorn app.main:app --reload --port 8000` |
| Testler | `pytest` |
| Lint | `ruff check .` |
| Biçimlendirme | `ruff format .` |

### Arayüz (`apps/web`)

| Amaç | Komut |
|---|---|
| Çalıştır | `pnpm dev` |
| Derle | `pnpm build` |
| Testler | `vitest run` |
| Tip kontrolü | `tsc --noEmit` |

---

## Mimari kurallar

1. **Katman ayrımı zorunlu.** Arayüzde iş mantığı olmaz; tüm iş mantığı backend'dedir.
   Arayüz yalnızca API çağırır ve durumu yönetir.
2. **Sırlar asla depoya girmez.** `.env` dosyası `.gitignore` içindedir. Tüm sırlar
   ortam değişkeninden okunur. Koda gömülü anahtar/şifre **yasak**.
3. **Tek veri kaynağı NocoDB.** Ayrı bir yerel veritabanı tutulmaz (ölçeklenme
   gerekirse sonra tartışılır). Tüm tablo erişimi `app/integrations/nocodb.py`
   üzerinden yapılır; başka yerden doğrudan HTTP çağrısı yapılmaz.
4. **Tipler paylaşılır.** API sözleşmeleri FastAPI OpenAPI şemasından üretilir;
   arayüzde elle tip yazılmaz.
5. **Platform bağımsızlığı.** Windows ve Linux birlikte desteklenir. Dosya yolları
   `pathlib` ile, komutlar kabuk varsayımı yapılmadan yazılır.
6. **Türkçe metinler arayüzde**, kod içinde Türkçe değişken adı kullanılmaz.

---

## Kodlama standartları

- **Python:** Ruff (lint + format), 100 karakter satır, tip ipuçları zorunlu,
  Pydantic v2 modelleri kullanılır.
- **TypeScript:** strict mod açık, `any` kullanımı yasak (gerekiyorsa `unknown` + daraltma).
- **Commit:** Conventional Commits — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

---

## Çalışma biçimi

- Değişiklikleri **küçük ve bağımsız** adımlar hâlinde tut.
- Mevcut çalışan testleri bozma; iş bitince ilgili testleri çalıştırarak doğrula.
- Yıkıcı işlem (silme, `git reset --hard`, `push --force`) öncesi **onay al**.
- Belirsizlik varsa varsayım yapma, **soru sor**.
- Büyük çıktıları bağlama doldurma; filtreleyerek oku.

---

## Kritik teknik tuzak

**Köprü ↔ tarayıcı iletişimi.** Online arayüz HTTPS, yerel köprü
`http://127.0.0.1:8765`. Tarayıcılar HTTPS sayfadan HTTP localhost'a istekte
bulunurken *mixed content* ve *Private Network Access* kısıtları uygular.

→ **Çözüm:** Yerel sistem işleri **Tauri masaüstü kabuğundan** yapılır (native,
kısıt yok). Tarayıcı/mobil = uzak özellikler.
→ Faz 0'da doğrulanacak. Bkz. `docs/ACIK-KONULAR.md`.
