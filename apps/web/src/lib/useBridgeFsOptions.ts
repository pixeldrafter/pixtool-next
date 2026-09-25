/**
 * Köprü seçenekleri (adres + token) — tek kaynak.
 *
 * Neden gerekli? Masaüstü kabuğu köprüyü **kendisi** başlatır ve token'ı kendi
 * üretir. Bu token ayarlarda (`settings.bridge.token`) yazılı olmayabilir. Bu
 * kanca önce kabuktan okumayı dener (`resolveBridgeOptions`), yoksa ayarlara
 * düşer. Böylece dosya yöneticisi gibi köprüyü doğrudan kullanan bileşenler
 * "Yetkisiz — X-Pixtool-Token gerekli" hatası almaz.
 */

import { useEffect, useState } from "react";

import { resolveBridgeOptions } from "../console/bridge";
import { useSettings } from "../settings";

export interface BridgeFsOptions {
  baseUrl: string;
  token?: string;
}

export function useBridgeFsOptions(): BridgeFsOptions {
  const { settings } = useSettings();
  const [resolved, setResolved] = useState<{ url?: string; token?: string }>({});

  useEffect(() => {
    let cancelled = false;
    void resolveBridgeOptions({
      url: settings.bridge.url,
      token: settings.bridge.token || undefined,
    }).then((options) => {
      if (!cancelled) setResolved({ url: options.url, token: options.token ?? undefined });
    });
    return () => {
      cancelled = true;
    };
  }, [settings.bridge.url, settings.bridge.token]);

  return {
    baseUrl: resolved.url ?? settings.bridge.url,
    token: resolved.token ?? (settings.bridge.token || undefined),
  };
}
