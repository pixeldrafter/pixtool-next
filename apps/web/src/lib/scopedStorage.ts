/**
 * Kullanıcıya göre ayrılmış yerel depolama (localStorage).
 *
 * ## Neden?
 *
 * Aynı tarayıcıyı iki kullanıcı kullanırsa, tek anahtar altında tutulan
 * localStorage verisi birbirine karışır (biri diğerinin notunu/ikonlarını
 * görür). Bunu önlemek için anahtarlar `px:<kullanıcı>:` önekiyle yazılır.
 *
 * `setStorageOwner` giriş/çıkışta çağrılır; anahtarların öneki **çağrı
 * anında** hesaplandığı için zustand `persist` yeniden başlatmaya gerek
 * kalmadan doğru kullanıcının alanına yazar. Giriş sonrası `persist.rehydrate()`
 * çağrılarak o kullanıcının önbelleği belleğe alınır.
 */

let owner = "anon";

/** Aktif kullanıcıyı değiştirir (giriş: kullanıcı adı, çıkış: null). */
export function setStorageOwner(name: string | null): void {
  owner = name && name.trim() ? name.trim() : "anon";
}

/** Şu an aktif olan kullanıcı. */
export function getStorageOwner(): string {
  return owner;
}

function prefix(): string {
  return `px:${owner}:`;
}

/**
 * Kapsamlı bir `Storage` benzeri döndürür.
 *
 * `window.localStorage` yoksa (SSR / test) bellek içi boş bir depoya düşer.
 */
export function scopedStorage(): Storage {
  const base: Storage | null =
    typeof window !== "undefined" && window.localStorage ? window.localStorage : null;

  return {
    get length(): number {
      return base?.length ?? 0;
    },
    clear(): void {
      base?.clear();
    },
    key(index: number): string | null {
      return base?.key(index) ?? null;
    },
    getItem(key: string): string | null {
      return base?.getItem(prefix() + key) ?? null;
    },
    setItem(key: string, value: string): void {
      base?.setItem(prefix() + key, value);
    },
    removeItem(key: string): void {
      base?.removeItem(prefix() + key);
    },
  } as Storage;
}
