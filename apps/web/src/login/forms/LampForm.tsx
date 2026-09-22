/**
 * Login Form Lamp — varsayılan giriş formu.
 *
 * Kartın üzerinde bir lamba asılıdır. Bir alana odaklanınca ya da giriş
 * yapılırken **lamba yanar**: sıcak bir ışık konisi kartı aydınlatır.
 *
 * Referans: "Login Form Lamp" — mantık korundu, React + tema sistemiyle yeniden yazıldı.
 */

import { useState } from "react";
import type { LoginFormProps } from "../types";
import { themeVars, useCredentials } from "./useCredentials";
import "./LampForm.css";

export function LampForm({
  theme,
  labels,
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Giriş Yap",
}: LoginFormProps) {
  const credentials = useCredentials(onSubmit);
  const [lit, setLit] = useState(false);

  const isLit = lit || credentials.passwordFocused || Boolean(credentials.username);

  return (
    <div className="lf lf--lamp" style={themeVars(theme)}>
      {/* Lamba */}
      <div className={`lamp${isLit ? " is-lit" : ""}`} aria-hidden="true">
        <div className="lamp__cord" />
        <div className="lamp__cap" />
        <div className="lamp__cone" />
        <div className="lamp__bulb" />
      </div>

      <form
        className="login-card login-form"
        onSubmit={(event) => {
          setLit(true);
          credentials.submit(event);
        }}
        onBlur={() => setLit(false)}
      >
        <h1 className="login-card__title">Hoş geldin</h1>
        <p className="login-card__subtitle">Devam etmek için giriş yap</p>

        {error && (
          <div className="login-form__error" role="alert">
            <span aria-hidden="true">⚠</span>
            {error}
          </div>
        )}

        <label className="login-form__field">
          <span className="login-form__label">{labels.username}</span>
          <input
            className="login-form__input"
            type="text"
            autoComplete="username"
            placeholder="kullanıcı adınız"
            value={credentials.username}
            disabled={disabled || loading}
            onChange={(event) => credentials.setUsername(event.target.value)}
          />
        </label>

        <label className="login-form__field">
          <span className="login-form__label">{labels.password}</span>
          <input
            className="login-form__input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={credentials.password}
            disabled={disabled || loading}
            onFocus={() => credentials.setPasswordFocused(true)}
            onBlur={() => credentials.setPasswordFocused(false)}
            onChange={(event) => credentials.setPassword(event.target.value)}
          />
        </label>

        <button
          className="login-form__submit"
          type="submit"
          disabled={disabled || loading || !credentials.username || !credentials.password}
        >
          {loading && <span className="login-form__spinner" />}
          {loading ? "Kontrol ediliyor…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
