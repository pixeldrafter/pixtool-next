/**
 * Login akışı yöneticisi.
 *
 * Adımlar:
 *   credentials → otp → (3 yanlış) → punishment → otp …
 *                    └→ (doğru) → success
 *
 * Ceza süresi dolduğunda yeni bir OTP meydan okuması istenir ve kullanıcı
 * giriş ekranına döner.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiLogin,
  apiResendOtp,
  apiVerifyOtp,
  describeAuthError,
} from "./api";
import type { LoginCredentials, LoginStep, OtpChallenge, OtpStatus } from "./types";

export interface LoginSession {
  token: string;
  username: string;
}

export interface LoginFlowConfig {
  /** OTP zorunlu mu (ayarlardan) */
  otpEnabled: boolean;
  /** Kod uzunluğu (ayarlardan) */
  otpLength: number;
  /** Kaç yanlış denemede ceza */
  maxAttempts: number;
  /** Ceza süresi (saniye) */
  punishmentSeconds: number;
  /** Ceza aktif mi */
  punishmentEnabled: boolean;
}

export interface UseLoginFlowResult {
  step: LoginStep;
  loading: boolean;
  error: string | null;
  challenge: OtpChallenge | null;
  /** OTP kutularının görsel durumu (animasyonlar için) */
  otpStatus: OtpStatus;
  wrongAttempts: number;
  session: LoginSession | null;
  submitCredentials: (credentials: LoginCredentials) => Promise<void>;
  submitOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  cancelOtp: () => void;
  finishPunishment: () => void;
  /** Başarı animasyonunu atlayıp doğrudan devam et */
  skipOtpAnimation: () => void;
  reset: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  n8n: "n8n",
  totp: "Authenticator",
};

/** Doğru kodda yeşil animasyonun gösterilme süresi (ms). */
export const OTP_SUCCESS_DURATION_MS = 1150;

export function useLoginFlow(
  config: LoginFlowConfig,
  onSuccess: (session: LoginSession) => void,
): UseLoginFlowResult {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [session, setSession] = useState<LoginSession | null>(null);
  /** Ceza sonrası dönülecek kullanıcı adı */
  const [pendingUsername, setPendingUsername] = useState<string>("");

  /** Başarı animasyonu zamanlayıcısı — erken atlanırsa temizlenir */
  const successTimerRef = useRef<number | null>(null);
  /** Başarıda verilecek oturum bilgisi */
  const pendingSessionRef = useRef<LoginSession | null>(null);

  useEffect(
    () => () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    },
    [],
  );

  // ------------------------------------------------------------------
  //  1) Kimlik bilgileri
  // ------------------------------------------------------------------
  const submitCredentials = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      setPendingUsername(credentials.username);

      try {
        const response = await apiLogin(credentials);

        if (response.otp_required && response.challenge_id) {
          setChallenge({
            challengeId: response.challenge_id,
            length: response.code_length ?? config.otpLength,
            attemptsLeft: response.attempts_left ?? config.maxAttempts,
            devCode: response.dev_otp,
            channelLabel: CHANNEL_LABELS[response.channel ?? ""] ?? "Telegram",
          });
          setWrongAttempts(0);
          setOtpStatus("idle");
          setStep("otp");
          return;
        }

        // OTP gerekmiyor → doğrudan giriş
        const granted: LoginSession = {
          token: response.token ?? "",
          username: credentials.username,
        };
        setSession(granted);
        setStep("success");
        onSuccess(granted);
      } catch (caught) {
        setError(describeAuthError(caught));
      } finally {
        setLoading(false);
      }
    },
    [config.maxAttempts, config.otpLength, onSuccess],
  );

  // ------------------------------------------------------------------
  //  2) OTP doğrulama
  // ------------------------------------------------------------------
  const submitOtp = useCallback(
    async (code: string) => {
      if (!challenge) return;

      setLoading(true);
      setError(null);
      setOtpStatus("verifying");

      try {
        const response = await apiVerifyOtp(challenge.challengeId, code);

        if (response.ok) {
          const granted: LoginSession = {
            token: response.token ?? "",
            username: pendingUsername,
          };
          setSession(granted);
          setOtpStatus("success");

          // Yeşil animasyon gösterildikten sonra bir sonraki adıma geç
          pendingSessionRef.current = granted;
          successTimerRef.current = window.setTimeout(() => {
            successTimerRef.current = null;
            setStep("success");
            onSuccess(granted);
          }, OTP_SUCCESS_DURATION_MS);
          return;
        }

        const attempts = response.attempts_left ?? Math.max(0, challenge.attemptsLeft - 1);
        const total = wrongAttempts + 1;

        setWrongAttempts(total);
        setChallenge({ ...challenge, attemptsLeft: attempts });

        if (total >= config.maxAttempts && config.punishmentEnabled) {
          setError(null);
          setOtpStatus("idle");
          setStep("punishment");
          return;
        }

        // Kırmızı + sallanma animasyonu
        setOtpStatus("error");
        setError(response.message ?? `Kod hatalı. ${attempts} deneme hakkın kaldı.`);
      } catch (caught) {
        setOtpStatus("error");
        setError(describeAuthError(caught));
      } finally {
        setLoading(false);
      }
    },
    [challenge, config.maxAttempts, config.punishmentEnabled, onSuccess, pendingUsername, wrongAttempts],
  );

  /** Başarı animasyonunu atla — doğrudan panele geç. */
  const skipOtpAnimation = useCallback(() => {
    if (otpStatus !== "success") return;
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    const granted = pendingSessionRef.current;
    if (!granted) return;
    setStep("success");
    onSuccess(granted);
  }, [otpStatus, onSuccess]);

  // ------------------------------------------------------------------
  //  3) Kodu yeniden gönder
  // ------------------------------------------------------------------
  const resendOtp = useCallback(async () => {
    if (!challenge) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiResendOtp(challenge.challengeId);
      setChallenge({
        challengeId: response.challenge_id ?? challenge.challengeId,
        length: challenge.length,
        attemptsLeft: response.attempts_left ?? config.maxAttempts,
        devCode: response.dev_otp ?? challenge.devCode,
        channelLabel: challenge.channelLabel,
      });
      setWrongAttempts(0);
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setLoading(false);
    }
  }, [challenge, config.maxAttempts]);

  // ------------------------------------------------------------------
  //  4) Ceza bitti
  // ------------------------------------------------------------------
  const finishPunishment = useCallback(() => {
    setWrongAttempts(0);
    setError(null);
    setOtpStatus("idle");

    if (challenge) {
      // Yeni bir deneme hakkı ver
      setChallenge({ ...challenge, attemptsLeft: config.maxAttempts });
      setStep("otp");
    } else {
      setStep("credentials");
    }
  }, [challenge, config.maxAttempts]);

  const cancelOtp = useCallback(() => {
    setStep("credentials");
    setChallenge(null);
    setError(null);
    setWrongAttempts(0);
    setOtpStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setStep("credentials");
    setChallenge(null);
    setError(null);
    setWrongAttempts(0);
    setSession(null);
    setOtpStatus("idle");
  }, []);

  return {
    step,
    loading,
    error,
    challenge,
    otpStatus,
    wrongAttempts,
    session,
    submitCredentials,
    submitOtp,
    resendOtp,
    cancelOtp,
    finishPunishment,
    skipOtpAnimation,
    reset,
  };
}
