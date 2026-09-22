/**
 * Uygulama kökü.
 *
 * Akış:
 *   1. `/api/v1/status` çekilir (boot ile paralel)
 *   2. Boot ekranı diziyi oynatır
 *   3. Kullanıcı tıklar / Enter → masaüstü kabuğu
 *
 * Faz 1'de araya login + OTP ekranı girecek.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BootScreen } from "./boot/BootScreen";
import { Desktop } from "./desktop/Desktop";
import { describeError, fetchStatus, type StatusResponse } from "./lib/api";

type Phase = "boot" | "desktop";

export default function App() {
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

  // Sekme başlığını duruma göre güncelle
  useEffect(() => {
    if (phase === "boot") {
      document.title = "PIXTOOL — System Boot";
    } else if (error) {
      document.title = "Pixtool Next — bağlantı yok";
    } else {
      document.title = `Pixtool Next — ${status?.app.version ?? ""}`.trim();
    }
  }, [phase, error, status]);

  if (phase === "boot") {
    return (
      <BootScreen
        status={status}
        error={error}
        onFinished={() => setPhase("desktop")}
      />
    );
  }

  return <Desktop status={status} error={error} loading={loading} onRefresh={() => void load()} />;
}
