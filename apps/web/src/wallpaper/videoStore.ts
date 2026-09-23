/**
 * Canlı duvar kağıdı deposu — IndexedDB.
 *
 * ## Neden IndexedDB?
 *
 * Tarayıcıda yerel bir video dosyasını kalıcı tutmanın tek sağlam yolu
 * IndexedDB'dir:
 *   • `blob:` URL → sayfa yenilenince kaybolur
 *   • `localStorage` → ~5 MB sınırı (4K video 100+ MB olabilir)
 *   • `File System Access API` → her açılışta izin ister
 *   • **IndexedDB** → Blob doğrudan saklanır, sınır kotaya bağlı (yüzlerce MB)
 *
 * Video Blob'u `videos` deposuna `"wallpaper"` anahtarıyla yazılır.
 * Bileşen yüklerken Blob'u okuyup `URL.createObjectURL` ile oynatır.
 */

const DB_NAME = "pixtool-media";
const DB_VERSION = 1;
const STORE = "videos";
const KEY = "wallpaper";

/** IndexedDB kullanılabilir mi? */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB açılamadı"));
  });
}

/** Bir işlemi Promise'e çevirir. */
function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB hatası"));
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Video dosyasını kaydeder (üzerine yazar). */
export async function saveVideo(file: File | Blob): Promise<void> {
  await run("readwrite", (store) => store.put(file, KEY));
}

/** Kayıtlı videoyu döndürür (yoksa `null`). */
export async function loadVideo(): Promise<Blob | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const value = await run<unknown>("readonly", (store) => store.get(KEY));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

/** Kayıtlı videoyu siler. */
export async function clearVideo(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch {
    /* yok sayılır */
  }
}

/** Kayıtlı video var mı ve boyutu ne? */
export async function videoInfo(): Promise<{ size: number; type: string } | null> {
  const blob = await loadVideo();
  if (!blob) return null;
  return { size: blob.size, type: blob.type };
}

/** Kayıtlı videoyu `blob:` URL olarak döndürür (yoksa `null`). */
export async function loadVideoUrl(): Promise<string | null> {
  const blob = await loadVideo();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** Bayt sayısını okunabilir hâle getirir. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
