/**
 * Giriş ekranı — akışın yöneticisi.
 *
 * Seçili login formunu çizer (`settings.login.form`), şaka balonunu ve
 * OTP / ceza adımlarını yönetir.
 *
 * ⚠️ Formlar **kendi tam ekran düzenlerini** getirir (referans tasarımlar
 * `body { min-height: 100vh; display: grid; place-items: center }` kullanır).
 * Bu yüzden burada forma hiçbir düzen müdahalesi yapılmaz; şaka ve alt bilgi
 * **üstte katman** olarak konumlanır.
 */

import { JokeBubble } from "./JokeBubble";
import { OtpStep } from "./OtpStep";
import { PunishmentScreen } from "./PunishmentScreen";
import { renderLoginForm } from "./registry";
import { getLoginTheme } from "./themes";
import { useLoginFlow, type LoginSession } from "./useLoginFlow";
import { useSettings } from "../settings";
import "./forms/pixtool-extras.css";
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

  const isCredentials = flow.step === "credentials";
  /** Animasyon gösterilirken şaka balonu dursun */
  const showJoke =
    isCredentials || (flow.step === "otp" && flow.otpStatus === "idle");

  return (
    <div className={`login-screen login-screen--${login.form}`}>
      {/* Form / OTP / Ceza — kendi düzenlerini getirirler */}
      <div className="login-screen__stage">
        {isCredentials &&
          renderLoginForm(login.form, {
            theme,
            labels: {
              username: login.usernameLabel,
              password: login.passwordLabel,
            },
            onSubmit: (credentials) => void flow.submitCredentials(credentials),
            loading: flow.loading,
            error: flow.error,
            disabled: false,
          })}

        {flow.step === "otp" && flow.challenge && (
          <OtpStep
            theme={theme}
            challenge={flow.challenge}
            status={flow.otpStatus}
            error={flow.error}
            onSubmit={(code) => void flow.submitOtp(code)}
            onResend={() => void flow.resendOtp()}
            onCancel={flow.cancelOtp}
            onSkipAnimation={flow.skipOtpAnimation}
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

      {/* Şaka — formun temasına uygun, üstte katman */}
      {showJoke && (
        <div className="login-screen__joke">
          <JokeBubble
            theme={theme}
            rotateSeconds={login.jokes.rotateSeconds}
            enabled={login.jokes.enabled}
          />
        </div>
      )}

      {/* Alt bilgi */}
      <footer className="login-screen__footer">
        <span>PIXTOOL NEXT</span>
        <span className="login-screen__footer-sep">·</span>
        <span>{theme.name}</span>
      </footer>
    </div>
  );
}
