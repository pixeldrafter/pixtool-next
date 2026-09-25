/**
 * Erişim/yetki deposu.
 *
 * Giriş yapıldığında `/api/v1/admin/me` çağrılır ve kullanıcının rolü ile
 * erişebileceği uygulamalar alınır. Arayüz buna göre süzer: yönetici olmayan
 * kullanıcı veritabanı, kullanıcılar, uzak sunucu gibi hassas bölümleri görmez.
 *
 * Yükleme tamamlanana kadar her şeye izin verilir (ilk açılışta titrememek için);
 * yükleme sonrası kısıtlar uygulanır.
 */

import { create } from "zustand";

import { API_BASE, setAuthToken } from "./apiBase";

interface MeResponse {
  ok: boolean;
  username?: string;
  role?: string;
  apps?: string[];
  all?: boolean;
}

interface AccessState {
  loaded: boolean;
  username: string;
  role: string;
  apps: string[];
  isAdmin: boolean;
  /** Oturum tokenı (paylaşım gibi istemci çağrıları için) */
  token: string;

  load: (token: string) => Promise<void>;
  can: (app: string) => boolean;
  reset: () => void;
}

export const useAccessStore = create<AccessState>((set, get) => ({
  loaded: false,
  username: "",
  role: "user",
  apps: [],
  isAdmin: false,
  token: "",

  load: async (token: string) => {
    setAuthToken(token);
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        set({ loaded: true, token });
        return;
      }
      const data = (await response.json()) as MeResponse;
      set({
        loaded: true,
        token,
        username: data.username ?? "",
        role: data.role ?? "user",
        apps: data.apps ?? [],
        isAdmin: Boolean(data.all) || data.role === "admin",
      });
    } catch {
      set({ loaded: true, token });
    }
  },

  can: (app: string) => {
    const state = get();
    if (!state.loaded) return true; // henüz bilinmiyor → engelleme
    if (state.isAdmin) return true;
    return state.apps.includes(app);
  },

  reset: () => {
    setAuthToken("");
    set({ loaded: false, username: "", role: "user", apps: [], isAdmin: false, token: "" });
  },
}));
