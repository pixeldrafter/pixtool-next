/**
 * Yedek (snapshot) istemcisi.
 *
 * Masaüstü durumu (öğeler, dosyalar, notlar, widget'lar) bir bütün olarak
 * sunucuya kaydedilir ve istenirse geri yüklenir.
 */

import { API_BASE, authHeaders } from "./apiBase";

export interface BackupMeta {
  id: string | number;
  label: string;
  size: number;
  createdAt: string;
}

export interface SnapshotPayload {
  items?: unknown;
  gridSnap?: boolean;
  seeded?: boolean;
  notes?: unknown;
  topZ?: number;
  widgets?: unknown;
  width?: number;
}

export async function fetchBackups(): Promise<BackupMeta[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/backups`, { headers: authHeaders() });
    if (!response.ok) return [];
    const data = (await response.json()) as { backups?: BackupMeta[] };
    return data.backups ?? [];
  } catch {
    return [];
  }
}

export async function createBackup(label: string, payload: SnapshotPayload): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/v1/backups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, payload }),
  });
  return response.ok;
}

export async function fetchBackup(
  id: string | number,
): Promise<{ label: string; payload: SnapshotPayload } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/backups/${encodeURIComponent(String(id))}`, {
      headers: authHeaders(),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { label: string; payload: SnapshotPayload };
    return { label: data.label, payload: data.payload ?? {} };
  } catch {
    return null;
  }
}

export async function deleteBackup(id: string | number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/backups/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
