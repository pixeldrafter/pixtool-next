/**
 * OTP animasyon demosu — GELİŞTİRME ARACI.
 *
 * Amaç: OTP adımının dört görsel durumunu (`idle`, `verifying`, `error`,
 * `success`) tek ekranda görebilmek. Tasarım doğrulaması için; üretim akışını
 * etkilemez.
 *
 * Kullanım:  http://localhost:5173/?demo=otp
 *            http://localhost:5173/?demo=otp&theme=yeti
 *
 * İlgili araç: `tools/screenshot.mjs`
 */

import { useState } from "react";

import { OtpStep } from "./OtpStep";
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
  const initialTheme = (params.get("theme") as LoginFormId) ?? "lamp";

  const [themeId, setThemeId] = useState<LoginFormId>(initialTheme);
  const [status, setStatus] = useState<OtpStatus>((params.get("state") as OtpStatus) ?? "error");
  /** Animasyonu yeniden tetiklemek için sayaç */
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

  return (
    <div className="otp-demo">
      <aside className="otp-demo__panel">
        <h1>OTP Animasyon Demosu</h1>
        <p className="otp-demo__note">
          Geliştirme aracı — <code>?demo=otp</code>
        </p>

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
      </aside>

      <main className="otp-demo__stage" key={`${themeId}-${status}-${nonce}`}>
        <OtpStep
          theme={theme}
          challenge={challenge}
          status={status}
          error={status === "error" ? "Kod hatalı. 2 deneme hakkın kaldı." : null}
          onSubmit={() => replay("success")}
          onResend={() => replay("idle")}
          onCancel={() => replay("idle")}
        />
      </main>
    </div>
  );
}
