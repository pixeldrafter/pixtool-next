/**
 * Giriş ekranı — akışın yöneticisi.
 *
 * Seçili login formunu (`settings.login.form`) çizer, şaka balonunu ve OTP /
 * ceza adımlarını yönetir. Tüm görsel dil seçili formun temasından gelir.
 */

import { JokeBubble } from "./JokeBubble";
import { OtpStep } from "./OtpStep";
import { PunishmentScreen } from "./PunishmentScreen";
import { renderLoginForm } from "./registry";
import { getLoginTheme } from "./themes";
import { useLoginFlow, type LoginSession } from "./useLoginFlow";
import type { LoginCredentials } from "./types";
import { useSettings } from "../settings";
import "./LoginScreen.css";

interface LoginScreenProps {
  onSuccess: (session: LoginSession) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { settings } = useSettings();
  const login = settings.login;
  const theme = getLoginTheme(login.form);

  const flow = useLoginFlow(
    {
      otpEnabled: login.otp.enabled,
      otpLength: login.otp.length,
      maxAttempts: login.otp.maxAttempts,
      punishmentSeconds: login.punishment.countdownSeconds,
      punishmentEnabled: login.punishment.enabled,
    },
    onSuccess,
  );

  const themeStyle: React.CSSProperties = {
    ["--ls-bg" as string]: theme.colors.bg,
    ["--ls-accent" as string]: theme.colors.accent,
    ["--ls-text" as string]: theme.colors.text,
    ["--ls-muted" as string]: theme.colors.muted,
    ["--ls-font" as string]: theme.font,
  };

  return (
    <div className={`login-screen login-screen--${login.form}`} style={themeStyle}>
      {/* Dekoratif katman (form bazlı) */}
      <div className="login-screen__decor" aria-hidden="true" />

      <div className="login-screen__content">
        {flow.step === "credentials" &&
          renderLoginForm(login.form, {
            theme,
            labels: {
              username: login.usernameLabel,
              password: login.passwordLabel,
            },
            onSubmit: (credentials: LoginCredentials) => void flow.submitCredentials(credentials),
            loading: flow.loading,
            error: flow.error,
            disabled: false,
          })}

        {flow.step === "otp" && flow.challenge && (
          <OtpStep
            theme={theme}
            challenge={flow.challenge}
            verifying={flow.loading}
            error={flow.error}
            onSubmit={(code) => void flow.submitOtp(code)}
            onResend={() => void flow.resendOtp()}
            onCancel={flow.cancelOtp}
          />
        )}

        {flow.step === "punishment" && (
          <PunishmentScreen
            theme={theme}
            seconds={login.punishment.countdownSeconds}
            wrongAttempts={flow.wrongAttempts}
            onFinished={flow.finishPunishment}
          />
        )}
      </div>

      {/* Şaka — formun temasına uygun */}
      {flow.step === "credentials" && (
        <div className="login-screen__joke">
          <JokeBubble
            theme={theme}
            rotateSeconds={login.jokes.rotateSeconds}
            enabled={login.jokes.enabled}
          />
        </div>
      )}

      {/* Alt bilgi */}
      <footer className="login-screen__footer mono">
        <span>PIXTOOL NEXT</span>
        <span className="login-screen__footer-sep">·</span>
        <span>{theme.name}</span>
      </footer>
    </div>
  );
}
