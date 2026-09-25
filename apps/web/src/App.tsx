/**
 * Uygulama kökü — açılış akışı yöneticisi.
 *
 * Akış sırası **ayarlardan** gelir (`settings.flow.order`), varsayılan:
 *   Giriş → Konsol → Boot → Masaüstü
 *
 * Adımlar dinamik olarak atlanabilir:
 *   • `flow.consoleVerbosity === "off"` → konsol adımı atlanır
 *   • `order` dizisinden çıkarılan adım hiç çalışmaz
 *
 * Katman sırası (aşağıdan yukarıya):
 *   ThemeBackdrop → (akış adımı) → CursorLayer → IdleScreen
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BootScreen } from "./boot/BootScreen";
import { ConsoleScreen } from "./console";
import { probeMachine, type MachineInfo } from "./console/probe";
import { resolveBridgeOptions } from "./console/bridge";
import { CursorLayer } from "./cursor";
import { Desktop } from "./desktop/Desktop";
import { IdleScreen, useIdle } from "./idle";
import { describeError, fetchStatus, type StatusResponse } from "./lib/api";
import { useUserSync } from "./lib/userSync";
import { IntroVideo, LoginScreen, OtpDemo, type LoginSession } from "./login";
import { PunishmentScreen } from "./login/PunishmentScreen";
import { getLoginTheme } from "./login/themes";
import { ToastLayer } from "./notifications";
import { UpdateBanner } from "./updater/UpdateBanner";
import { useSettings } from "./settings";
import { LOGIN_FORM_OPTIONS, type FlowStep } from "./settings";
import { ThemeBackdrop, useThemeSync } from "./theme";

export default function App() {
  // Tema + hareket + ölçek ayarlarını DOM'a uygular
  useThemeSync();

  // ------------------------------------------------------------------
  //  GELİŞTİRME ARACI: ?demo=otp → OTP animasyon demosu
  //  Üretim akışını etkilemez, yalnızca tasarım doğrulaması içindir.
  // ------------------------------------------------------------------
  const demoMode = new URLSearchParams(window.location.search).get("demo");
  if (demoMode === "otp") {
    return (
      <>
        <ThemeBackdrop />
        <OtpDemo />
      </>
    );
  }

  const { settings, update } = useSettings();

  // ------------------------------------------------------------------
  //  GELİŞTİRME ARACI: ?demo=punishment → ceza ekranı önizlemesi
  //  ?demo=punishment&punishSeconds=15  ile süre kısaltılabilir.
  // ------------------------------------------------------------------
  if (demoMode === "punishment") {
    const demoSeconds = Number(
      new URLSearchParams(window.location.search).get("punishSeconds") ?? "120",
    );
    return (
      <>
        <ThemeBackdrop />
        <PunishmentScreen
          theme={getLoginTheme(settings.login.form)}
          seconds={Number.isFinite(demoSeconds) && demoSeconds > 0 ? demoSeconds : 120}
          wrongAttempts={settings.login.otp.maxAttempts}
          onFinished={() => {
            window.location.search = "";
          }}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  //  URL ile geçici geçersiz kılma (geliştirme / test)
  //    ?login=yeti  ?theme=kde  ?step=login  ?skip=1
  //  Kalıcı ayarı DEĞİŞTİRMEZ; yalnızca bu oturum için uygular.
  // ------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const form = params.get("login");
    if (form && LOGIN_FORM_OPTIONS.some((option) => option.value === form)) {
      update("login", { form: form as typeof settings.login.form });
    }

    const theme = params.get("theme");
    if (theme && ["windows", "kde", "neon"].includes(theme)) {
      update("appearance", { theme: theme as typeof settings.appearance.theme });
    }

    const otp = params.get("otp");
    if (otp === "yeti" || otp === "classic") {
      update("login", { otp: { ...settings.login.otp, style: otp } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LoginSession | null>(null);

  // Kullanıcıya özel kalıcılık: yerel önbellek + sunucu senkronu (notlar,
  // masaüstü öğeleri/dosyaları). Giriş yapılınca yükler, değişince kaydeder.
  useUserSync(session ? { token: session.token, username: session.username } : null);
  const [reportSaved, setReportSaved] = useState<boolean | null>(null);
  /**
   * Makine envanteri — **bir kez** taranır, konsol ve boot ekranı paylaşır.
   *
   * Neden App'te? Köprü toplaması ~5 sn sürer; iki ekranda ayrı ayrı
   * taramak hem gecikmeyi ikiye katlar hem de sayfa yenilendiğinde
   * (derin bağlantı) donanım satırlarını boş bırakırdı.
   */
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const machineRequested = useRef(false);

  const abortRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  //  Aktif akış adımları — ayarlara göre süzülür
  // ------------------------------------------------------------------
  const activeSteps = useMemo<FlowStep[]>(() => {
    return settings.flow.order.filter((step) => {
      // Konsol kapalıysa bu adım hiç çalışmaz
      if (step === "console") return settings.flow.consoleVerbosity !== "off";
      return true;
    });
  }, [settings.flow.order, settings.flow.consoleVerbosity]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep: FlowStep = activeSteps[stepIndex] ?? "desktop";

  const goNext = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, Math.max(activeSteps.length - 1, 0)));
  }, [activeSteps.length]);

  // Ayar değişince akış başa döner (örn. konsol kapatıldı)
  useEffect(() => {
    setStepIndex((index) => Math.min(index, Math.max(activeSteps.length - 1, 0)));
  }, [activeSteps.length]);

  // ------------------------------------------------------------------
  //  Makine envanteri — konsol/boot adımına gelindiğinde bir kez tara
  // ------------------------------------------------------------------
  useEffect(() => {
    const needsInventory = currentStep === "console" || currentStep === "boot";
    if (!needsInventory || machine || machineRequested.current) return;
    if (!settings.bridge.enabled) return;

    machineRequested.current = true;

    void (async () => {
      try {
        const bridgeOptions = settings.bridge.autoProbe
          ? await resolveBridgeOptions({
              url: settings.bridge.url,
              token: settings.bridge.token || undefined,
            })
          : undefined;

        const result = await probeMachine({
          skipBridge: !settings.bridge.autoProbe,
          ...(bridgeOptions ?? {}),
        });
        setMachine(result);
      } catch {
        // Tarama başarısız olsa bile akış devam etmeli
      }
    })();
  }, [currentStep, machine, settings.bridge]);

  // ------------------------------------------------------------------
  //  GELİŞTİRME ARACI: ?step=desktop → doğrudan o adıma atla
  //  (giriş/konsol/boot adımlarını atlar — tasarım doğrulaması için)
  // ------------------------------------------------------------------
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("step");
    if (!target) return;

    const index = activeSteps.indexOf(target as FlowStep);
    if (index < 0) return;

    // Oturum yoksa sahte bir oturum ver ki masaüstü düzgün çizilsin
    if (target === "desktop") {
      setSession({ token: "dev", username: "dev" });
    }
    setStepIndex(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSteps.join(",")]);

  // ------------------------------------------------------------------
  //  Backend durumu
  // ------------------------------------------------------------------
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const data = await fetchStatus(controller.signal);
      setStatus(data);
      setError(null);
    } catch (caught) {
      setError(describeError(caught));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  // ------------------------------------------------------------------
  //  Sekme başlığı
  // ------------------------------------------------------------------
  useEffect(() => {
    const titles: Record<FlowStep, string> = {
      login: "PIXTOOL — Giriş",
      intro: "PIXTOOL — Tanıtım",
      console: "PIXTOOL — Sistem Envanteri",
      boot: "PIXTOOL — System Boot",
      desktop: "PIXTOOL — Masaüstü",
    };
    document.title = titles[currentStep] ?? "PIXTOOL";
  }, [currentStep]);

  // ------------------------------------------------------------------
  //  Hareketsizlik (yalnızca masaüstünde anlamlı)
  // ------------------------------------------------------------------
  const { isIdle, reset: resetIdle } = useIdle(
    currentStep === "desktop" && settings.idle.enabled && settings.idle.screen !== "none",
    settings.idle.minutes,
  );

  // ------------------------------------------------------------------
  //  Adım çizimi
  // ------------------------------------------------------------------
  function renderStep() {
    switch (currentStep) {
      case "login":
        return (
          <LoginScreen
            onSuccess={(granted) => {
              setSession(granted);
              goNext();
            }}
          />
        );

      case "intro":
        return (
          <IntroVideo
            src={settings.flow.introVideo}
            skipAfterSeconds={settings.flow.introSkipAfterSeconds}
            onFinished={goNext}
          />
        );

      case "console":
        return (
          <ConsoleScreen
            token={session?.token}
            machine={machine}
            onMachine={setMachine}
            onFinished={({ saved }) => {
              setReportSaved(saved);
              goNext();
            }}
          />
        );

      case "boot":
        return (
          <BootScreen
            status={status}
            error={error}
            machine={machine}
            onFinished={goNext}
          />
        );

      case "desktop":
      default:
        return (
          <Desktop
            status={status}
            error={error}
            loading={loading}
            session={session}
            reportSaved={reportSaved}
            onRefresh={() => void load()}
            onLock={() => resetIdle()}
            onLogout={() => {
              setSession(null);
              setReportSaved(null);
              setStepIndex(0);
            }}
          />
        );
    }
  }

  return (
    <>
      <ThemeBackdrop />

      {renderStep()}

      <CursorLayer />

      {/* Windows 11 tarzı bildirimler — sağ altta */}
      <ToastLayer />

      {/* Kabuk güncellemesi bildirimi (arayüz sunucudan otomatik güncellenir) */}
      <UpdateBanner />

      {isIdle && <IdleScreen onDismiss={resetIdle} />}
    </>
  );
}
