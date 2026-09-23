/**
 * Tema arka planı (duvar kağıdı katmanı).
 *
 * Ayardaki `appearance.wallpaper.kind` değerine göre katman seçer:
 *   spider-clock → SpiderClock bileşeni (sistem saati)
 *   pixel-bat    → PixelBat bileşeni (uçan yarasalar)
 *   video        → VideoWallpaper bileşeni (canlı duvar kağıdı)
 *   gradient     → tema renklerinden üretilen gradyan
 *   solid        → tema arkaplan rengi
 *   image        → kullanıcının verdiği yerel yol / URL
 *
 * Üzerine karartma katmanı biner (pencere okunabilirliği için).
 */

import { useSettingsStore } from "../settings/store";
import { PixelBat, SpiderClock, VideoWallpaper } from "../wallpaper";
import "./ThemeBackdrop.css";

export function ThemeBackdrop() {
  const wallpaper = useSettingsStore((state) => state.settings.appearance.wallpaper);
  const theme = useSettingsStore((state) => state.settings.appearance.theme);

  // Dinamik duvar kağıtları kendi bileşenini çizer
  const isAnimated =
    wallpaper.kind === "spider-clock" ||
    wallpaper.kind === "pixel-bat" ||
    wallpaper.kind === "video";

  const style: React.CSSProperties = {};
  if (wallpaper.kind === "image" && wallpaper.source) {
    style.backgroundImage = `url("${wallpaper.source}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }

  return (
    <div className="backdrop" aria-hidden="true">
      {wallpaper.kind === "spider-clock" && <SpiderClock speed={wallpaper.speed} />}
      {wallpaper.kind === "pixel-bat" && <PixelBat speed={wallpaper.speed} />}
      {wallpaper.kind === "video" && (
        <VideoWallpaper source={wallpaper.source} speed={wallpaper.speed} />
      )}

      {!isAnimated && (
        <div className={`backdrop__layer backdrop__layer--${wallpaper.kind}`} style={style} />
      )}

      {!isAnimated && wallpaper.kind !== "image" && <div className="backdrop__stars" />}

      <div className="backdrop__dim" style={{ opacity: wallpaper.dim }} />

      {/* Tema etiketi — teşhis için görünmez, data attribute olarak kalır */}
      <span className="backdrop__theme-marker" data-theme-marker={theme} />
    </div>
  );
}
