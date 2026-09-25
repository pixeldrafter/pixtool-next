/**
 * Kullanıcıya özel kalıcılık — yerel önbellek + sunucu senkronu.
 *
 * ## İki katman
 *
 * 1. **Yerel önbellek (localStorage):** `px:<kullanıcı>:` önekli, anında açılış.
 * 2. **Sunucu (NocoDB `Settings`):** giriş yapılınca yüklenir, değişince
 *    (kısa gecikmeyle) kaydedilir. Böylece notlar ve masaüstü öğeleri/dosyaları
 *    tarayıcı ↔ masaüstü kabuğu ↔ farklı cihaz arasında taşınır ve her kullanıcı
 *    yalnızca kendi verisini görür.
 *
 * ## Akış (girişte)
 *
 * ```
 * setStorageOwner(kullanıcı)          → yerel önbellek o kullanıcıya çevrilir
 * persist.rehydrate()                 → önbellek belleğe alınır (anında görünüm)
 * GET /api/v1/sync/stickies|desktop   → sunucudaki kayıt okunur
 *   ├─ varsa  → store'a uygulanır (sunucu kazanır)
 *   └─ yoksa  → yerel veri sunucuya itilir (ilk geçiş)
 * subscribe → değişiklikte 1.2 sn gecikmeyle PUT
 * ```
 */

import { useEffect } from "react";

import { useItemsStore } from "../desktop/itemsStore";
import { useAccessStore } from "./accessStore";
import { useSharesStore } from "../shares/sharesStore";
import { useStickyStore } from "../sticky/notesStore";
import { useWidgetsStore } from "../widgets/widgetsStore";
import { API_BASE } from "./apiBase";
import { setStorageOwner } from "./scopedStorage";
/** Giriş oturumu (App'teki `LoginSession` ile uyumlu). */
export interface SyncSession {
  token: string;
  username: string;
}

/** Değişiklikleri sunucuya gönderme gecikmesi (ms). */
const DEBOUNCE_MS = 1200;

/** Sunucudan bir anahtarın değerini okur (yoksa/hatadaysa null). */
async function loadSync(key: string, token: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/sync/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { ok?: boolean; value?: unknown };
    return data.value ?? null;
  } catch {
    return null;
  }
}

/** Bir anahtarı sunucuya yazar. */
async function saveSync(key: string, value: unknown, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/sync/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Giriş oturumu boyunca kalıcılığı yönetir. */
export function useUserSync(session: SyncSession | null): void {
  useEffect(() => {
    const token = session?.token;
    const username = session?.username;

    // Girişte yerel önbelleği doğru kullanıcıya çevir
    setStorageOwner(username ?? null);

    // Rol/izinler ve paylaşımlar (kalıcı değil, her girişte tazelenir)
    if (token) {
      void useAccessStore.getState().load(token);
      void useSharesStore.getState().load(token);
    } else {
      useAccessStore.getState().reset();
      useSharesStore.getState().reset();
    }

    // Tek seferlik geçiş: eski (öneksiz) global kayıtları bu kullanıcının
    // alanına taşı — böylece eski notlar/ikonlar kaybolmaz.
    if (username) {
      for (const key of ["pixtool.stickies", "pixtool.desktop.items", "pixtool.widgets"]) {
        try {
          const scoped = `px:${username}:${key}`;
          const legacy = window.localStorage.getItem(key);
          if (legacy !== null && window.localStorage.getItem(scoped) === null) {
            window.localStorage.setItem(scoped, legacy);
          }
        } catch {
          /* localStorage kapalı olabilir */
        }
      }
    }

    if (!token || !username) return;

    let cancelled = false;
    /** Sunucudan yükleme bitmeden yerel değişiklikleri göndermeyi engeller. */
    let ready = false;
    const timers = new Map<string, number>();

    const schedule = (key: string, value: () => unknown) => {
      if (!ready) return;
      const existing = timers.get(key);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          void saveSync(key, value(), token);
        }, DEBOUNCE_MS),
      );
    };

    // --- Abonelikler: değişiklikte sunucuya gönder ---
    const unsubSticky = useStickyStore.subscribe(() => {
      const state = useStickyStore.getState();
      schedule("stickies", () => ({ notes: state.notes, topZ: state.topZ }));
    });

    const unsubItems = useItemsStore.subscribe(() => {
      const state = useItemsStore.getState();
      schedule("desktop", () => ({
        items: state.items,
        gridSnap: state.gridSnap,
        seeded: state.seeded,
      }));
    });

    const unsubWidgets = useWidgetsStore.subscribe(() => {
      const state = useWidgetsStore.getState();
      schedule("widgets", () => ({ widgets: state.widgets, width: state.width }));
    });

    // --- Girişte: yerel önbelleği geri yükle, sonra sunucuyla eşitle ---
    void (async () => {
      await useStickyStore.persist.rehydrate();
      await useItemsStore.persist.rehydrate();
      await useWidgetsStore.persist.rehydrate();
      if (cancelled) return;

      const [stickies, desktop, widgets] = await Promise.all([
        loadSync("stickies", token),
        loadSync("desktop", token),
        loadSync("widgets", token),
      ]);
      if (cancelled) return;

      if (stickies && typeof stickies === "object") {
        const value = stickies as { notes?: unknown; topZ?: unknown };
        if (Array.isArray(value.notes)) {
          useStickyStore.setState({
            notes: value.notes as never,
            topZ: typeof value.topZ === "number" ? value.topZ : 1,
          });
        }
      }

      if (desktop && typeof desktop === "object") {
        const value = desktop as { items?: unknown; gridSnap?: unknown; seeded?: unknown };
        if (Array.isArray(value.items)) {
          useItemsStore.setState({
            items: value.items as never,
            gridSnap: typeof value.gridSnap === "boolean" ? value.gridSnap : true,
            // Sunucudan gelen liste varsa varsayılanlar yeniden eklenmesin
            seeded: true,
          });
        }
      }

      if (widgets && typeof widgets === "object") {
        const value = widgets as { widgets?: unknown; width?: unknown };
        if (Array.isArray(value.widgets)) {
          useWidgetsStore.setState({ widgets: value.widgets as never });
        }
      }

      ready = true;

      // İlk geçiş: sunucuda kayıt yokken yerel veriyi yukarı taşı
      if (stickies === null) {
        const state = useStickyStore.getState();
        if (state.notes.length > 0) {
          void saveSync("stickies", { notes: state.notes, topZ: state.topZ }, token);
        }
      }
      if (desktop === null) {
        const state = useItemsStore.getState();
        if (state.items.length > 0) {
          void saveSync(
            "desktop",
            { items: state.items, gridSnap: state.gridSnap, seeded: state.seeded },
            token,
          );
        }
      }
      if (widgets === null) {
        const state = useWidgetsStore.getState();
        if (state.widgets.length > 0) {
          void saveSync("widgets", { widgets: state.widgets, width: state.width }, token);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubSticky();
      unsubItems();
      unsubWidgets();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [session?.token, session?.username]);
}
