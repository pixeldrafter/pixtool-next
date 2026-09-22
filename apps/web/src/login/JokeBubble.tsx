/**
 * Şaka balonu.
 *
 * Kullanıcı isteği: her login formunun **kendi temasına uygun** görselle
 * sunulur ve rastgele döner.
 *
 * Biçimler (`theme.jokeStyle`):
 *   card     → sıcak kart (lamba)
 *   speech   → konuşma balonu (panda)
 *   terminal → terminal satırı (neon kenarlık)
 *   ticker   → kayan şerit (animasyonlu form)
 *   frost    → buzlu cam kart (yeti)
 */

import { useEffect, useState } from "react";

import { randomJoke } from "./jokes";
import type { LoginTheme } from "./types";
import "./JokeBubble.css";

interface JokeBubbleProps {
  theme: LoginTheme;
  /** Kaç saniyede bir değişsin (0 = sabit) */
  rotateSeconds: number;
  enabled: boolean;
}

export function JokeBubble({ theme, rotateSeconds, enabled }: JokeBubbleProps) {
  const [joke, setJoke] = useState(() => randomJoke());

  useEffect(() => {
    if (!enabled || rotateSeconds <= 0) return undefined;

    const timer = window.setInterval(() => {
      setJoke((previous) => randomJoke(previous));
    }, rotateSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [enabled, rotateSeconds]);

  if (!enabled) return null;

  const style: React.CSSProperties = {
    ["--joke-accent" as string]: theme.colors.accent,
    ["--joke-border" as string]: theme.colors.border,
    ["--joke-text" as string]: theme.colors.text,
    ["--joke-muted" as string]: theme.colors.muted,
    ["--joke-surface" as string]: theme.colors.surface,
    ["--joke-font" as string]: theme.font,
  };

  // Terminal biçimi özel işaretleme ister
  if (theme.jokeStyle === "terminal") {
    return (
      <div className="joke joke--terminal" style={style} key={joke}>
        <span className="joke__prompt">$</span>
        <span className="joke__text">{joke}</span>
        <span className="joke__caret" />
      </div>
    );
  }

  if (theme.jokeStyle === "ticker") {
    return (
      <div className="joke joke--ticker" style={style}>
        <div className="joke__track" key={joke}>
          <span className="joke__text">{joke}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`joke joke--${theme.jokeStyle}`} style={style} key={joke}>
      <span className="joke__icon" aria-hidden="true">
        {theme.jokeStyle === "speech" ? "💬" : theme.jokeStyle === "frost" ? "❄" : "✦"}
      </span>
      <span className="joke__text">{joke}</span>
    </div>
  );
}
