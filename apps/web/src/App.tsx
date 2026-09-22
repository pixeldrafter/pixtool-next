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
import { CursorLayer } from "./cursor";
import { Desktop } from "./desktop/Desktop";
import { IdleScreen, useIdle } from "./idle";
import { describeError, fetchStatus, type StatusResponse } from "./lib/api";
import { LoginScreen, type LoginSession } from "./login";
import { useSettings } from "./settings";
import type { FlowStep } from "./settings/types";
import { ThemeBackdrop, useThemeSync } from "./theme";

export default function App() {
  // Tema + hareket + ölçek ayarlarını DOM'a uygular
  useThemeSync();

  const { settings } = useSettings();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LoginSession | null>(null);
  const [reportSaved, setReportSaved] = useState<boolean | null>(null);

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

      case "console":
        return (
          <ConsoleScreen
            token={session?.token}
            onFinished={({ saved }) => {
              setReportSaved(saved);
              goNext();
            }}
          />
        );

      case "boot":
        return <BootScreen status={status} error={error} onFinished={goNext} />;

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

      {isIdle && <IdleScreen onDismiss={resetIdle} />}
    </>
  );
}
