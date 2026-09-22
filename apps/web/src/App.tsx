/**
 * Uygulama kökü.
 *
 * Akış (ayarlardan değiştirilebilir — settings.flow.order):
 *   varsayılan: Giriş → Konsol → Boot → Masaüstü
 *
 * Faz A durumu:
 *   ✅ boot → masaüstü geçişi çalışıyor
 *   ✅ tema senkronizasyonu (Windows / KDE / Neon)
 *   ✅ ayarlar deposu + Ayarlar penceresi
 *   ⏳ login / konsol adımları sonraki adımda eklenecek
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BootScreen } from "./boot/BootScreen";
import { Desktop } from "./desktop/Desktop";
import { describeError, fetchStatus, type StatusResponse } from "./lib/api";
import { useSettings } from "./settings";
import { ThemeBackdrop, useThemeSync } from "./theme";

type Phase = "boot" | "desktop";

export default function App() {
  // Tema + hareket + ölçek ayarlarını DOM'a uygular
  useThemeSync();

  const { settings } = useSettings();
  const [phase, setPhase] = useState<Phase>("boot");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);

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

  // Sekme başlığı
  useEffect(() => {
    if (phase === "boot") {
      document.title = "PIXTOOL — System Boot";
    } else if (error) {
      document.title = "Pixtool Next — bağlantı yok";
    } else {
      document.title = `Pixtool Next — ${status?.app.version ?? ""}`.trim();
    }
  }, [phase, error, status]);

  // Ayarlarda konsol kapalıysa boot ekranı atlanır (sessiz açılış)
  useEffect(() => {
    if (settings.flow.consoleVerbosity === "off" && phase === "boot") {
      const timer = window.setTimeout(() => setPhase("desktop"), 400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [settings.flow.consoleVerbosity, phase]);

  return (
    <>
      <ThemeBackdrop />
      {phase === "boot" ? (
        <BootScreen status={status} error={error} onFinished={() => setPhase("desktop")} />
      ) : (
        <Desktop
          status={status}
          error={error}
          loading={loading}
          onRefresh={() => void load()}
        />
      )}
    </>
  );
}
