/**
 * Boşta kalma ekranı.
 *
 * Ayardaki `idle.screen` değerine göre Pixel Bat / Spider Clock / siyah ekran
 * gösterir. Herhangi bir etkileşimde kapanır.
 *
 * `power.animatedShutdown` kapalıysa hiç görünmez.
 */

import { useSettingsStore } from "../settings/store";
import { PixelBat, SpiderClock } from "../wallpaper";
import "./IdleScreen.css";

interface IdleScreenProps {
  onDismiss: () => void;
}

export function IdleScreen({ onDismiss }: IdleScreenProps) {
  const idle = useSettingsStore((state) => state.settings.idle);

  const style =
    idle.screen === "pixel-bat"
      ? { background: "linear-gradient(160deg, #05070a 0%, #0a0616 50%, #05070a 100%)" }
      : undefined;

  return (
    <div
      className={`idle-screen idle-screen--${idle.screen}`}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={onDismiss}
      aria-label="Devam etmek için tıklayın"
    >
      {idle.screen === "pixel-bat" && <PixelBat speed={0.7} />}
      {idle.screen === "spider-clock" && <SpiderClock speed={1} />}

      <div className="idle-screen__hint">
        <span className="mono">
          {idle.requirePassword ? "🔒 Kilitli — devam için giriş gerekli" : "▶ Devam etmek için tıkla"}
        </span>
      </div>
    </div>
  );
}
