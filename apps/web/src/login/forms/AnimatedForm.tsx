/**
 * Animated Login Form.
 *
 * ⚠️ Referans tasarımın **birebir** portu:
 *    _referans/hosuma-giden-icerikler/Animated Login Form/
 *
 * Yapı: `.container > .login-box` + 13 adet animasyonlu `span` (yüzen küreler).
 * Stil `animated.css` içinde referanstan kopyalanmıştır.
 */

import { useState } from "react";

import type { LoginFormProps } from "../types";
import { LOGIN_TEXT } from "../text";
import "./animated.css";

/** Referanstaki yüzen küre sayısı. */
const BUBBLE_COUNT = 13;

export function AnimatedForm({ onSubmit, loading, error, disabled, submitLabel = LOGIN_TEXT.signIn, onRegister, onForgot }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    onSubmit({ username: email.trim(), password });
  }

  return (
    <div className="lf--animated">
      <div className="container">
        <div className="login-box">
          <h2>{LOGIN_TEXT.welcome}</h2>
          <form onSubmit={submit}>
            <div className="input-box">
              <input
                id="animated-email"
                type="text"
                required
                autoComplete="username"
                value={email}
                disabled={disabled || loading}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="animated-email">{LOGIN_TEXT.username}</label>
            </div>

            <div className="input-box">
              <input
                id="animated-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                disabled={disabled || loading}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label htmlFor="animated-password">{LOGIN_TEXT.password}</label>
            </div>

            {error && <p className="lf-error">{error}</p>}

            <div className="forgot-password">
              <a
                href="#forgot"
                onClick={(event) => {
                  event.preventDefault();
                  onForgot?.(email.trim());
                }}
              >
                {LOGIN_TEXT.forgot}
              </a>
            </div>

            <button type="submit" className="btn" disabled={disabled || loading}>
              {loading ? LOGIN_TEXT.signingIn : submitLabel}
            </button>

            <div className="signup-link">
              <a
                href="#signup"
                onClick={(event) => {
                  event.preventDefault();
                  onRegister?.();
                }}
              >
                {LOGIN_TEXT.register}
              </a>
            </div>
          </form>
        </div>

        {/* Yüzen küreler — referanstaki yapı */}
        {Array.from({ length: BUBBLE_COUNT }, (_, index) => (
          <span key={index} style={{ ["--i" as string]: index }} />
        ))}
      </div>
    </div>
  );
}
