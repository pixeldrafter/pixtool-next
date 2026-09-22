/**
 * Panda Login Form (kart ve tam sayfa varyantları).
 *
 * ⚠️ Referans tasarımın **birebir** portu:
 *    _referans/hosuma-giden-icerikler/Panda Login Form/panda login page/
 *
 * Yapı: `.container > form` + panda parçaları
 * (ear-l/ear-r, panda-face → blush/eye/nose/mouth, hand-l/r, paw-l/r).
 * Stil `panda.css` içinde referanstan kopyalanmıştır.
 *
 * Orijinal davranış: parola alanına odaklanınca panda elleriyle gözlerini
 * kapatır (`script.js`). Burada CSS `:focus-within` ile aynı etki sağlanır.
 */

import { useState } from "react";

import type { LoginFormProps } from "../types";
import "./panda.css";

export interface PandaFormProps extends LoginFormProps {
  variant?: "card" | "page";
}

export function PandaForm({
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Login",
}: PandaFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shy, setShy] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit({ username: username.trim(), password });
  }

  return (
    <div className={`lf--panda${shy ? " is-shy" : ""}`}>
      <div className="container">
        <form onSubmit={submit}>
          <label htmlFor="panda-username">Username:</label>
          <input
            id="panda-username"
            type="text"
            placeholder="Username here..."
            autoComplete="username"
            value={username}
            disabled={disabled || loading}
            onChange={(event) => setUsername(event.target.value)}
          />
          <br />

          <label htmlFor="panda-password">Password:</label>
          <input
            id="panda-password"
            type="password"
            placeholder="Password here..."
            autoComplete="current-password"
            value={password}
            disabled={disabled || loading}
            onFocus={() => setShy(true)}
            onBlur={() => setShy(false)}
            onChange={(event) => setPassword(event.target.value)}
          />
          <br />

          {error && <p className="lf-error">{error}</p>}

          <button type="submit" disabled={disabled || loading}>
            {loading ? "…" : submitLabel}
          </button>
        </form>

        {/* Panda — referanstaki yapı */}
        <div className="ear-l" />
        <div className="ear-r" />
        <div className="panda-face">
          <div className="blush-l" />
          <div className="blush-r" />
          <div className="eye-l">
            <div className="eyeball-l" />
          </div>
          <div className="eye-r">
            <div className="eyeball-r" />
          </div>
          <div className="nose" />
          <div className="mouth" />
        </div>
        <div className="hand-l" />
        <div className="hand-r" />
        <div className="paw-l" />
        <div className="paw-r" />
      </div>
    </div>
  );
}
