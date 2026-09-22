/**
 * Animated Border Login Form.
 *
 * ⚠️ Referans tasarımın **birebir** portu:
 *    _referans/hosuma-giden-icerikler/Animated Border Login Form/
 *
 * Yapı: `.box > .login > .loginBx` + dönen kenarlık.
 * Stil `animatedBorder.css` içinde referanstan kopyalanmıştır.
 */

import { useState } from "react";

import type { LoginFormProps } from "../types";
import "./animatedBorder.css";

export function AnimatedBorderForm({
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Sign in",
}: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit({ username: username.trim(), password });
  }

  return (
    <div className="lf--border">
      <div className="box">
        <div className="login">
          <div className="loginBx">
            <h2>
              <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
              Login
              <i className="fa-solid fa-heart" aria-hidden="true" />
            </h2>

            <form onSubmit={submit}>
              <input
                type="text"
                placeholder="Username"
                autoComplete="username"
                value={username}
                disabled={disabled || loading}
                onChange={(event) => setUsername(event.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                disabled={disabled || loading}
                onChange={(event) => setPassword(event.target.value)}
              />

              {error && <p className="lf-error">{error}</p>}

              <input
                type="submit"
                value={loading ? "…" : submitLabel}
                disabled={disabled || loading}
              />
            </form>

            <div className="group">
              <a href="#forgot" onClick={(event) => event.preventDefault()}>
                Forgot Password
              </a>
              <a href="#signup" onClick={(event) => event.preventDefault()}>
                Sign up
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
