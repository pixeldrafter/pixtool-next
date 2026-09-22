/**
 * Animated Border Login Form — dönen neon kenarlıklı giriş formu.
 *
 * Kartın çevresinde bir gradyan kenarlık sürekli döner. Form gönderilirken
 * dönüş hızlanır.
 *
 * Referans: "Animated Border Login Form"
 */

import type { LoginFormProps } from "../types";
import { themeVars, useCredentials } from "./useCredentials";
import "./AnimatedBorderForm.css";

export function AnimatedBorderForm({
  theme,
  labels,
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Giriş yap",
}: LoginFormProps) {
  const credentials = useCredentials(onSubmit);

  return (
    <div className="lf lf--border" style={themeVars(theme)}>
      <div className={`border-box${loading ? " is-busy" : ""}`}>
        {/* Dönen kenarlık katmanı */}
        <div className="border-box__glow" aria-hidden="true" />

        <form className="border-box__inner login-form" onSubmit={credentials.submit}>
          <h1 className="login-card__title">Giriş</h1>
          <p className="login-card__subtitle">Yetkili erişim</p>

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

          <div className="login-form__row">
            <button className="login-form__link" type="button">
              Parolamı unuttum
            </button>
            <button className="login-form__link" type="button">
              Kayıt ol
            </button>
          </div>

          <button
            className="login-form__submit"
            type="submit"
            disabled={disabled || loading || !credentials.username || !credentials.password}
          >
            {loading && <span className="login-form__spinner" />}
            {loading ? "Doğrulanıyor…" : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
