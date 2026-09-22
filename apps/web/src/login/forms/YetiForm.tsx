/**
 * Yeti Login Form Animation — kar temalı giriş formu.
 *
 * Kar taneleri düşer, bir yeti silüeti bekler. Parola yazılırken yeti
 * arkasını döner (gizlilik!).
 *
 * Referans: "Yeti Login Form Animation" (16 KB html + 17 KB js) —
 * burada bağımlılıksız, React + tema sistemiyle yeniden yazıldı.
 */

import { useMemo } from "react";
import type { LoginFormProps } from "../types";
import { themeVars, useCredentials } from "./useCredentials";
import "./YetiForm.css";

export function YetiForm({
  theme,
  labels,
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Giriş yap",
}: LoginFormProps) {
  const credentials = useCredentials(onSubmit);

  // Kar taneleri — sabit tohumla üretilir, her render'da değişmez
  const snow = useMemo(
    () =>
      Array.from({ length: 44 }, (_, index) => ({
        id: index,
        left: (index * 37 + 11) % 100,
        delay: ((index * 53) % 90) / 10,
        duration: 6 + ((index * 17) % 70) / 10,
        size: 2 + ((index * 7) % 4),
        drift: ((index * 29) % 60) - 30,
      })),
    [],
  );

  return (
    <div className="lf lf--yeti" style={themeVars(theme)}>
      {/* Kar */}
      <div className="snow" aria-hidden="true">
        {snow.map((flake) => (
          <span
            key={flake.id}
            className="snow__flake"
            style={{
              left: `${flake.left}%`,
              width: flake.size,
              height: flake.size,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`,
              ["--drift" as string]: `${flake.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Yeti silüeti */}
      <div className={`yeti${credentials.passwordFocused ? " is-turned" : ""}`} aria-hidden="true">
        <div className="yeti__body">
          <div className="yeti__fur" />
          <div className="yeti__face">
            <span className="yeti__eye yeti__eye--left" />
            <span className="yeti__eye yeti__eye--right" />
            <span className="yeti__mouth" />
          </div>
          <div className="yeti__horn yeti__horn--left" />
          <div className="yeti__horn yeti__horn--right" />
        </div>
        <div className="yeti__paw yeti__paw--left" />
        <div className="yeti__paw yeti__paw--right" />
      </div>

      <form className="login-card login-form" onSubmit={credentials.submit}>
        <h1 className="login-card__title">
          {credentials.passwordFocused ? "Yeti arkasını döndü ❄" : "Soğuk bir giriş"}
        </h1>
        <p className="login-card__subtitle">
          {credentials.passwordFocused
            ? "Parolanı rahatça yazabilirsin"
            : "Kar burada hiç durmaz, sen de giriş yap"}
        </p>

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
            placeholder="kullanıcı adı"
            value={credentials.username}
            disabled={disabled || loading}
            onChange={(event) => credentials.setUsername(event.target.value)}
          />
        </label>

        <label className="login-form__field">
          <span className="login-form__label">{labels.password}</span>
          <div className="login-form__password-row">
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
            <span className="login-form__hint">Göster</span>
          </div>
        </label>

        <button
          className="login-form__submit"
          type="submit"
          disabled={disabled || loading || !credentials.username || !credentials.password}
        >
          {loading && <span className="login-form__spinner" />}
          {loading ? "Buz çözülüyor…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
