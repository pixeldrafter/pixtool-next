/**
 * Giriş ekranı üst katmanları — kayan şerit ve telif hakkı.
 *
 * Formlar kendi tam ekran düzenlerini getirdiği için bu parçalar ayrı
 * katmanlar hâlinde çizilir; forma hiçbir düzen müdahalesi yapılmaz.
 *
 * Renkler `--marquee-*` / `--copyright-*` CSS değişkenleriyle verilir;
 * her login teması kendi paletini `themes.ts` üzerinden sağlar.
 */

import { LOGIN_TEXT, MARQUEE_DURATION } from "./text";
import "./LoginOverlays.css";

/** Şeritte kaç kez tekrarlanacak (dikişsiz döngü için 2 yeterli). */
const REPEATS = 2;

/** Şerit içinde kaç öğe olsun (ekranı doldursun). */
const ITEMS_PER_CHUNK = 6;

interface LoginMarqueeProps {
  /** Tur süresi (saniye) */
  duration?: number;
  /** Metin (varsayılan: LOGIN_TEXT.marquee) */
  text?: string;
  /** Kapalıysa hiç çizilmez */
  enabled?: boolean;
}

export function LoginMarquee({
  duration = MARQUEE_DURATION,
  text = LOGIN_TEXT.marquee,
  enabled = true,
}: LoginMarqueeProps) {
  if (!enabled) return null;

  return (
    <div
      className="login-marquee"
      style={{ ["--marquee-duration" as string]: `${duration}s` }}
      aria-hidden="true"
    >
      <div className="login-marquee__track">
        {Array.from({ length: REPEATS }, (_, chunk) => (
          <div className="login-marquee__chunk" key={chunk}>
            {Array.from({ length: ITEMS_PER_CHUNK }, (_, index) => (
              <span className="login-marquee__item" key={index}>
                {text}
                <span className="login-marquee__dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoginCopyrightProps {
  /** Metin (varsayılan: LOGIN_TEXT.copyright) */
  text?: string;
  enabled?: boolean;
}

export function LoginCopyright({ text = LOGIN_TEXT.copyright, enabled = true }: LoginCopyrightProps) {
  if (!enabled) return null;

  return (
    <div className="login-copyright">
      <span className="login-copyright__inner">
        <span className="login-copyright__beacon" aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}
