/**
 * Konsol → backend rapor gönderimi.
 */

import type { MachineInfo } from "./probe";
import { API_BASE } from "../lib/apiBase";

export interface DeviceReportResponse {
  ok: boolean;
  device_id?: string;
  stored_in?: string;
  message?: string;
}

/**
 * Makine raporunu backend'e gönderir.
 *
 * Backend NocoDB yapılandırılmamışsa raporu **yerel dosyaya** yazar ve
 * `stored_in: "local"` döner — böylece kullanıcı bilgiyi kaybetmez.
 */
export async function saveDeviceReport(
  info: MachineInfo,
  token?: string,
): Promise<DeviceReportResponse> {
  const response = await fetch(`${API_BASE}/api/v1/devices/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      report: info,
      collected_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}${text ? ` — ${text.slice(0, 120)}` : ""}`);
  }

  return (await response.json()) as DeviceReportResponse;
}
