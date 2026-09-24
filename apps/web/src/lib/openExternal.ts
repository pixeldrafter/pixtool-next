/**
 * Harici bağlantı açma.
 *
 * Bir bağlantıya tıklandığında **çalıştırılan makinede** varsayılan tarayıcı
 * açılmalı — uygulamanın kendi penceresinde değil.
 *
 * ## Yollar (sırayla denenir)
 *
 * 1. **Yerel köprü** `POST /open` → işletim sisteminin varsayılan tarayıcısı
 *    (Tauri'de de köprü çalışır; gerçekten OS tarayıcısını açar)
 * 2. **Tauri opener** eklentisi
 * 3. **Tarayıcı** `window.open` (yeni sekme)
 */

import { DEFAULT_BRIDGE_URL } from "../console/bridge";

/** Köprü adresi (ayarlardan geçersiz kılınabilir). */
let bridgeBase = DEFAULT_BRIDGE_URL;
/** Köprü tokenı (Tauri tarafından sağlanır). */
let bridgeToken = "";

/** Köprü bağlantı bilgilerini günceller. */
export function configureBridge(url?: string, token?: string): void {
  if (url) bridgeBase = url.replace(/\/+$/, "");
  if (token !== undefined) bridgeToken = token;
}

/** Tauri global API'si. */
interface TauriGlobal {
  core?: { invoke?: <T>(cmd: string, args?: unknown) => Promise<T> };
  invoke?: <T>(cmd: string, args?: unknown) => Promise<T>;
  opener?: { openUrl?: (url: string) => Promise<void> };
}

function getTauri(): TauriGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
}

/** Tauri köprü durumundan port+token alır (varsa). */
async function ensureBridgeFromShell(): Promise<void> {
  if (bridgeToken) return;
  const tauri = getTauri();
  const invoke = tauri?.core?.invoke ?? tauri?.invoke;
  if (!invoke) return;
  try {
    const status = await invoke<{ running: boolean; url: string; token: string | null }>(
      "bridge_status",
    );
    if (status?.running && status.token) {
      bridgeBase = status.url.replace(/\/+$/, "");
      bridgeToken = status.token;
    }
  } catch {
    /* köprü yok */
  }
}

/**
 * Bağlantıyı çalıştırılan makinede açar.
 *
 * @param url Açılacak adres
 * @returns Açılabildi mi
 */
export async function openExternal(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = /^https?:\/\//.test(url) ? url : `https://${url}`;

  // 1) Yerel köprü
  await ensureBridgeFromShell();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (bridgeToken) headers["X-Pixtool-Token"] = bridgeToken;

    const response = await fetch(`${bridgeBase}/open`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: safe }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = (await response.json()) as { ok?: boolean };
      if (data?.ok) return true;
    }
  } catch {
    /* köprü yok — sonraki yollar */
  }

  // 2) Tauri opener
  const tauri = getTauri();
  if (tauri?.opener?.openUrl) {
    try {
      await tauri.opener.openUrl(safe);
      return true;
    } catch {
      /* devam */
    }
  }

  // 3) Tarayıcı: yeni sekme
  try {
    return Boolean(window.open(safe, "_blank", "noopener,noreferrer"));
  } catch {
    return false;
  }
}
