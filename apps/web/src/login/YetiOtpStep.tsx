/**
 * OTP ekranı — YETİ tasarımı.
 *
 * Kullanıcı isteği: OTP ekranı, Yeti login formunun görsel diliyle
 * (Source Sans Pro, #217093 kenarlık, #f3fafd zemin, #4eb8dd buton)
 * ve **aynı karakterle** tasarlansın.
 *
 * Tasarıma sadık kalınan noktalar:
 *   • `.lf--yeti` + `yeti.css` → kimlik, kart, tipografi, buton
 *   • `YetiSvg` karakteri → üstte, `.svgContainer` içinde
 *   • `.inputGroup` / `label` / `button` → orijinal sınıf adları
 *
 * Karakter tepkileri:
 *   • normal  → izler, göz kırpar
 *   • yazarken → gözlerini kapatır (gizlilik — orijinal davranış)
 *   • hata    → üzülür (kollar kalkar, sallanır)
 *   • başarı  → sevinir (zıplar)
 *
 * ⚠️ Bu bileşen aynı zamanda klasik OTP'deki "hata sonrası kilitlenme"
 * hatasını da giderir: hata durumunda kutular **açık** kalır.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { LoginTheme, OtpChallenge, OtpStatus } from "./types";
import { YetiSvg } from "./forms/YetiSvg";
import { OTP_SUCCESS_DURATION_MS } from "./useLoginFlow";
import "./forms/yeti.css";
import "./forms/pixtool-extras.css";
import "./YetiOtpStep.css";

/**
 * Tüm haneler dolu mu?
 *
 * ⚠️ `code.includes("")` KULLANILMAZ: boş string her stringin içinde
 * bulunduğu için o ifade **her zaman `true`** döner ve buton hiç aktifleşmez.
 */
function isComplete(digits: string[], expectedLength: number): boolean {
  return digits.length === expectedLength && digits.every((digit) => digit !== "");
}

interface YetiOtpStepProps {
  theme: LoginTheme;
  challenge: OtpChallenge;
  status: OtpStatus;
  error: string | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
  onSkipAnimation?: () => void;
}

export function YetiOtpStep({
  challenge,
  status,
  error,
  onSubmit,
  onResend,
  onCancel,
  onSkipAnimation,
}: YetiOtpStepProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(challenge.length).fill(""));
  const [submittedCode, setSubmittedCode] = useState("");

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * ⚠️ KRİTİK: hata durumu KİLİTLEMEZ.
   * Hata sonrası kullanıcı yeniden yazabilmeli (önceki sürümdeki hata buydu).
   */
  const locked = status === "verifying" || status === "success";
  const code = digits.join("");
  const complete = isComplete(digits, challenge.length);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Hata → önce yanlış kod KIRMIZI olarak görünsün, sonra temizlensin
  useEffect(() => {
    if (status !== "error") return undefined;

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

  const send = useCallback(
    (value: string) => {
      setSubmittedCode(value);
      onSubmit(value);
    },
    [onSubmit],
  );

  // ---- Enter ile gönder / animasyonu atla ----
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") return;

      if (status === "success" || status === "error") {
        event.preventDefault();
        onSkipAnimation?.();
        return;
      }
      if (complete && !locked) {
        event.preventDefault();
        send(code);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [complete, code, locked, send, status, onSkipAnimation]);

  // ---- Girdi ----
  function handleChange(index: number, value: string) {
    if (locked) return;

    const clean = value.replace(/\D/g, "");
    if (!clean) return;

    const next = [...digits];
    if (clean.length > 1) {
      for (let offset = 0; offset < clean.length && index + offset < digits.length; offset += 1) {
        next[index + offset] = clean[offset] ?? "";
      }
      setDigits(next);
      inputsRef.current[Math.min(index + clean.length - 1, digits.length - 1)]?.focus();
    } else {
      next[index] = clean;
      setDigits(next);
      if (index < digits.length - 1) inputsRef.current[index + 1]?.focus();
    }

    // Tüm haneler dolduysa otomatik gönder
    if (isComplete(next, digits.length)) {
      send(next.join(""));
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (locked) return;
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

  /** Yazarken yeti gözlerini kapatır (orijinal davranış). */
  const shy = status === "idle" && code.length > 0 && !complete;

  const rootClass = [
    "lf--yeti",
    "otp-yeti",
    `otp-yeti--${status}`,
    shy ? "is-shy" : "",
    status === "success" ? "is-happy" : "",
    status === "error" ? "is-sad" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} style={{ ["--otp-stagger" as string]: "70ms" }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (complete && !locked) send(code);
        }}
      >
        {/* Yeti karakteri */}
        <div className="svgContainer">
          <div>
            <YetiSvg className="mySVG" />
          </div>
        </div>

        {/* Başlık */}
        <div className="inputGroup inputGroup1">
          <label htmlFor="otp-first">
            {status === "success" ? "Doğrulandı!" : status === "error" ? "Kod hatalı" : "Doğrulama kodu"}
          </label>

          <p className="otp-yeti__helper">
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
            <p className="otp-yeti__dev">
              🧪 Geliştirme kipi — kod: <strong>{challenge.devCode}</strong>
            </p>
          )}

          {status === "error" && error && (
            <p className="otp-yeti__error" role="alert">
              {error}
              {challenge.attemptsLeft > 0 && !/deneme/i.test(error) && (
                <span> · {challenge.attemptsLeft} deneme hakkın kaldı</span>
              )}
            </p>
          )}
        </div>

        {/* OTP kutuları */}
        <div className="otp-yeti__boxes">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              id={index === 0 ? "otp-first" : undefined}
              className={`otp-yeti__box${digit ? " is-filled" : ""}`}
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

        {/* Doğrula */}
        <div className="inputGroup inputGroup3">
          <button type="submit" id="login" disabled={locked || !complete}>
            {status === "verifying"
              ? "Doğrulanıyor…"
              : status === "success"
                ? "✔ Doğrulandı"
                : "Doğrula"}
          </button>
        </div>

        {/* Bağlantılar */}
        {status !== "success" && (
          <div className="otp-yeti__actions">
            <button type="button" className="otp-yeti__link" onClick={onResend} disabled={locked}>
              Kodu tekrar gönder
            </button>
            <button type="button" className="otp-yeti__link" onClick={onCancel} disabled={locked}>
              Vazgeç
            </button>
          </div>
        )}

        {(status === "success" || status === "error") && onSkipAnimation && (
          <p className="otp-yeti__skip">Enter ile devam et</p>
        )}

        {/* Başarı çubuğu */}
        {status === "success" && (
          <div className="otp-yeti__progress">
            <span
              className="otp-yeti__progress-fill"
              style={{ ["--otp-success-duration" as string]: `${OTP_SUCCESS_DURATION_MS}ms` }}
            />
          </div>
        )}
      </form>
    </div>
  );
}
