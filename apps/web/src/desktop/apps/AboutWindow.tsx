/**
 * Pixtool Hakkında penceresi.
 *
 * Sürüm bilgisi, klavye kısayolları ve **bekleme bileşenlerinin demoları**
 * (DeadlineBar + WaitingCurtain) — kullanıcı bunları buradan deneyebilir.
 */

import { useEffect, useState } from "react";

import { DeadlineBar, WaitingCurtain } from "../../loading";
import { useSettings } from "../../settings";
import { getLoginTheme } from "../../login";
import "./AboutWindow.css";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Enter / Boşluk", action: "Boot ekranını geç · pencereyi aç" },
  { keys: "Esc", action: "Başlat menüsünü / perdeyi kapat" },
  { keys: "↑ ↓", action: "Başlat menüsünde gez" },
  { keys: "Çift tıkla", action: "Pencere başlığında büyüt / geri al" },
  { keys: "Enter", action: "OTP başarı animasyonunu atla" },
];

export function AboutWindow() {
  const { settings } = useSettings();
  const [curtain, setCurtain] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);

  // Deadline demo — 12 saniyelik sahte işlem
  useEffect(() => {
    if (!curtain) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / 12000);
      setDemoProgress(ratio);
      if (ratio >= 1) {
        window.setTimeout(() => {
          setCurtain(false);
          setDemoProgress(0);
        }, 600);
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [curtain]);

  const loginTheme = getLoginTheme(settings.login.form);

  return (
    <div className="about">
      <header className="about__brand">
        <div className="about__logo" aria-hidden="true">
          ◈
        </div>
        <div>
          <h1 className="about__title">Pixtool Next</h1>
          <p className="about__subtitle">Uzak sistem yönetim paneli · v0.1.0 · Faz 1</p>
        </div>
      </header>

      <section className="about__section">
        <h2 className="about__heading">Aktif yapılandırma</h2>
        <dl className="about__facts">
          <div>
            <dt>Tema</dt>
            <dd>{settings.appearance.theme}</dd>
          </div>
          <div>
            <dt>Login formu</dt>
            <dd>{loginTheme.name}</dd>
          </div>
          <div>
            <dt>Cursor</dt>
            <dd>{settings.appearance.cursor.kind}</dd>
          </div>
          <div>
            <dt>Duvar kağıdı</dt>
            <dd>{settings.appearance.wallpaper.kind}</dd>
          </div>
          <div>
            <dt>Açılış akışı</dt>
            <dd>{settings.flow.order.join(" → ")}</dd>
          </div>
          <div>
            <dt>Konsol</dt>
            <dd>{settings.flow.consoleVerbosity}</dd>
          </div>
        </dl>
      </section>

      <section className="about__section">
        <h2 className="about__heading">Bekleme bileşenleri</h2>
        <p className="about__note">
          <strong>Belirli süreli</strong> işlemler → Interactive Deadline ·{" "}
          <strong>Belirsiz</strong> beklemeler → bg.gif perdesi
        </p>

        <div className="about__demo">
          <DeadlineBar
            label="Örnek işlem — veri aktarımı"
            value={settings.loading.progressBarStyle === "deadline" ? undefined : 0.62}
            totalSeconds={settings.loading.progressBarStyle === "deadline" ? 6 : undefined}
          />
        </div>

        <button type="button" className="about__button" onClick={() => setCurtain(true)}>
          🖼️ Bekleme perdesini göster (bg.gif)
        </button>
      </section>

      <section className="about__section">
        <h2 className="about__heading">Klavye kısayolları</h2>
        <ul className="about__shortcuts">
          {SHORTCUTS.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.action}</span>
            </li>
          ))}
        </ul>
      </section>

      {settings.loading.waitingCurtain && (
        <WaitingCurtain
          visible={curtain}
          message="Örnek işlem çalışıyor…"
          detail="Bu bir demodur — perde bg.gif animasyonunu gösterir."
          progress={demoProgress > 0 ? demoProgress : undefined}
          dim={settings.loading.curtainDim}
          onCancel={() => {
            setCurtain(false);
            setDemoProgress(0);
          }}
        />
      )}
    </div>
  );
}
