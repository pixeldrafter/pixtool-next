/**
 * Tema arka planı (duvar kağıdı katmanı).
 *
 * Faz A kapsamı: `gradient` / `solid` / `image` türleri.
 * Sonraki adımda eklenecek: `spider-clock` ve `pixel-bat` animasyon katmanları
 * (bileşenler hazır olduğunda buraya bağlanır).
 */

import { useSettingsStore } from "../settings/store";
import "./ThemeBackdrop.css";

export function ThemeBackdrop() {
  const wallpaper = useSettingsStore((state) => state.settings.appearance.wallpaper);

  const style: React.CSSProperties = {};

  if (wallpaper.kind === "image" && wallpaper.source) {
    style.backgroundImage = `url("${wallpaper.source}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }

  return (
    <div className="backdrop" aria-hidden="true">
      <div className={`backdrop__layer backdrop__layer--${wallpaper.kind}`} style={style} />
      <div className="backdrop__stars" />
      <div className="backdrop__dim" style={{ opacity: wallpaper.dim }} />
    </div>
  );
}
