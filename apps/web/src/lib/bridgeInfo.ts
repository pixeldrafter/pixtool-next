/**
 * Yerel köprü bilgisi istemcisi (`/info`).
 *
 * Köprü 12 toplayıcı çalıştırır; arayüz yalnızca ihtiyaç duyduğu bölümleri
 * ister (`?parts=cpu,memory,disks`). Toplayıcılar paralel çalışır (~6 sn).
 */

const DEFAULT_BRIDGE = "http://127.0.0.1:8765";

/** Köprü `parts` değerleri. */
export type BridgePart =
  | "system"
  | "cpu"
  | "memory"
  | "disks"
  | "network"
  | "gpu"
  | "processes"
  | "services"
  | "users"
  | "programs"
  | "security"
  | "environment";

/** Köprü yanıtı — yalnızca kullanılan alanlar tiplenir. */
export interface BridgeInfo {
  ok: boolean;
  bridge_version?: string;
  collected_at?: string;
  duration_ms?: number;
  psutil?: boolean;
  system?: {
    hostname?: string;
    os?: string;
    os_version?: string;
    platform?: string;
    arch?: string;
    python?: string;
    user?: string;
    boot_time?: string;
    uptime?: string;
    uptime_seconds?: number;
  };
  cpu?: {
    model?: string;
    cores_physical?: number;
    cores_logical?: number;
    percent?: number;
    frequency_mhz?: number;
    temperature_c?: number | null;
    load_avg?: number[];
    per_core?: number[];
  };
  memory?: {
    total_bytes?: number;
    used_bytes?: number;
    available_bytes?: number;
    percent?: number;
    swap_total_bytes?: number;
    swap_used_bytes?: number;
    total?: string;
    used?: string;
    available?: string;
  };
  disks?: {
    device?: string;
    mountpoint?: string;
    filesystem?: string;
    total_bytes?: number;
    used_bytes?: number;
    free_bytes?: number;
    percent?: number;
    total?: string;
    used?: string;
    free?: string;
  }[];
  network?: {
    hostname?: string;
    interfaces?: {
      name?: string;
      address?: string;
      mac?: string;
      speed_mbps?: number | null;
      is_up?: boolean;
    }[];
    primary_ip?: string;
    external_ip?: string | null;
    bytes_sent?: number;
    bytes_recv?: number;
    sent?: string;
    received?: string;
    gateway?: string;
    dns?: string[];
  };
  gpu?: {
    name?: string;
    memory_total_mb?: number | null;
    memory_used_mb?: number | null;
    driver?: string | null;
    temperature_c?: number | null;
  }[];
  processes?: {
    total?: number;
    by_cpu?: { pid?: number; name?: string; cpu_percent?: number; memory_percent?: number }[];
    by_memory?: { pid?: number; name?: string; cpu_percent?: number; memory_percent?: number }[];
  };
  services?: {
    total?: number;
    running?: number;
    stopped?: number;
    items?: { name?: string; display_name?: string; status?: string; start_type?: string }[];
  };
  users?: {
    current?: string;
    logged_in?: { name?: string; terminal?: string; host?: string; since?: string }[];
  };
  security?: {
    firewall?: string | boolean;
    antivirus?: string | null;
    defender_enabled?: boolean | null;
    last_updates?: string[];
    secure_boot?: boolean | null;
    bitlocker?: string | null;
  };
  environment?: Record<string, string>;
}

/** Köprüden bilgi çeker. */
export async function fetchBridgeInfo(
  parts: BridgePart[],
  options: { baseUrl?: string; token?: string; signal?: AbortSignal } = {},
): Promise<BridgeInfo> {
  const base = (options.baseUrl || DEFAULT_BRIDGE).replace(/\/+$/, "");
  const query = parts.length ? `?parts=${parts.join(",")}` : "";

  const headers: Record<string, string> = {};
  if (options.token) headers["X-Pixtool-Token"] = options.token;

  let response: Response;
  try {
    response = await fetch(`${base}/info${query}`, { headers, signal: options.signal });
  } catch (caught) {
    throw new Error(
      `Yerel köprüye ulaşılamadı (${base}) — ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(`Köprü HTTP ${response.status}`);
  }

  return (await response.json()) as BridgeInfo;
}

/** Sayıyı okunabilir boyuta çevirir. */
export function humanBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Saniyeyi okunabilir süreye çevirir. */
export function humanDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days} gün ${hours} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dk`;
  return `${minutes} dk`;
}
