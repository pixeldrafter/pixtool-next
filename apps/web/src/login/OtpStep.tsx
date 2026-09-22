/**
 * OTP adımı — animasyonlu.
 *
 * Görsel durumlar:
 *   idle      → normal
 *   verifying → kutular nabız atar
 *   error     → kutular KIRMIZIYA döner ve SALLANIR (yanlış kod)
 *   success   → kutular SIRAYLA YEŞİLE döner ve ZIPLAR (doğru kod)
 *
 * Görünüm **seçili login formunun temasına** uyar (`theme.otpStyle`):
 *   boxes     → yuvarlak kutular (lamba)
 *   underline → alt çizgili haneler (animasyonlu form)
 *   glow      → neon parlayan kutular (kenarlık formu)
 *   paws      → pati izli kutular (panda)
 *   snow      → kar taneli kutular (yeti)
 */

import { useEffect, useRef, useState } from "react";

import type { LoginTheme, OtpChallenge, OtpStatus } from "./types";
import { OTP_SUCCESS_DURATION_MS } from "./useLoginFlow";
import "./OtpStep.css";

interface OtpStepProps {
  theme: LoginTheme;
  challenge: OtpChallenge;
  /** Görsel durum — akıştan gelir */
  status: OtpStatus;
  /** Hata mesajı */
  error: string | null;
  /** Kodu gönder */
  onSubmit: (code: string) => void;
  /** Tekrar gönder */
  onResend: () => void;
  /** Vazgeç — giriş ekranına dön */
  onCancel: () => void;
  /** Animasyonu atla (Enter/boşluk) */
  onSkipAnimation?: () => void;
}

/** Doğru kodda kutuların sırayla yanma gecikmesi (ms). */
const SUCCESS_STAGGER_MS = 70;

export function OtpStep({
  theme,
  challenge,
  status,
  error,
  onSubmit,
  onResend,
  onCancel,
  onSkipAnimation,
}: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(challenge.length).fill(""));
  /** Son gönderilen kod — başarı animasyonunda gösterilir */
  const [submittedCode, setSubmittedCode] = useState("");

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // İlk kutuya odaklan
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Hata → önce yanlış kod KIRMIZI olarak görünsün, sonra temizlensin
  useEffect(() => {
    if (status !== "error") return;

    const clearTimer = window.setTimeout(() => {
      setDigits(Array(challenge.length).fill(""));
      setSubmittedCode("");
      inputsRef.current[0]?.focus();
    }, 900);

    return () => window.clearTimeout(clearTimer);
  }, [status, challenge.length]);

  // Başarı → girilen kodu koru (yeşil animasyon için)
  useEffect(() => {
    if (status === "success" && submittedCode) {
      setDigits(submittedCode.split("").slice(0, challenge.length));
    }
  }, [status, submittedCode, challenge.length]);

  // Başarı/hatada Enter ile animasyonu geç
  useEffect(() => {
    if (!onSkipAnimation) return undefined;
    if (status !== "success" && status !== "error") return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSkipAnimation?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, onSkipAnimation]);

  const locked = status === "verifying" || status === "success";

  /**
   * Tüm haneler dolu mu?
   *
   * ⚠️ `code.includes("")` KULLANILMAZ: boş string her stringin içinde
   * bulunduğu için o ifade **her zaman `true`** döner ve buton hiç
   * aktifleşmez. (Önceki sürümdeki hata buydu.)
   */
  function isComplete(values: string[]): boolean {
    return values.length === challenge.length && values.every((digit) => digit !== "");
  }

  /**
   * ⚠️ ÖNEMLİ: hata durumu KİLİTLEMEZ.
   * Hata sonrası kullanıcı yeniden yazabilmeli ve Doğrula'ya basabilmeli.
   * (Önceki sürümde `error` de kilitliydi → kullanıcı ilerleyemiyordu.)
   */

  function handleChange(index: number, value: string) {
    if (locked) return;

    const clean = value.replace(/\D/g, "");
    if (!clean) return;

    const next = [...digits];
    if (clean.length > 1) {
      // Yapıştırma
      for (let offset = 0; offset < clean.length && index + offset < digits.length; offset += 1) {
        next[index + offset] = clean[offset] ?? "";
      }
      setDigits(next);
      const lastIndex = Math.min(index + clean.length - 1, digits.length - 1);
      inputsRef.current[lastIndex]?.focus();
    } else {
      next[index] = clean;
      setDigits(next);
      if (index < digits.length - 1) inputsRef.current[index + 1]?.focus();
    }

    const candidate = next.join("");
    if (isComplete(next)) {
      setSubmittedCode(candidate);
      onSubmit(candidate);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (locked) return;

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
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
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
    ["--otp-success" as string]: theme.colors.success,
    ["--otp-surface" as string]: theme.colors.surface,
    ["--otp-font" as string]: theme.font,
    ["--otp-stagger" as string]: `${SUCCESS_STAGGER_MS}ms`,
    // Başarı çubuğunun süresi akıştaki animasyon süresiyle aynı olmalı
    ["--otp-success-duration" as string]: `${OTP_SUCCESS_DURATION_MS}ms`,
  };

  const code = digits.join("");

  const statusIcon =
    status === "success" ? "✅" : status === "error" ? "❌" : theme.otpStyle === "paws" ? "🐾" : theme.otpStyle === "snow" ? "❄" : "🔐";

  return (
    <div className={`otp otp--${theme.otpStyle} otp--state-${status}`} style={style}>
      <div className="otp__card">
        <div className={`otp__icon${status === "success" ? " is-pop" : ""}`} aria-hidden="true">
          {statusIcon}
        </div>

        <h2 className="otp__title">
          {status === "success"
            ? "Doğrulandı!"
            : status === "error"
              ? "Kod hatalı"
              : "İki adımlı doğrulama"}
        </h2>

        <p className="otp__subtitle">
          {status === "success" ? (
            "Panele yönlendiriliyorsun…"
          ) : (
            <>
              {challenge.length} haneli kod <strong>{challenge.channelLabel}</strong> kanalına
              gönderildi
            </>
          )}
        </p>

        {challenge.devCode && status !== "success" && (
          <div className="otp__dev-hint">
            <span aria-hidden="true">🧪</span>
            Geliştirme kipi — kod: <strong className="mono">{challenge.devCode}</strong>
            <small>(Telegram/n8n yapılandırılınca kaybolur)</small>
          </div>
        )}

        {status === "error" && error && (
          <div className="otp__error" role="alert">
            <span className="otp__error-text">{error}</span>
            <span className="otp__attempts">
              {challenge.attemptsLeft > 0
                ? `${challenge.attemptsLeft} deneme hakkın kaldı`
                : "Deneme hakkın doldu"}
            </span>
          </div>
        )}

        <div className="otp__inputs-wrap">
          <div className="otp__inputs">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                className={`otp__input${digit ? " is-filled" : ""}`}
                style={{ ["--otp-index" as string]: index }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={challenge.length}
                value={digit}
                disabled={locked}
                aria-label={`${index + 1}. hane`}
                aria-invalid={status === "error"}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
              />
            ))}
          </div>
        </div>

        {status === "verifying" && (
          <div className="otp__verifying">
            <span className="otp__spinner" />
            Doğrulanıyor…
          </div>
        )}

        {status === "success" && (
          <div className="otp__success-bar">
            <span className="otp__success-fill" />
          </div>
        )}

        {status !== "success" && (
          <>
            <button
              className="otp__submit"
              type="button"
              disabled={locked || !isComplete(digits)}
              onClick={() => {
                setSubmittedCode(code);
                onSubmit(code);
              }}
            >
              {status === "verifying" ? "Doğrulanıyor…" : "Doğrula"}
            </button>

            <div className="otp__actions">
              <button className="otp__link" type="button" onClick={onResend} disabled={locked}>
                Kodu tekrar gönder
              </button>
              <button className="otp__link" type="button" onClick={onCancel} disabled={locked}>
                Vazgeç
              </button>
            </div>
          </>
        )}

        {(status === "success" || status === "error") && onSkipAnimation && (
          <div className="otp__skip mono">Enter ile devam et</div>
        )}
      </div>
    </div>
  );
}
