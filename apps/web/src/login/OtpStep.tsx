/**
 * OTP adımı.
 *
 * Kullanıcı 6 haneli kodu girer. Görünüm **seçili login formunun temasına**
 * uyar (`theme.otpStyle`):
 *   boxes     → yuvarlak kutular (lamba)
 *   underline → alt çizgili haneler (animasyonlu form)
 *   glow      → neon parlayan kutular (kenarlık formu)
 *   paws      → pati izli kutular (panda)
 *   snow      → kar taneli kutular (yeti)
 *
 * 3 yanlış denemede `LoginScreen` ceza ekranını açar.
 */

import { useEffect, useRef, useState } from "react";

import type { LoginTheme, OtpChallenge } from "./types";
import "./OtpStep.css";

interface OtpStepProps {
  theme: LoginTheme;
  challenge: OtpChallenge;
  /** Doğrulama sürüyor mu */
  verifying: boolean;
  /** Hata mesajı */
  error: string | null;
  /** Kodu gönder */
  onSubmit: (code: string) => void;
  /** Tekrar gönder */
  onResend: () => void;
  /** Vazgeç — giriş ekranına dön */
  onCancel: () => void;
}

export function OtpStep({
  theme,
  challenge,
  verifying,
  error,
  onSubmit,
  onResend,
  onCancel,
}: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(challenge.length).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // İlk kutuya odaklan
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Hata gelince kod temizlenir
  useEffect(() => {
    if (error) {
      setDigits(Array(challenge.length).fill(""));
      inputsRef.current[0]?.focus();
    }
  }, [error, challenge.length]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) return;

    // Yapıştırma: birden fazla hane geldiyse dağıt
    const next = [...digits];
    if (clean.length > 1) {
      for (let offset = 0; offset < clean.length && index + offset < digits.length; offset += 1) {
        next[index + offset] = clean[offset] ?? "";
      }
      setDigits(next);
      const lastIndex = Math.min(index + clean.length - 1, digits.length - 1);
      inputsRef.current[lastIndex]?.focus();
    } else {
      next[index] = clean;
      setDigits(next);
      if (index < digits.length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    }

    // Tamamlandıysa otomatik gönder
    const candidate = (clean.length > 1 ? next : next).join("");
    if (candidate.length === digits.length && !candidate.includes("")) {
      onSubmit(candidate);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
      } else if (index > 0) {
        next[index - 1] = "";
        inputsRef.current[index - 1]?.focus();
      }
      setDigits(next);
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < digits.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  const style: React.CSSProperties = {
    ["--otp-accent" as string]: theme.colors.accent,
    ["--otp-border" as string]: theme.colors.border,
    ["--otp-text" as string]: theme.colors.text,
    ["--otp-muted" as string]: theme.colors.muted,
    ["--otp-error" as string]: theme.colors.error,
    ["--otp-surface" as string]: theme.colors.surface,
    ["--otp-font" as string]: theme.font,
  };

  const code = digits.join("");

  return (
    <div className={`otp otp--${theme.otpStyle}`} style={style}>
      <div className="otp__card">
        <div className="otp__icon" aria-hidden="true">
          {theme.otpStyle === "paws" ? "🐾" : theme.otpStyle === "snow" ? "❄" : "🔐"}
        </div>

        <h2 className="otp__title">İki adımlı doğrulama</h2>
        <p className="otp__subtitle">
          {challenge.length} haneli kod <strong>{challenge.channelLabel}</strong> kanalına gönderildi
        </p>

        {challenge.devCode && (
          <div className="otp__dev-hint">
            <span aria-hidden="true">🧪</span>
            Geliştirme kipi — kod: <strong className="mono">{challenge.devCode}</strong>
            <small>(Telegram/n8n yapılandırılınca kaybolur)</small>
          </div>
        )}

        {error && (
          <div className="otp__error" role="alert">
            {error}
            <span className="otp__attempts">
              {challenge.attemptsLeft > 0
                ? `${challenge.attemptsLeft} deneme hakkın kaldı`
                : "Deneme hakkın doldu"}
            </span>
          </div>
        )}

        <div className="otp__inputs">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              className={`otp__input${digit ? " is-filled" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={challenge.length}
              value={digit}
              disabled={verifying}
              aria-label={`${index + 1}. hane`}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
            />
          ))}
        </div>

        <button
          className="otp__submit"
          type="button"
          disabled={verifying || code.length !== challenge.length || code.includes("")}
          onClick={() => onSubmit(code)}
        >
          {verifying ? "Doğrulanıyor…" : "Doğrula"}
        </button>

        <div className="otp__actions">
          <button className="otp__link" type="button" onClick={onResend} disabled={verifying}>
            Kodu tekrar gönder
          </button>
          <button className="otp__link" type="button" onClick={onCancel} disabled={verifying}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
