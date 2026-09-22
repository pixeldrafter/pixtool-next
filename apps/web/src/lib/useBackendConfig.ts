/**
 * Backend yapılandırması — tek kaynaktan okuma.
 *
 * `command_policy`, `db_adapter` ve NocoDB tablo adları **backend'de**
 * (`.env`) tanımlıdır. Arayüz bunları kendi ayar deposuna kopyalamaz;
 * `/api/v1/status` üzerinden okur. Böylece tek doğruluk kaynağı olur.
 *
 * Kullanım:
 *   const { commandPolicy, dbAdapter, nocodbTables, loading } = useBackendConfig();
 */

import { useEffect, useState } from "react";

import { fetchStatus, type StatusResponse } from "./api";

export interface BackendConfig {
  commandPolicy: "confirm" | "whitelist" | "allow_all";
  dbAdapter: string;
  nocodbTables: Record<string, string>;
  platforms: { windows: string; linux: string };
  loading: boolean;
  error: string | null;
  /** Yeniden çek */
  refresh: () => void;
}

export function useBackendConfig(): BackendConfig {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchStatus()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Bilinmeyen hata");
        setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const policy = status?.features.command_policy;

  return {
    commandPolicy:
      policy === "whitelist" || policy === "allow_all" || policy === "confirm"
        ? policy
        : "confirm",
    dbAdapter: status?.features.db_adapter ?? "nocodb",
    nocodbTables: status?.integrations.nocodb.tables ?? {},
    platforms: status?.features.platforms ?? { windows: "10,11", linux: "ubuntu,debian" },
    loading,
    error,
    refresh: () => setNonce((value) => value + 1),
  };
}
