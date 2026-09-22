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
  /** Tablo eşlemeleri — backend `.env`'den gelir */
  tables?: Record<string, string>;
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

// ======================================================================
//  SCRIPT KÜTÜPHANESİ
// ======================================================================
export interface ScriptInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  extension: string;
  size_bytes: number;
  lines: number;
  author: string | null;
  version: string | null;
}

export interface ScriptListResponse {
  ok: boolean;
  count: number;
  categories: string[];
  scripts: ScriptInfo[];
}

export interface ScriptDetailResponse {
  ok: boolean;
  script: ScriptInfo;
  content: string;
}

export interface RunScriptResponse {
  ok: boolean;
  status: string;
  command: string;
  output?: string;
  exit_code?: number | null;
  message?: string | null;
}

export function fetchScripts(signal?: AbortSignal): Promise<ScriptListResponse> {
  return request<ScriptListResponse>("/api/v1/scripts", signal);
}

export function fetchScript(id: string, signal?: AbortSignal): Promise<ScriptDetailResponse> {
  return request<ScriptDetailResponse>(`/api/v1/scripts/${encodeURIComponent(id)}`, signal);
}

export async function runScript(
  id: string,
  options: { target?: string; policy?: string } = {},
): Promise<RunScriptResponse> {
  const response = await fetch(`${API_BASE}/api/v1/scripts/${encodeURIComponent(id)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ script_id: id, target: options.target ?? "local", policy: options.policy }),
  });

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return parsed as RunScriptResponse;
}

// ======================================================================
//  UZAK ERİŞİM (SSH / SFTP)
// ======================================================================
export interface RemoteStatus {
  ok: boolean;
  paramiko_available: boolean;
  default_host_set: boolean;
  default_user_set: boolean;
  default_host: string | null;
  default_user: string | null;
  command_policy: string;
  hint: string | null;
}

export interface SshExecResponse {
  ok: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration_ms: number;
  message: string | null;
}

export interface RemoteFile {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  modified: string | null;
  permissions: string | null;
}

export interface SftpListResponse {
  ok: boolean;
  path: string;
  entries: RemoteFile[];
  message: string | null;
}

export interface RemoteInfoResponse {
  ok: boolean;
  hostname: string | null;
  os: string | null;
  kernel: string | null;
  uptime: string | null;
  cpu_cores: number | null;
  memory_total_mb: number | null;
  memory_used_mb: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  message: string | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return parsed as T;
}

export function fetchRemoteStatus(signal?: AbortSignal): Promise<RemoteStatus> {
  return request<RemoteStatus>("/api/v1/remote/status", signal);
}

export function sshExec(command: string, timeoutSeconds = 30): Promise<SshExecResponse> {
  return post<SshExecResponse>("/api/v1/remote/exec", { command, timeout_seconds: timeoutSeconds });
}

export function sftpList(path = "."): Promise<SftpListResponse> {
  return post<SftpListResponse>("/api/v1/remote/list", { path });
}

export function fetchRemoteInfo(): Promise<RemoteInfoResponse> {
  return post<RemoteInfoResponse>("/api/v1/remote/info", {});
}
