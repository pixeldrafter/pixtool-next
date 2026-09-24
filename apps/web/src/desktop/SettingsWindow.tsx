/**
 * Ayarlar penceresi.
 *
 * Her şey özelleştirilebilir ilkesinin merkezi. Sol tarafta bölümler,
 * sağda ilgili alanlar. Tüm değişiklikler anında uygulanır ve localStorage'a
 * yazılır (store/persist).
 *
 * Alan bileşenleri (`Select`, `Toggle`, `Slider`, `Text`, `NumberField`)
 * burada tanımlıdır; ileride `@/components` altına taşınabilir.
 */

import { useState } from "react";

import {
  CURSOR_OPTIONS,
  DEFAULT_SETTINGS,
  FLOW_STEP_LABELS,
  IDLE_SCREEN_OPTIONS,
  LOGIN_FORM_OPTIONS,
  OTP_STYLE_OPTIONS,
  THEME_OPTIONS,
  VERBOSITY_OPTIONS,
  WALLPAPER_OPTIONS,
  useSettings,
  type Option,
  type SettingsSection,
} from "../settings";
import type { FlowStep } from "../settings/types";
import { VideoWallpaperPicker } from "./VideoWallpaperPicker";
import { fetchBridgeInfo, probeBridge } from "../console";
import "./SettingsWindow.css";

const SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "general", label: "Genel", icon: "⚙️" },
  { id: "flow", label: "Açılış Akışı", icon: "▶️" },
  { id: "appearance", label: "Görünüm", icon: "🎨" },
  { id: "login", label: "Giriş", icon: "🔑" },
  { id: "idle", label: "Boşta", icon: "🦇" },
  { id: "power", label: "Güç", icon: "⏻" },
  { id: "loading", label: "Yükleme", icon: "⏳" },
  { id: "bridge", label: "Köprü", icon: "🌉" },
];

export function SettingsWindow() {
  const [section, setSection] = useState<SettingsSection>("appearance");
  const { settings, update, reset, resetSection, exportJson, importJson } = useSettings();
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  return (
    <div className="settings">
      <nav className="settings__nav" aria-label="Ayar bölümleri">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings__nav-item${section === item.id ? " is-active" : ""}`}
            onClick={() => setSection(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="settings__body">
        {section === "general" && (
          <Group title="Genel">
            <Select
              label="Arayüz dili"
              hint="i18n altyapısı — çeviriler genişletilebilir"
              value={settings.general.lang}
              options={[
                { value: "tr", label: "Türkçe (varsayılan)" },
                { value: "en", label: "English (kısmi)" },
              ]}
              onChange={(value) => update("general", { lang: value as "tr" | "en" })}
            />
            <Toggle
              label="Geliştirici modu"
              hint="Ek günlük kaydı ve hata ayrıntısı"
              checked={settings.general.devMode}
              onChange={(checked) => update("general", { devMode: checked })}
            />
          </Group>
        )}

        {section === "flow" && (
          <>
            <Group title="Açılış adımları">
              <Field
                label="Adım sırası"
                hint="Onaylanan akış: Giriş → Konsol → Boot → Masaüstü"
              >
                <FlowOrderEditor
                  order={settings.flow.order}
                  onChange={(order) => update("flow", { order })}
                />
              </Field>
            </Group>

            <Group title="Konsol">
              <Select
                label="Ayrıntı seviyesi"
                hint="'Kapalı' seçilirse kimse rahatsız olmaz: sessizce boot edilip masaüstü açılır."
                value={settings.flow.consoleVerbosity}
                options={VERBOSITY_OPTIONS}
                onChange={(value) =>
                  update("flow", {
                    consoleVerbosity: value as "off" | "summary" | "everything",
                  })
                }
              />
              <Toggle
                label="Rapor kaydedilsin mi diye sor"
                hint="Açılış sonunda 'bu bilgileri kaydet?' onayı istenir"
                checked={settings.flow.askSaveReport}
                onChange={(checked) => update("flow", { askSaveReport: checked })}
              />
              <Select
                label="Rapor hedefi"
                value={settings.flow.reportTarget}
                options={[
                  { value: "nocodb", label: "NocoDB (devices tablosu)", hint: "Sonradan inceleyebilmek için" },
                  { value: "local", label: "Yalnızca yerel dosya" },
                ]}
                onChange={(value) =>
                  update("flow", { reportTarget: value as "nocodb" | "local" })
                }
              />
            </Group>
          </>
        )}

        {section === "appearance" && (
          <>
            <Group title="Tema">
              <Select
                label="Ana tema"
                hint="Windows ve KDE kesin desteklenir"
                value={settings.appearance.theme}
                options={THEME_OPTIONS}
                onChange={(value) =>
                  update("appearance", { theme: value as typeof settings.appearance.theme })
                }
              />
              <Slider
                label="Arayüz ölçeği"
                min={0.85}
                max={1.3}
                step={0.05}
                value={settings.appearance.scale}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(scale) => update("appearance", { scale })}
              />
              <Select
                label="Masaüstü ikon boyutu"
                hint="Windows'taki gibi küçük / orta / büyük"
                value={settings.appearance.iconSize}
                options={[
                  { value: "small", label: "Küçük", hint: "30 px" },
                  { value: "medium", label: "Orta", hint: "40 px" },
                  { value: "large", label: "Büyük", hint: "60 px" },
                ]}
                onChange={(value) =>
                  update("appearance", {
                    iconSize: value as typeof settings.appearance.iconSize,
                  })
                }
              />
            </Group>

            <Group title="Duvar kağıdı">
              <Select
                label="Arkaplan"
                value={settings.appearance.wallpaper.kind}
                options={WALLPAPER_OPTIONS}
                onChange={(kind) =>
                  update("appearance", {
                    wallpaper: {
                      ...settings.appearance.wallpaper,
                      kind: kind as typeof settings.appearance.wallpaper.kind,
                    },
                  })
                }
              />
              {settings.appearance.wallpaper.kind === "image" && (
                <Text
                  label="Görsel kaynağı"
                  hint="Yerel yolu veya https:// adresi"
                  value={settings.appearance.wallpaper.source}
                  placeholder="C:\\resimler\\duvar.jpg  veya  https://..."
                  onChange={(source) =>
                    update("appearance", {
                      wallpaper: { ...settings.appearance.wallpaper, source },
                    })
                  }
                />
              )}
              {settings.appearance.wallpaper.kind === "video" && (
                <>
                  <VideoWallpaperPicker
                    source={settings.appearance.wallpaper.source}
                    onChange={(source) =>
                      update("appearance", {
                        wallpaper: { ...settings.appearance.wallpaper, source },
                      })
                    }
                  />
                  <Text
                    label="veya video adresi"
                    hint="Doğrudan mp4/webm bağlantısı (https://…)"
                    value={
                      settings.appearance.wallpaper.source === "indexeddb"
                        ? ""
                        : settings.appearance.wallpaper.source
                    }
                    placeholder="https://ornek.com/duvar.mp4"
                    onChange={(source) =>
                      update("appearance", {
                        wallpaper: { ...settings.appearance.wallpaper, source },
                      })
                    }
                  />
                </>
              )}
              <Slider
                label="Karartma"
                min={0}
                max={0.9}
                step={0.05}
                value={settings.appearance.wallpaper.dim}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(dim) =>
                  update("appearance", {
                    wallpaper: { ...settings.appearance.wallpaper, dim },
                  })
                }
              />
            </Group>

            <Group title="İmleç">
              <Select
                label="Cursor"
                value={settings.appearance.cursor.kind}
                options={CURSOR_OPTIONS}
                onChange={(kind) =>
                  update("appearance", {
                    cursor: {
                      ...settings.appearance.cursor,
                      kind: kind as typeof settings.appearance.cursor.kind,
                    },
                  })
                }
              />
              <Slider
                label="İz uzunluğu"
                min={0}
                max={40}
                step={1}
                value={settings.appearance.cursor.trail}
                format={(v) => `${v} nokta`}
                onChange={(trail) =>
                  update("appearance", {
                    cursor: { ...settings.appearance.cursor, trail },
                  })
                }
              />
            </Group>

            <Group title="Erişilebilirlik">
              <Select
                label="Hareket"
                hint="'Azaltılmış' animasyonları neredeyse durdurur"
                value={settings.appearance.motion}
                options={[
                  { value: "full", label: "Tam" },
                  { value: "reduced", label: "Azaltılmış" },
                ]}
                onChange={(value) =>
                  update("appearance", { motion: value as "full" | "reduced" })
                }
              />
              <Toggle
                label="Bildirim sesleri"
                checked={settings.appearance.soundEnabled}
                onChange={(checked) => update("appearance", { soundEnabled: checked })}
              />
            </Group>
          </>
        )}

        {section === "login" && (
          <>
            <Group title="Giriş ekranı">
              <Select
                label="Login formu"
                hint="Sıkıldıkça değiştir — anında uygulanır"
                value={settings.login.form}
                options={LOGIN_FORM_OPTIONS}
                onChange={(value) =>
                  update("login", { form: value as typeof settings.login.form })
                }
              />
              <Text
                label="Kullanıcı adı etiketi"
                value={settings.login.usernameLabel}
                onChange={(usernameLabel) => update("login", { usernameLabel })}
              />
              <Text
                label="Parola etiketi"
                value={settings.login.passwordLabel}
                onChange={(passwordLabel) => update("login", { passwordLabel })}
              />
              <Toggle
                label="Lamba açılışta yanık"
                hint="Kapalıysa form görünmez; önce lambanın ipini çekmen gerekir (orijinal etkileşim)"
                checked={settings.login.lampStartLit}
                onChange={(lampStartLit) => update("login", { lampStartLit })}
              />
            </Group>

            <Group title="Şakalar">
              <Toggle
                label="Şakalar gösterilsin"
                hint="Açılışta rastgele, formun temasına uygun"
                checked={settings.login.jokes.enabled}
                onChange={(enabled) => update("login", { jokes: { ...settings.login.jokes, enabled } })}
              />
              <Slider
                label="Değişim sıklığı"
                min={0}
                max={60}
                step={2}
                value={settings.login.jokes.rotateSeconds}
                format={(v) => (v === 0 ? "sabit" : `${v} sn`)}
                onChange={(rotateSeconds) =>
                  update("login", { jokes: { ...settings.login.jokes, rotateSeconds } })
                }
              />
            </Group>

            <Group title="İki adımlı doğrulama (OTP)">
              <Toggle
                label="OTP istensin"
                checked={settings.login.otp.enabled}
                onChange={(enabled) => update("login", { otp: { ...settings.login.otp, enabled } })}
              />
              <NumberField
                label="Kod uzunluğu"
                min={4}
                max={8}
                value={settings.login.otp.length}
                onChange={(length) => update("login", { otp: { ...settings.login.otp, length } })}
              />
              <NumberField
                label="Yanlış deneme hakkı"
                hint="Aşılırsa ceza ekranı açılır"
                min={1}
                max={10}
                value={settings.login.otp.maxAttempts}
                onChange={(maxAttempts) =>
                  update("login", { otp: { ...settings.login.otp, maxAttempts } })
                }
              />
              <Select
                label="OTP ekranı tasarımı"
                value={settings.login.otp.style}
                options={OTP_STYLE_OPTIONS}
                onChange={(value) =>
                  update("login", {
                    otp: { ...settings.login.otp, style: value as "yeti" | "classic" },
                  })
                }
              />
              <Select
                label="OTP kanalı"
                value={settings.login.otp.channel}
                options={[
                  { value: "telegram", label: "Telegram (n8n üzerinden)" },
                  { value: "n8n", label: "n8n webhook" },
                  { value: "totp", label: "Authenticator (TOTP)" },
                ]}
                onChange={(value) =>
                  update("login", {
                    otp: { ...settings.login.otp, channel: value as typeof settings.login.otp.channel },
                  })
                }
              />
            </Group>

            <Group title="Ceza ekranı 💡">
              <Toggle
                label="Ceza ekranı aktif"
                hint="The Impossible Light Bulb animasyonu"
                checked={settings.login.punishment.enabled}
                onChange={(enabled) =>
                  update("login", { punishment: { ...settings.login.punishment, enabled } })
                }
              />
              <NumberField
                label="Geri sayım (saniye)"
                min={10}
                max={600}
                step={10}
                value={settings.login.punishment.countdownSeconds}
                onChange={(countdownSeconds) =>
                  update("login", {
                    punishment: { ...settings.login.punishment, countdownSeconds },
                  })
                }
              />
              <Toggle
                label="Ses çalınsın"
                checked={settings.login.punishment.sound}
                onChange={(sound) =>
                  update("login", { punishment: { ...settings.login.punishment, sound } })
                }
              />
              <Toggle
                label="Girdiyi kilitle"
                hint="Geri sayım boyunca hiçbir şey yapılamasın"
                checked={settings.login.punishment.lockInput}
                onChange={(lockInput) =>
                  update("login", { punishment: { ...settings.login.punishment, lockInput } })
                }
              />
            </Group>
          </>
        )}

        {section === "idle" && (
          <Group title="Boşta kalma ekranı">
            <Toggle
              label="Boşta ekranı aktif"
              checked={settings.idle.enabled}
              onChange={(enabled) => update("idle", { enabled })}
            />
            <NumberField
              label="Hareketsizlik süresi (dakika)"
              min={1}
              max={120}
              value={settings.idle.minutes}
              onChange={(minutes) => update("idle", { minutes })}
            />
            <Select
              label="Gösterilecek ekran"
              value={settings.idle.screen}
              options={IDLE_SCREEN_OPTIONS}
              onChange={(value) => update("idle", { screen: value as typeof settings.idle.screen })}
            />
            <Toggle
              label="Devam etmek için parola"
              checked={settings.idle.requirePassword}
              onChange={(requirePassword) => update("idle", { requirePassword })}
            />
          </Group>
        )}

        {section === "power" && (
          <Group title="Kapatma">
            <Toggle
              label="Animasyonlu kapatma butonu"
              hint="Animated Logout Button"
              checked={settings.power.animatedShutdown}
              onChange={(animatedShutdown) => update("power", { animatedShutdown })}
            />
            <Toggle
              label="Kapatmadan önce onay iste"
              checked={settings.power.confirmShutdown}
              onChange={(confirmShutdown) => update("power", { confirmShutdown })}
            />
          </Group>
        )}

        {section === "loading" && (
          <Group title="Bekleme ve yükleme">
            <Select
              label="İlerleme çubuğu"
              hint="Belirli süreli işlemler"
              value={settings.loading.progressBarStyle}
              options={[
                { value: "deadline", label: "Interactive Deadline", hint: "Kalan süreyi gösterir" },
                { value: "simple", label: "Basit çubuk" },
              ]}
              onChange={(value) =>
                update("loading", {
                  progressBarStyle: value as typeof settings.loading.progressBarStyle,
                })
              }
            />
            <Toggle
              label="Bekleme perdesi"
              hint="Belirsiz beklemelerde bg.gif gösterilir"
              checked={settings.loading.waitingCurtain}
              onChange={(waitingCurtain) => update("loading", { waitingCurtain })}
            />
            <Slider
              label="Perde karartması"
              min={0}
              max={0.95}
              step={0.05}
              value={settings.loading.curtainDim}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(curtainDim) => update("loading", { curtainDim })}
            />
          </Group>
        )}

        <div className="settings__actions">
          <button
            type="button"
            className="settings__button"
            onClick={() => resetSection(section)}
          >
            Bu bölümü sıfırla
          </button>
          <button
            type="button"
            className="settings__button settings__button--danger"
            onClick={() => {
              if (window.confirm("Tüm ayarlar varsayılana dönecek. Emin misin?")) {
                reset();
              }
            }}
          >
            Tümünü sıfırla
          </button>

          <details className="settings__advanced">
            <summary>Aktar / içe al (JSON)</summary>
            <div className="settings__advanced-body">
              <button
                type="button"
                className="settings__button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(exportJson())
                    .then(() => setImportMessage("Ayarlar panoya kopyalandı."));
                }}
              >
                Panoya kopyala
              </button>
              <textarea
                className="settings__textarea"
                rows={7}
                placeholder="Ayar JSON'unu buraya yapıştır"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <button
                type="button"
                className="settings__button"
                onClick={() => {
                  const result = importJson(importText);
                  setImportMessage(result.ok ? "Ayarlar içe alındı." : `Hata: ${result.error}`);
                }}
              >
                İçe al
              </button>
            </div>
          </details>

          {importMessage && <span className="settings__message">{importMessage}</span>}
        </div>
        {section === "bridge" && (
          <Group title="Yerel köprü (Faz 3)">
            <p className="settings__note">
              Tarayıcı donanımın tamamına erişemez. Yerel köprü, konsolda
              <strong> kurulu programları, servisleri, işlemleri, disk bölümlerini
              ve gerçek IP/MAC adreslerini</strong> gösterebilmek için gerekir.
              Kurulum: <code>services/bridge/start-bridge.bat</code>
            </p>

            <Toggle
              label="Köprüyü kullan"
              hint="Kapalıysa konsol yalnızca tarayıcı verisini gösterir"
              checked={settings.bridge.enabled}
              onChange={(enabled) => update("bridge", { enabled })}
            />

            <Text
              label="Köprü adresi"
              hint="Varsayılan: http://127.0.0.1:8765"
              value={settings.bridge.url}
              placeholder="http://127.0.0.1:8765"
              onChange={(url) => update("bridge", { url })}
            />

            <Text
              label="Erişim tokenı"
              hint="Köprü başlarken konsola yazdırır — gizli tutun"
              value={settings.bridge.token}
              placeholder="UzunRastgeleToken…"
              onChange={(token) => update("bridge", { token })}
            />

            <Toggle
              label="Açılışta otomatik sorgula"
              hint="Konsol açılırken köprüye bağlanmayı dene"
              checked={settings.bridge.autoProbe}
              onChange={(autoProbe) => update("bridge", { autoProbe })}
            />

            <BridgeStatus url={settings.bridge.url} token={settings.bridge.token} />
          </Group>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
//  Köprü durum göstergesi (canlı test)
// ----------------------------------------------------------------------
function BridgeStatus({ url, token }: { url: string; token: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok"; detail: string }
    | { kind: "fail"; detail: string }
  >({ kind: "idle" });

  async function check(): Promise<void> {
    setState({ kind: "checking" });
    const health = await probeBridge({ url, token: token || undefined });
    if (!health) {
      setState({
        kind: "fail",
        detail: `Köprü yanıt vermedi (${url || "http://127.0.0.1:8765"}).`,
      });
      return;
    }
    const info = await fetchBridgeInfo({ url, token: token || undefined });
    setState({
      kind: "ok",
      detail: `v${health.version} · ${health.platform} · psutil ${health.psutil ? "var" : "yok"}${
        info ? ` · ${Object.keys(info.report).length} bölüm, ${info.duration_ms} ms` : ""
      }`,
    });
  }

  return (
    <div className="bridge-status">
      <button type="button" className="app-btn" onClick={() => void check()}>
        {state.kind === "checking" ? "…" : "Bağlantıyı test et"}
      </button>
      {state.kind === "ok" && <span className="bridge-status__ok">✔ {state.detail}</span>}
      {state.kind === "fail" && <span className="bridge-status__fail">✘ {state.detail}</span>}
      {state.kind === "fail" && (
        <span className="bridge-status__hint">
          Köprüyü başlatın: <code>services/bridge/start-bridge.bat</code>
        </span>
      )}
    </div>
  );
}

// ======================================================================
//  Alan bileşenleri
// ======================================================================

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings__group">
      <h3 className="settings__group-title">{title}</h3>
      <div className="settings__group-body">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="field__label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="field__control">{children}</div>
    </div>
  );
}

function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <Field label={label} hint={hint ?? selected?.hint}>
      <select
        className="field__select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <label className={`switch${checked ? " is-on" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch__track">
          <span className="switch__thumb" />
        </span>
      </label>
    </Field>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider__value">{format ? format(value) : String(value)}</span>
      </div>
    </Field>
  );
}

function Text({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className="field__input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function NumberField({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className="field__input field__input--number"
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
      />
    </Field>
  );
}

/**
 * Açılış adımlarının sırasını düzenler (yukarı/aşağı taşıma).
 * Kullanıcı "akış ayar olarak değiştirilebilsin" dediği için burada.
 */
function FlowOrderEditor({
  order,
  onChange,
}: {
  order: FlowStep[];
  onChange: (order: FlowStep[]) => void;
}) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="flow-order">
      {order.map((step, index) => (
        <div className="flow-order__row" key={step}>
          <span className="flow-order__index">{index + 1}</span>
          <span className="flow-order__label">{FLOW_STEP_LABELS[step] ?? step}</span>
          <button
            type="button"
            className="flow-order__btn"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="Yukarı taşı"
          >
            ▲
          </button>
          <button
            type="button"
            className="flow-order__btn"
            onClick={() => move(index, 1)}
            disabled={index === order.length - 1}
            aria-label="Aşağı taşı"
          >
            ▼
          </button>
        </div>
      ))}
      <button
        type="button"
        className="settings__button"
        onClick={() => onChange([...DEFAULT_SETTINGS.flow.order])}
      >
        Varsayılan sıraya dön
      </button>
    </div>
  );
}
