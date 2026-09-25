# Pixtool Next — uygulama ikonu

## Dosyalar
| Dosya | Ne |
|---|---|
| `icon-source.html` | **Kaynak.** SVG olarak çizilmiş ikon (tarayıcıda açılır). |
| `icon-1024.png` | Bu kaynaktan üretilen 1024×1024 RGBA ana görsel. |

## Tasarım
- 5×7 **piksel ızgaradan** oluşan "P" harfi — "Pixtool" adına gönderme.
- Gövde koyu lacivert (Windows 11 koyu tema tonu), çapraz gradyan + ince piksel dokusu.
- Harf buz mavisi → canlı mavi gradyan; arkasında yumuşak hale.
- Gövdenin **alt ucundaki piksel beyaz yanar** — terminal imleci göndermesi.
- 16 px'te bile net okunur (blok yapısı sayesinde).

## Yeniden üretme
```bash
# 1) HTML → PNG (Chrome, şeffaf arka plan)
chrome --headless=new --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --force-device-scale-factor=1 --screenshot=icon-1024.png \
  "file:///.../icon-source.html"

# 2) Tüm boyutlar + .ico + .icns
pnpm icons:desktop    # tauri icon src-tauri/icons/_source/icon-1024.png
```

> Not: `tauri icon` Windows'ta `.cmd` üzerinden tırnaklı yol ile çağrıldığında
> "os error 123" verir. Doğrudan Node ile çağırın:
> `node node_modules/@tauri-apps/cli/tauri.js icon <yol>`
