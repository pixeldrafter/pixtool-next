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

import { useState } from "react";

import { AuthPanel } from "./AuthPanel";
import { JokeBubble } from "./JokeBubble";
import { LoginCopyright, LoginMarquee } from "./LoginOverlays";
import { OtpStep } from "./OtpStep";
import { PunishmentScreen } from "./PunishmentScreen";
import { YetiOtpStep } from "./YetiOtpStep";
import { renderLoginForm } from "./registry";
import { getLoginTheme } from "./themes";
import { LOGIN_TEXT } from "./text";
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

  /** Kayıt / parola formu açık mı (null = kapalı) */
  const [panel, setPanel] = useState<"register" | "forgot" | null>(null);

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
    isCredentials || (flow.step === "otp" && flow.otpStatus === "idle" && !flow.error);

  /**
   * Şerit ve telif rengi **formun temasından** türetilir.
   * Açık temalarda (panda, yeti) koyu metin gerekir — bu yüzden `muted`
   * kanalı yerine arka planın açıklık durumuna bakılır.
   */
  const isLightTheme = theme.id === "panda" || theme.id === "pandaPage" || theme.id === "yeti";

  const overlayVars = isLightTheme
    ? {
        "--marquee-color": "#1d3d4a",
        "--marquee-glow": "rgba(45, 74, 86, 0.22)",
        "--copyright-color": "#1d3d4a",
        "--copyright-bg": "rgba(255, 255, 255, 0.78)",
        "--copyright-border": "rgba(45, 74, 86, 0.22)",
        "--copyright-accent": theme.colors.accent,
        "--copyright-glow": "rgba(45, 74, 86, 0.18)",
        "--copyright-glow-fade": "rgba(45, 74, 86, 0)",
      }
    : {
        "--marquee-color": theme.colors.accent,
        "--marquee-glow": "rgba(0, 0, 0, 0.5)",
        "--copyright-color": theme.colors.text,
        "--copyright-bg": "rgba(6, 12, 20, 0.62)",
        "--copyright-border": theme.colors.border,
        "--copyright-accent": theme.colors.accent,
        "--copyright-glow": `${theme.colors.accent}55`,
        "--copyright-glow-fade": `${theme.colors.accent}00`,
      };

  return (
    <div
      className={`login-screen login-screen--${login.form}`}
      style={overlayVars as React.CSSProperties}
    >
      {/* Kayan hoş geldiniz şeridi — tüm formların üstünde */}
      <LoginMarquee enabled={login.marqueeEnabled} duration={login.marqueeSeconds} />
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
            onRegister: () => setPanel("register"),
            onForgot: () => setPanel("forgot"),
          })}

        {flow.step === "otp" &&
          flow.challenge &&
          (login.otp.style === "yeti" ? (
            <YetiOtpStep
              theme={theme}
              challenge={flow.challenge}
              status={flow.otpStatus}
              error={flow.error}
              onSubmit={(code) => void flow.submitOtp(code)}
              onResend={() => void flow.resendOtp()}
              onCancel={flow.cancelOtp}
              onSkipAnimation={flow.skipOtpAnimation}
            />
          ) : (
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
          ))}

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
            enabled={login.jokes.enabled && !panel}
          />
        </div>
      )}

      {/* Kayıt / parola paneli — formun üstünde ortalanmış katman */}
      {panel && (
        <AuthPanel
          mode={panel}
          theme={theme}
          initialUsername=""
          onClose={() => setPanel(null)}
        />
      )}

      {/* Alt bilgi */}
      <footer className="login-screen__footer">
        <span>PIXTOOL NEXT</span>
        <span className="login-screen__footer-sep">·</span>
        <span>{theme.name}</span>
      </footer>

      {/* Nabız animasyonlu telif hakkı — formun altında */}
      <LoginCopyright enabled={login.copyrightEnabled} text={LOGIN_TEXT.copyright} />
    </div>
  );
}
