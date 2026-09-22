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

import { useCallback, useState } from "react";

import {
  apiLogin,
  apiResendOtp,
  apiVerifyOtp,
  describeAuthError,
} from "./api";
import type { LoginCredentials, LoginStep, OtpChallenge } from "./types";

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
  wrongAttempts: number;
  session: LoginSession | null;
  submitCredentials: (credentials: LoginCredentials) => Promise<void>;
  submitOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  cancelOtp: () => void;
  finishPunishment: () => void;
  reset: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  n8n: "n8n",
  totp: "Authenticator",
};

export function useLoginFlow(
  config: LoginFlowConfig,
  onSuccess: (session: LoginSession) => void,
): UseLoginFlowResult {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [session, setSession] = useState<LoginSession | null>(null);
  /** Ceza sonrası dönülecek kullanıcı adı */
  const [pendingUsername, setPendingUsername] = useState<string>("");

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

      try {
        const response = await apiVerifyOtp(challenge.challengeId, code);

        if (response.ok) {
          const granted: LoginSession = {
            token: response.token ?? "",
            username: pendingUsername,
          };
          setSession(granted);
          setStep("success");
          onSuccess(granted);
          return;
        }

        const attempts = response.attempts_left ?? Math.max(0, challenge.attemptsLeft - 1);
        const total = wrongAttempts + 1;

        setWrongAttempts(total);
        setChallenge({ ...challenge, attemptsLeft: attempts });

        if (total >= config.maxAttempts && config.punishmentEnabled) {
          setError(null);
          setStep("punishment");
          return;
        }

        setError(response.message ?? `Kod hatalı. ${attempts} deneme hakkın kaldı.`);
      } catch (caught) {
        setError(describeAuthError(caught));
      } finally {
        setLoading(false);
      }
    },
    [challenge, config.maxAttempts, config.punishmentEnabled, onSuccess, pendingUsername, wrongAttempts],
  );

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
  }, []);

  const reset = useCallback(() => {
    setStep("credentials");
    setChallenge(null);
    setError(null);
    setWrongAttempts(0);
    setSession(null);
  }, []);

  return {
    step,
    loading,
    error,
    challenge,
    wrongAttempts,
    session,
    submitCredentials,
    submitOtp,
    resendOtp,
    cancelOtp,
    finishPunishment,
    reset,
  };
}
