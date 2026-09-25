/**
 * Paylaşım deposu — bana yapılan paylaşımlar (oturum boyunca).
 *
 * Kalıcı değildir; her girişte sunucudan yeniden çekilir.
 */

import { create } from "zustand";

import { deleteShare, fetchShares, type ShareRecord } from "../lib/shareApi";

interface SharesState {
  shares: ShareRecord[];
  loaded: boolean;

  load: (token: string) => Promise<void>;
  remove: (token: string, shareId: string) => Promise<void>;
  reset: () => void;
}

export const useSharesStore = create<SharesState>((set) => ({
  shares: [],
  loaded: false,

  load: async (token: string) => {
    const shares = await fetchShares(token);
    set({ shares, loaded: true });
  },

  remove: async (token: string, shareId: string) => {
    const ok = await deleteShare(token, shareId);
    if (ok) set((state) => ({ shares: state.shares.filter((item) => item.id !== shareId) }));
  },

  reset: () => set({ shares: [], loaded: false }),
}));
