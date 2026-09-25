/**
 * Login Form Lamp — VARSAYILAN giriş formu.
 *
 * ⚠️ Bu bileşen referans tasarımın **birebir** portudur:
 *    _referans/hosuma-giden-icerikler/Login Form Lamp/
 *
 * Yapı ve sınıf adları orijinaliyle aynıdır; stil `lamp.css` içinde
 * referanstan kopyalanmıştır. Tek fark: GSAP + Draggable yerine
 * **pointer olayları** kullanılır (bağımlılıksız).
 *
 * Davranış (orijinalle aynı):
 *   • Lamba ipini aşağı sürükle → lamba yanar → form belirir
 *   • Tekrar çek → lamba söner → form kaybolur
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { LoginFormProps } from "../types";
import { LOGIN_TEXT } from "../text";
import { useSettingsStore } from "../../settings/store";
import "./lamp.css";

/** Ses — referanstaki CodePen URL'i yerine yerel kopya. */
const CLICK_SOUND = "/audio/bulb/click.mp3";

/** SVG kullanıcı birimi cinsinden ipin çekilebileceği en fazla mesafe. */
const MAX_PULL = 60;

/** Bu eşiğin üzerinde çekilirse lamba açılır/kapanır. */
const PULL_THRESHOLD = 30;

export function LampForm({
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = LOGIN_TEXT.signIn,
  onRegister,
  onForgot,
}: LoginFormProps) {
  // Ayardan: lamba açılışta yanık başlasın mı (form görünür olsun mu)
  const startLit = useSettingsStore((state) => state.settings.login.lampStartLit);
  const [isOn, setIsOn] = useState(startLit);
  const [pullY, setPullY] = useState(0);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const svgRef = useRef<SVGSVGElement>(null);

  // Sesi bir kez hazırla
  const soundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(CLICK_SOUND);
    audio.volume = 0.45;
    audio.preload = "auto";
    soundRef.current = audio;
    return () => {
      soundRef.current = null;
    };
  }, []);

  const toggleLamp = useCallback(() => {
    setIsOn((value) => !value);
    void soundRef.current?.play().catch(() => {
      /* tarayıcı otomatik oynatmayı engelledi */
    });
  }, []);

  /**
   * İp sürükleme.
   * Ekran koordinatı → SVG kullanıcı birimine çevrilir.
   */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const scaleY = rect.height > 0 ? 300 / rect.height : 1;
      const startY = event.clientY;

      const onMove = (moveEvent: PointerEvent) => {
        const delta = (moveEvent.clientY - startY) * scaleY;
        setPullY(Math.max(0, Math.min(MAX_PULL, delta)));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const delta = (upEvent.clientY - startY) * scaleY;
        if (delta > PULL_THRESHOLD) {
          toggleLamp();
        }
        setPullY(0);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [toggleLamp],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit({ username: username.trim(), password });
  }

  return (
    <div className={`lf--lamp${isOn ? " is-on" : ""}`}>
      <div className="container" data-on={isOn ? "true" : "false"} style={{ ["--on" as string]: isOn ? 1 : 0 }}>
        <div className="lamp-wrapper">
          <svg
            ref={svgRef}
            className="lamp-svg"
            viewBox="0 0 200 300"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse className="inner-glow" cx="100" cy="110" rx="60" ry="30" />

            <rect className="lamp-base" x="92" y="100" width="16" height="160" rx="8" />
            <rect className="lamp-base" x="60" y="250" width="80" height="12" rx="6" />

            <g className="pull-cord">
              <line className="cord-line" x1="130" y1="110" x2="130" y2={180 + pullY} />
              <circle className="cord-bead" cx="130" cy={190 + pullY} r="6" />
              <circle
                className="cord-hit"
                cx="130"
                cy="190"
                r="25"
                fill="transparent"
                onPointerDown={handlePointerDown}
              />
            </g>

            <path
              className="lamp-shade"
              d="M30 110 C 30 50, 170 50, 170 110 C 170 125, 30 125, 30 110 Z"
            />
          </svg>
        </div>

        <div className={`login-form${isOn ? " active" : ""}`}>
          <h2>{LOGIN_TEXT.welcome}</h2>

          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="lamp-username">{LOGIN_TEXT.username}</label>
              <input
                id="lamp-username"
                type="text"
                placeholder={LOGIN_TEXT.usernamePlaceholder}
                autoComplete="username"
                value={username}
                disabled={disabled || loading}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lamp-password">{LOGIN_TEXT.password}</label>
              <input
                id="lamp-password"
                type="password"
                placeholder={LOGIN_TEXT.passwordPlaceholder}
                autoComplete="current-password"
                value={password}
                disabled={disabled || loading}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && <p className="lf-error">{error}</p>}

            <button className="login-btn" type="submit" disabled={disabled || loading}>
              {loading ? LOGIN_TEXT.signingIn : submitLabel}
            </button>

            {/* Kayıt / parola bağlantıları */}
            <div className="lf-links">
              <button
                type="button"
                className="lf-link"
                disabled={disabled || loading}
                onClick={() => onForgot?.(username.trim())}
              >
                {LOGIN_TEXT.forgot}
              </button>
              <span className="lf-links__sep">·</span>
              <button
                type="button"
                className="lf-link"
                disabled={disabled || loading}
                onClick={() => onRegister?.()}
              >
                {LOGIN_TEXT.register}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
