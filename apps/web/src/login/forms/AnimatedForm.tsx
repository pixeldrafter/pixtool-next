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
import "./animated.css";

/** Referanstaki yüzen küre sayısı. */
const BUBBLE_COUNT = 13;

export function AnimatedForm({ onSubmit, loading, error, disabled, submitLabel = "Login" }: LoginFormProps) {
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
          <h2>Login</h2>
          <form onSubmit={submit}>
            <div className="input-box">
              <input
                id="animated-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                disabled={disabled || loading}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="animated-email">Email</label>
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
              <label htmlFor="animated-password">Password</label>
            </div>

            {error && <p className="lf-error">{error}</p>}

            <div className="forgot-password">
              <a href="#forgot" onClick={(event) => event.preventDefault()}>
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="btn" disabled={disabled || loading}>
              {loading ? "…" : submitLabel}
            </button>

            <div className="signup-link">
              <a href="#signup" onClick={(event) => event.preventDefault()}>
                Signup
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
