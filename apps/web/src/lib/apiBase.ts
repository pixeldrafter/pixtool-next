/**
 * API taban adresi — **tek kaynak**.
 *
 * ⚠️ Neden ayrı modül?
 *
 * Daha önce `lib/api.ts`, `login/api.ts` ve `console/api.ts` **kendi**
 * `API_BASE` sabitini tanımlıyordu. Yalnızca birinde Tauri algılaması vardı;
 * diğerleri `""` (göreli) kullanıyordu. Masaüstü kabuğunda bu, isteklerin
 * `http://tauri.localhost/api/...` adresine gitmesine yol açıyor ve
 * **giriş ekranı "Sunucuya ulaşılamadı" hatası veriyordu** — yanlış parolada
 * bile (istek sunucuya hiç ulaşmıyordu).
 *
 * Artık tüm API istemcileri bu modülü kullanır.
 *
 * ## Kural
 *
 * | Ortam | Köken | API tabanı |
 * |---|---|---|
 * | Tarayıcı (canlı site) | `https://pixtool...` | `""` — aynı köken, nginx `/api/` yönlendirir |
 * | Tarayıcı (Vite dev) | `http://localhost:5173` | `""` — Vite proxy `/api/` yönlendirir |
 * | **Tauri kabuğu** | `tauri://localhost` · `http://tauri.localhost` | `https://pixtool.omercataloglu.com` |
 *
 * `VITE_API_BASE` tanımlıysa her şeyi geçersiz kılar (açık yapılandırma).
 */

/** Masaüstü kabuğunun varsayılan API adresi. */
export const REMOTE_API_BASE = "https://pixtool.omercataloglu.com";

/** Tauri çalışma zamanı işaretçileri. */
function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;

  const { protocol, hostname } = window.location;
  if (
    protocol === "tauri:" ||
    hostname === "tauri.localhost" ||
    hostname.endsWith(".tauri.localhost")
  ) {
    return true;
  }

  // Tauri 2 IPC köprüsü (withGlobalTauri kapalı olsa da bulunur)
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window
  );
}

/** Masaüstü kabuğunda mı çalışıyoruz? */
export const IS_TAURI: boolean = isTauriRuntime();

/** API taban adresini belirler. */
function detectApiBase(): string {
  const configured = import.meta.env["VITE_API_BASE"];
  if (configured) return String(configured).replace(/\/+$/, "");

  // Tauri: sayfa kendi sanal kökeninden gelir; `/api/` orada yoktur
  if (IS_TAURI) return REMOTE_API_BASE;

  // Tarayıcı: aynı köken (nginx veya Vite proxy)
  return "";
}

/** Tüm API istemcilerinin kullandığı taban adres. */
export const API_BASE: string = detectApiBase();

/** API tabanını tam adrese çevirir (göreliyse `location.origin` ekler). */
export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// ----------------------------------------------------------------------
//  Oturum tokenı — korumalı uçlar için ortak başlık
// ----------------------------------------------------------------------
let authToken = "";

/** Oturum tokenını ayarlar (giriş/çıkışta `accessStore` çağırır). */
export function setAuthToken(token: string): void {
  authToken = token ?? "";
}

/** Korumalı istekler için `Authorization` başlığı (token yoksa boş). */
export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
