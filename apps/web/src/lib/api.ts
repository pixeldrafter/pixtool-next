/**
 * Backend API istemcisi.
 *
 * Geliştirmede Vite proxy'si `/api` isteklerini http://127.0.0.1:8000'e
 * yönlendirir; üretimde aynı origin'den servis edilir.
 */

const API_BASE: string = import.meta.env["VITE_API_BASE"] ?? "";

// ----------------------------------------------------------------------
//  Tipler — backend `/api/v1/status` şemasıyla eşleşir
// ----------------------------------------------------------------------
export interface AppInfo {
  name: string;
  version: string;
  env: string;
  debug: boolean;
  lang: string;
}

export interface PlatformInfo {
  windows: string;
  linux: string;
}

export interface FeaturesInfo {
  db_adapter: string;
  command_policy: string;
  platforms: PlatformInfo;
}

export interface IntegrationState {
  configured: boolean;
}

export interface NocoDBState extends IntegrationState {
  placeholder: boolean;
  reachable: boolean;
  ok: boolean;
  base_url: string;
  detail: string;
}

export interface IntegrationsInfo {
  nocodb: NocoDBState;
  n8n: IntegrationState;
  telegram: IntegrationState;
  bridge: IntegrationState;
}

export interface StatusResponse {
  app: AppInfo;
  features: FeaturesInfo;
  integrations: IntegrationsInfo;
  warnings: string[];
}

export interface HealthResponse {
  status: string;
  name: string;
  version: string;
  env: string;
}

// ----------------------------------------------------------------------
//  Yardımcı
// ----------------------------------------------------------------------
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${path}`);
  }

  return (await response.json()) as T;
}

// ----------------------------------------------------------------------
//  Uç noktalar
// ----------------------------------------------------------------------
export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", signal);
}

export function fetchStatus(signal?: AbortSignal): Promise<StatusResponse> {
  return request<StatusResponse>("/api/v1/status", signal);
}

/**
 * Backend'e erişilemiyorsa hatayı okunabilir bir metne çevirir.
 */
export function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "İstek iptal edildi.";
  }
  if (error instanceof TypeError) {
    return "Backend'e ulaşılamadı. `pnpm dev:api` çalışıyor mu?";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Bilinmeyen hata.";
}
