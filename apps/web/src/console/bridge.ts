/**
 * Yerel köprü istemcisi (Faz 3).
 *
 * Tarayıcı, `http://127.0.0.1:8765` üzerinde çalışan köprüden **gerçek makine
 * bilgisini** alır: kurulu programlar, servisler, işlemler, disk bölümleri,
 * gerçek IP/MAC, güvenlik durumu…
 *
 * ## Neden tarayıcıdan çalışır?
 *
 * | Kısıt | Durum |
 * |---|---|
 * | Mixed content (HTTPS → HTTP) | `127.0.0.1` **güvenilir kaynak** sayılır → engel yok |
 * | Private Network Access | Köprü `Access-Control-Allow-Private-Network: true` gönderir |
 * | CORS | Köprü `OPTIONS` ön kontrolünü yanıtlar |
 *
 * Köprü çalışmıyorsa `null` döner ve konsol "köprü bekleniyor" satırlarını
 * gösterir — **sahte veri üretilmez**.
 */

/** Köprü varsayılan adresi. */
export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8765";

/** Köprüden gelen bölüm adları. */
export const BRIDGE_PARTS = [
  "system",
  "cpu",
  "memory",
  "memory_modules",
  "disks",
  "network",
  "gpu",
  "board",
  "bios_check",
  "thermal",
  "ports",
  "processes",
  "services",
  "users",
  "programs",
  "security",
  "environment",
] as const;

export type BridgePart = (typeof BRIDGE_PARTS)[number];

/** Köprü `/health` yanıtı. */
export interface BridgeHealth {
  ok: boolean;
  service: string;
  version: string;
  psutil: boolean;
  platform: string;
  device_id: string;
  uptime_seconds: number;
  token_required: boolean;
}

/** Köprü `/info` yanıtı. */
export interface BridgeInfo {
  ok: boolean;
  bridge_version: string;
  collected_at: string;
  duration_ms: number;
  psutil: boolean;
  device_id: string;
  report: Record<string, unknown>;
}

export interface BridgeOptions {
  /** Köprü adresi (varsayılan `http://127.0.0.1:8765`) */
  url?: string;
  /** Erişim tokenı (köprü başlarken yazdırır) */
  token?: string;
  /** Zaman aşımı (ms) */
  timeoutMs?: number;
  /** Yalnızca bu bölümleri al */
  parts?: BridgePart[];
}

// ----------------------------------------------------------------------
//  Yardımcılar
// ----------------------------------------------------------------------
function normaliseUrl(url: string | undefined): string {
  const value = (url || DEFAULT_BRIDGE_URL).trim().replace(/\/+$/, "");
  if (!value) return DEFAULT_BRIDGE_URL;
  return /^https?:\/\//.test(value) ? value : `http://${value}`;
}

// ----------------------------------------------------------------------
//  Tauri kabuğu entegrasyonu
// ----------------------------------------------------------------------
/** Tauri global API'si ( `withGlobalTauri: true` ). */
interface TauriGlobal {
  core?: { invoke?: <T>(cmd: string, args?: unknown) => Promise<T> };
  invoke?: <T>(cmd: string, args?: unknown) => Promise<T>;
}

/** Masaüstü kabuğunda mıyız? */
export function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Tauri'den köprü durumunu okur (kabuk köprüyü kendi başlatır). */
export async function bridgeFromTauri(): Promise<{
  running: boolean;
  url: string;
  token: string | null;
} | null> {
  if (!isTauriShell()) return null;
  try {
    const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
    const invoke = tauri?.core?.invoke ?? tauri?.invoke;
    if (!invoke) return null;

    let status = await invoke<{ running: boolean; url: string; token: string | null }>(
      "bridge_status",
    );

    // Köprü kapalıysa kabuktan başlatmasını iste (idempotent) ve tekrar sor.
    // Böylece açılışta zamanlama yarışı olsa bile arayüz kendini onarır.
    if (!status?.running) {
      try {
        status = await invoke<{ running: boolean; url: string; token: string | null }>(
          "bridge_start",
        );
      } catch {
        /* başlatılamadı — aşağıdaki status döner */
      }
    }

    return status ?? null;
  } catch {
    return null;
  }
}

/**
 * Köprü bağlantı bilgisini çözer.
 *
 * Öncelik:
 *   1. Tauri kabuğu (kabuk köprüyü başlatır, port+token oradan gelir)
 *   2. Ayarlardaki elle girilen adres + token
 */
export async function resolveBridgeOptions(
  fallback: BridgeOptions = {},
): Promise<BridgeOptions> {
  const fromShell = await bridgeFromTauri();
  if (fromShell?.running && fromShell.token) {
    return {
      url: fromShell.url,
      token: fromShell.token,
      timeoutMs: fallback.timeoutMs,
      parts: fallback.parts,
    };
  }
  return fallback;
}

/** Zaman aşımlı fetch (AbortController). */
async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 6000, ...rest } = init;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------
//  Genel API
// ----------------------------------------------------------------------
/**
 * Köprü çalışıyor mu?
 *
 * Token gerektirmez — `/health` açıktır.
 */
export async function probeBridge(
  options: BridgeOptions = {},
): Promise<BridgeHealth | null> {
  const base = normaliseUrl(options.url);
  try {
    const response = await fetchWithTimeout(`${base}/health`, {
      method: "GET",
      // Ozel baslik -> istek "basit" olmaktan cikar, tarayici PNA on kontrolu
      // yapar. Aksi halde Chrome genel HTTPS sayfadan 127.0.0.1'e erisimi keser.
      headers: { "X-Pixtool-Client": "web" },
      timeoutMs: options.timeoutMs ?? 4000,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as BridgeHealth;
    return data && data.ok ? data : null;
  } catch {
    // Köprü kapalı, CORS reddi veya zaman aşımı — sessizce yok say
    return null;
  }
}

/**
 * Köprüden tüm makine bilgisini alır.
 *
 * Returns:
 *     Köprü verisi veya `null` (çalışmıyor / yetkisiz / hata).
 */
export async function fetchBridgeInfo(
  options: BridgeOptions = {},
): Promise<BridgeInfo | null> {
  const base = normaliseUrl(options.url);
  const headers: Record<string, string> = { Accept: "application/json", "X-Pixtool-Client": "web" };
  if (options.token) headers["X-Pixtool-Token"] = options.token;

  const query = options.parts?.length ? `?parts=${options.parts.join(",")}` : "";

  try {
    const response = await fetchWithTimeout(`${base}/info${query}`, {
      method: "GET",
      headers,
      // Kapsamlı toplama birkaç saniye sürebilir
      timeoutMs: options.timeoutMs ?? 30000,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as BridgeInfo;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

/** Köprüde script çalıştırır. */
export async function runOnBridge(
  script: string,
  options: BridgeOptions & { executor?: BridgePart | string } = {},
): Promise<{ ok: boolean; stdout?: string; stderr?: string; exit_code?: number | null; error?: string } | null> {
  const base = normaliseUrl(options.url);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Pixtool-Client": "web" };
  if (options.token) headers["X-Pixtool-Token"] = options.token;

  try {
    const response = await fetchWithTimeout(`${base}/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        script,
        executor: options.executor ?? (navigator.userAgent.includes("Windows") ? "powershell" : "bash"),
      }),
      timeoutMs: options.timeoutMs ?? 300000,
    });
    if (!response.ok) return null;
    return (await response.json()) as { ok: boolean; stdout?: string; stderr?: string };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------
//  Okuma yardımcıları (tip güvenli erişim)
// ----------------------------------------------------------------------
/** Bilinmeyen değeri nesne gibi okur. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Bilinmeyen değeri dizi gibi okur. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Metin olarak okur (yoksa boş). */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Sayı olarak okur (yoksa null). */
export function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Köprü raporundan Türkçe değerleri güvenle çeker. */
export function readBridge(report: Record<string, unknown>, part: string): Record<string, unknown> {
  return asRecord(report[part]);
}
