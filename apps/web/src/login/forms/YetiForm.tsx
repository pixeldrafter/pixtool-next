/**
 * Yeti Login Form Animation.
 *
 * ⚠️ Referans tasarımın portu:
 *    _referans/hosuma-giden-icerikler/Yeti Login Form Animation/
 *
 * Yapı ve CSS **birebir** alındı (`yeti.css`), karakter SVG'si JSX'e çevrildi
 * (`YetiSvg.tsx`). Görsel tasarım orijinaliyle aynıdır.
 *
 * ⚠️ Fark: Orijinal `script.js` (397 satır) GSAP + **MorphSVGPlugin** ile
 * kolların/ağzın şeklini morph ediyor. MorphSVGPlugin GSAP'in **ücretli**
 * (Club GreenSock) eklentisidir. Burada aynı etki **CSS dönüşümleriyle**
 * yaklaşık olarak sağlanır:
 *   • Parola alanına odaklanınca yeti kollarını kaldırıp gözlerini kapatır
 *   • Gözler periyodik kırpar
 */

import { useState } from "react";

import type { LoginFormProps } from "../types";
import { YetiSvg } from "./YetiSvg";
import "./yeti.css";

export function YetiForm({
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Log in",
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shy, setShy] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    onSubmit({ username: email.trim(), password });
  }

  return (
    <div className={`lf--yeti${shy ? " is-shy" : ""}`}>
      <form onSubmit={submit}>
        <div className="svgContainer">
          <div>
            <YetiSvg className="mySVG" />
          </div>
        </div>

        <div className="inputGroup inputGroup1">
          <label htmlFor="loginEmail" id="loginEmailLabel">
            Email
          </label>
          <input
            type="email"
            id="loginEmail"
            maxLength={254}
            autoComplete="username"
            value={email}
            disabled={disabled || loading}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="helper helper1">email@domain.com</p>
        </div>

        <div className="inputGroup inputGroup2">
          <label htmlFor="loginPassword" id="loginPasswordLabel">
            Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            id="loginPassword"
            autoComplete="current-password"
            value={password}
            disabled={disabled || loading}
            onFocus={() => setShy(true)}
            onBlur={() => setShy(false)}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label id="showPasswordToggle" htmlFor="showPasswordCheck">
            Show
            <input
              id="showPasswordCheck"
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <div className="indicator" />
          </label>
        </div>

        {error && <p className="lf-error lf-error--yeti">{error}</p>}

        <div className="inputGroup inputGroup3">
          <button id="login" type="submit" disabled={disabled || loading}>
            {loading ? "…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
