/**
 * OTP animasyon demosu — GELİŞTİRME ARACI.
 *
 * Amaç: OTP adımının dört görsel durumunu (`idle`, `verifying`, `error`,
 * `success`) ve iki tasarım stilini (yeti / classic) tek ekranda görebilmek.
 *
 * Kullanım:  http://localhost:5173/?demo=otp
 *            http://localhost:5173/?demo=otp&state=error&otpStyle=yeti
 *
 * İlgili araç: `tools/screenshot.mjs`
 */

import { useState } from "react";

import { OtpStep } from "./OtpStep";
import { YetiOtpStep } from "./YetiOtpStep";
import { LOGIN_THEME_LIST } from "./themes";
import type { LoginFormId, OtpStatus } from "./types";
import "./OtpDemo.css";

const STATES: { value: OtpStatus; label: string; hint: string }[] = [
  { value: "idle", label: "Normal", hint: "Bekleme" },
  { value: "verifying", label: "Doğrulanıyor", hint: "Nabız efekti" },
  { value: "error", label: "Hatalı", hint: "Sallanma + kırmızı" },
  { value: "success", label: "Doğru", hint: "Sırayla yeşil + zıplama" },
];

export function OtpDemo() {
  const params = new URLSearchParams(window.location.search);

  const [themeId, setThemeId] = useState<LoginFormId>(
    (params.get("theme") as LoginFormId) ?? "lamp",
  );
  const [status, setStatus] = useState<OtpStatus>(
    (params.get("state") as OtpStatus) ?? "error",
  );
  const [otpStyle, setOtpStyle] = useState<"yeti" | "classic">(
    (params.get("otpStyle") as "yeti" | "classic") ?? "yeti",
  );
  const [nonce, setNonce] = useState(0);

  const theme = LOGIN_THEME_LIST.find((item) => item.id === themeId) ?? LOGIN_THEME_LIST[0]!;

  const challenge = {
    challengeId: "demo",
    length: 6,
    attemptsLeft: status === "error" ? 2 : 3,
    devCode: "488779",
    channelLabel: "Telegram",
  };

  function replay(next: OtpStatus) {
    setStatus(next);
    setNonce((value) => value + 1);
  }

  const sharedProps = {
    theme,
    challenge,
    status,
    error: status === "error" ? "Kod hatalı. 2 deneme hakkın kaldı." : null,
    onSubmit: () => replay("success"),
    onResend: () => replay("idle"),
    onCancel: () => replay("idle"),
  };

  return (
    <div className="otp-demo">
      <aside className="otp-demo__panel">
        <h1>OTP Animasyon Demosu</h1>
        <p className="otp-demo__note">
          Geliştirme aracı — <code>?demo=otp</code>
        </p>

        <h2>Tasarım</h2>
        <div className="otp-demo__buttons">
          <button
            type="button"
            className={otpStyle === "yeti" ? "is-active" : ""}
            onClick={() => {
              setOtpStyle("yeti");
              setNonce((value) => value + 1);
            }}
          >
            <strong>Yeti tasarımı</strong>
            <small>Karakter + açık mavi tema</small>
          </button>
          <button
            type="button"
            className={otpStyle === "classic" ? "is-active" : ""}
            onClick={() => {
              setOtpStyle("classic");
              setNonce((value) => value + 1);
            }}
          >
            <strong>Klasik</strong>
            <small>Login formunun temasına uyar</small>
          </button>
        </div>

        <h2>Durum</h2>
        <div className="otp-demo__buttons">
          {STATES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={status === item.value ? "is-active" : ""}
              onClick={() => replay(item.value)}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>

        {otpStyle === "classic" && (
          <>
            <h2>Tema (login formu)</h2>
            <div className="otp-demo__buttons otp-demo__buttons--themes">
              {LOGIN_THEME_LIST.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={themeId === item.id ? "is-active" : ""}
                  onClick={() => setThemeId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      <main className="otp-demo__stage" key={`${otpStyle}-${themeId}-${status}-${nonce}`}>
        {otpStyle === "yeti" ? (
          <YetiOtpStep {...sharedProps} onSkipAnimation={() => replay("idle")} />
        ) : (
          <OtpStep {...sharedProps} onSkipAnimation={() => replay("idle")} />
        )}
      </main>
    </div>
  );
}
