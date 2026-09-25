/**
 * Veritabanı (NocoDB) API istemcisi.
 *
 * Salt okunur: tabloları listeler ve kayıtları getirir. Kayıt ekleme/silme
 * NocoDB panelinden yapılır.
 */

import { API_BASE } from "./apiBase";

/** Tek bir NocoDB tablosu. */
export interface DatabaseTable {
  id: string;
  title: string;
  table_name: string;
}

/** Tablo kayıtları yanıtı. */
export interface TableRecords {
  ok: boolean;
  table_id: string;
  count: number;
  columns: string[];
  records: Record<string, unknown>[];
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
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

/** Base içindeki tabloları listeler. */
export async function fetchDatabaseTables(signal?: AbortSignal): Promise<DatabaseTable[]> {
  const data = await getJson<{ ok: boolean; tables: DatabaseTable[] }>(
    "/api/v1/database/tables",
    signal,
  );
  return data.tables ?? [];
}

/** Bir tablonun kayıtlarını getirir. */
export async function fetchTableRecords(
  tableId: string,
  options: { limit?: number; where?: string; signal?: AbortSignal } = {},
): Promise<TableRecords> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.where) params.set("where", options.where);

  return getJson<TableRecords>(
    `/api/v1/database/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`,
    options.signal,
  );
}

/** Hücre değerini okunabilir metne çevirir. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "evet" : "hayır";
  if (typeof value === "object") {
    try {
      const text = JSON.stringify(value);
      return text.length > 80 ? `${text.slice(0, 77)}…` : text;
    } catch {
      return "[nesne]";
    }
  }
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
