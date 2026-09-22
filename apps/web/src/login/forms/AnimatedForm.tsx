/**
 * Animated Login Form — kayan etiketli (floating label) giriş formu.
 *
 * Referans: "Animated Login Form" — etiketler odak/doluluk durumunda yukarı
 * kayar, alt çizgi vurgu rengiyle dolar.
 */

import type { LoginFormProps } from "../types";
import { themeVars, useCredentials } from "./useCredentials";
import "./AnimatedForm.css";

export function AnimatedForm({
  theme,
  labels,
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Giriş",
}: LoginFormProps) {
  const credentials = useCredentials(onSubmit);

  return (
    <div className="lf lf--animated" style={themeVars(theme)}>
      <form className="login-card login-form" onSubmit={credentials.submit}>
        <h1 className="login-card__title">Giriş</h1>
        <p className="login-card__subtitle">Hesabınla devam et</p>

        {error && (
          <div className="login-form__error" role="alert">
            <span aria-hidden="true">⚠</span>
            {error}
          </div>
        )}

        <div className={`float-field${credentials.username ? " is-filled" : ""}`}>
          <input
            className="float-field__input"
            id="animated-username"
            type="text"
            autoComplete="username"
            value={credentials.username}
            disabled={disabled || loading}
            onChange={(event) => credentials.setUsername(event.target.value)}
          />
          <label className="float-field__label" htmlFor="animated-username">
            {labels.username}
          </label>
          <span className="float-field__bar" />
        </div>

        <div className={`float-field${credentials.password ? " is-filled" : ""}`}>
          <input
            className="float-field__input"
            id="animated-password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            disabled={disabled || loading}
            onFocus={() => credentials.setPasswordFocused(true)}
            onBlur={() => credentials.setPasswordFocused(false)}
            onChange={(event) => credentials.setPassword(event.target.value)}
          />
          <label className="float-field__label" htmlFor="animated-password">
            {labels.password}
          </label>
          <span className="float-field__bar" />
        </div>

        <div className="login-form__row">
          <label className="login-form__checkbox">
            <input type="checkbox" defaultChecked />
            Beni hatırla
          </label>
          <button className="login-form__link" type="button">
            Parolamı unuttum
          </button>
        </div>

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
