/**
 * Yönetici istemcisi — kullanıcı listesi, rol ve izin yönetimi.
 */

import { API_BASE } from "./apiBase";

export interface AdminUser {
  id: number | string;
  username: string;
  role: string;
  active: boolean;
  permissions: { apps: string[]; all?: boolean; role?: string };
}

interface UsersResponse {
  ok: boolean;
  users: AdminUser[];
  allApps: string[];
}

function headers(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function fetchAdminUsers(
  token: string,
): Promise<{ users: AdminUser[]; allApps: string[] }> {
  const response = await fetch(`${API_BASE}/api/v1/admin/users`, { headers: headers(token) });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Bu bölüm için yönetici yetkisi gerekli.");
    throw new Error(`Kullanıcılar alınamadı (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as UsersResponse;
  return { users: data.users ?? [], allApps: data.allApps ?? [] };
}

export async function updateAdminUser(
  token: string,
  id: number | string,
  patch: { role?: string; active?: boolean },
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/admin/users/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Güncellenemedi (HTTP ${response.status}).`);
}

export async function setUserPermissions(
  token: string,
  username: string,
  apps: string[],
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/admin/users/${encodeURIComponent(username)}/permissions`,
    { method: "PUT", headers: headers(token), body: JSON.stringify({ apps }) },
  );
  if (!response.ok) throw new Error(`İzinler kaydedilemedi (HTTP ${response.status}).`);
}
