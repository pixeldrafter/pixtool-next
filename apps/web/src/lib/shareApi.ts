/**
 * Paylaşım istemcisi — kullanıcılar arası dosya/klasör/not.
 */

import { API_BASE } from "./apiBase";

export interface ShareRecord {
  id: string;
  from: string;
  to: string;
  kind: string;
  name: string;
  content?: string;
  path?: string;
  note?: string;
  createdAt?: number;
}

interface ShareListResponse {
  ok: boolean;
  count: number;
  shares: ShareRecord[];
}

interface ShareCreateResponse {
  ok: boolean;
  share: ShareRecord;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Bana yapılan paylaşımları getirir. */
export async function fetchShares(token: string): Promise<ShareRecord[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/shares`, {
      headers: authHeaders(token),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as ShareListResponse;
    return data.shares ?? [];
  } catch {
    return [];
  }
}

/** Bir kullanıcıya paylaşım gönderir. */
export async function createShare(
  token: string,
  payload: {
    to: string;
    kind: string;
    name: string;
    content?: string;
    path?: string;
    note?: string;
  },
): Promise<ShareRecord | null> {
  const response = await fetch(`${API_BASE}/api/v1/shares`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      (detail as { detail?: string } | null)?.detail ??
        `Paylaşım başarısız (HTTP ${response.status}).`,
    );
  }
  const data = (await response.json()) as ShareCreateResponse;
  return data.share ?? null;
}

/** Paylaşımı kaldırır (alıcı). */
export async function deleteShare(token: string, shareId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/shares/${encodeURIComponent(shareId)}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    return response.ok;
  } catch {
    return false;
  }
}
