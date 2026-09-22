/**
 * Panda Login Form — sevimli panda karakterli giriş formu.
 *
 * Parola alanına odaklanınca panda **gözlerini patileriyle kapatır**.
 * Yanlış girişte panda üzülür, doğru girişte sevinir.
 *
 * Referans: "Panda Login Form" / "panda login page"
 */

import { useEffect, useState } from "react";
import type { LoginFormProps } from "../types";
import { themeVars, useCredentials } from "./useCredentials";
import "./PandaForm.css";

export interface PandaFormProps extends LoginFormProps {
  /** Tam sayfa (koyu bambu ormanı) varyantı */
  variant?: "card" | "page";
}

export function PandaForm({
  theme,
  labels,
  onSubmit,
  loading,
  error,
  disabled,
  submitLabel = "Giriş",
  variant = "card",
}: PandaFormProps) {
  const credentials = useCredentials(onSubmit);
  const [mood, setMood] = useState<"idle" | "happy" | "sad">("idle");

  // Hata gelince panda üzülür
  useEffect(() => {
    if (error) {
      setMood("sad");
      const timer = window.setTimeout(() => setMood("idle"), 1600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [error]);

  return (
    <div className={`lf lf--panda lf--panda-${variant}`} style={themeVars(theme)}>
      <form
        className={variant === "page" ? "panda-page__card login-form" : "login-card login-form"}
        onSubmit={(event) => {
          setMood("happy");
          credentials.submit(event);
        }}
      >
        {/* Panda */}
        <div
          className={`panda${credentials.passwordFocused ? " is-shy" : ""}${
            mood === "sad" ? " is-sad" : ""
          }${mood === "happy" ? " is-happy" : ""}`}
          aria-hidden="true"
        >
          <div className="panda__ear panda__ear--left" />
          <div className="panda__ear panda__ear--right" />
          <div className="panda__head">
            <div className="panda__patch panda__patch--left">
              <span className="panda__eye" />
            </div>
            <div className="panda__patch panda__patch--right">
              <span className="panda__eye" />
            </div>
            <div className="panda__nose" />
          </div>
          {/* Patiler — parolada gözleri kapatır */}
          <div className="panda__paw panda__paw--left" />
          <div className="panda__paw panda__paw--right" />
        </div>

        <h1 className="login-card__title">
          {credentials.passwordFocused ? "Bakmıyorum! 🙈" : "Merhaba!"}
        </h1>
        <p className="login-card__subtitle">
          {credentials.passwordFocused ? "Parolanı güvenle yazabilirsin" : "Giriş yapmaya hazır mısın?"}
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

      {/* Tam sayfa varyantında bambu ormanı */}
      {variant === "page" && (
        <div className="bamboo" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="bamboo__stalk" style={{ animationDelay: `${index * 0.6}s` }}>
              {Array.from({ length: 7 }, (__, node) => (
                <i key={node} className="bamboo__node" />
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
