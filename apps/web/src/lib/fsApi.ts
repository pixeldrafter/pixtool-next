/**
 * Yerel dosya sistemi istemcisi — köprü (`/fs/*`).
 *
 * Tüm işlemler `http://127.0.0.1:<port>` üzerindeki yerel köprüye gider.
 * Köprü yoksa pencere kullanıcıyı bilgilendirir.
 */

const DEFAULT_BRIDGE = "http://127.0.0.1:8765";

/** Liste öğesi (köprüden gelir). */
export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  size: string;
  modified: string;
  modified_ts: number;
  extension: string;
  readonly: boolean;
}

/** Dizin listesi yanıtı. */
export interface FsListing {
  ok: boolean;
  path: string;
  parent: string | null;
  name: string;
  count: number;
  entries: FsEntry[];
  writable: boolean;
}

/** Metin okuma yanıtı. */
export interface FsFile {
  ok: boolean;
  path: string;
  name: string;
  size_bytes: number;
  size: string;
  encoding: string;
  content: string;
  readonly: boolean;
}

/** Hızlı erişim konumu. */
export interface FsLocation {
  label: string;
  path: string;
}

/** Köprü ayarları. */
export interface FsOptions {
  baseUrl?: string;
  token?: string;
  signal?: AbortSignal;
}

function normalize(options: FsOptions): { base: string; token: string } {
  return {
    base: (options.baseUrl || DEFAULT_BRIDGE).replace(/\/+$/, ""),
    token: options.token ?? "",
  };
}

async function call<T>(
  path: string,
  init: RequestInit,
  options: FsOptions,
): Promise<T> {
  const { base, token } = normalize(options);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["X-Pixtool-Token"] = token;
  if (init.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: options.signal,
    });
  } catch (caught) {
    throw new Error(
      `Yerel köprüye ulaşılamadı (${base}). Köprü çalışıyor mu? — ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object"
        ? String(
            (parsed as { error?: unknown; detail?: unknown }).error ??
              (parsed as { detail?: unknown }).detail ??
              `HTTP ${response.status}`,
          )
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

/** Köprü ayakta mı? */
export async function probeBridge(options: FsOptions = {}): Promise<{
  ok: boolean;
  platform?: string;
  version?: string;
  message: string;
}> {
  const { base } = normalize(options);
  try {
    const response = await fetch(`${base}/health`, { signal: options.signal });
    if (!response.ok) return { ok: false, message: `Köprü HTTP ${response.status}` };
    const data = (await response.json()) as { platform?: string; version?: string };
    return { ok: true, platform: data.platform, version: data.version, message: "Köprü bağlı" };
  } catch (caught) {
    return {
      ok: false,
      message: `Köprü yok — ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }
}

/** Kısayol konumları (ev, masaüstü, sürücüler…). */
export async function listLocations(options: FsOptions = {}): Promise<FsLocation[]> {
  const data = await call<{ locations: FsLocation[] }>("/fs/locations", { method: "GET" }, options);
  return data.locations ?? [];
}

/** Dizin içeriği. */
export async function listDirectory(path: string, options: FsOptions = {}): Promise<FsListing> {
  return call<FsListing>(`/fs/list?path=${encodeURIComponent(path)}`, { method: "GET" }, options);
}

/** Metin dosyası oku. */
export async function readTextFile(path: string, options: FsOptions = {}): Promise<FsFile> {
  return call<FsFile>(`/fs/read?path=${encodeURIComponent(path)}`, { method: "GET" }, options);
}

/** Metin dosyası kaydet. */
export async function writeTextFile(
  path: string,
  content: string,
  options: FsOptions = {},
): Promise<{ path: string; message: string }> {
  return call<{ path: string; message: string }>(
    "/fs/write",
    { method: "POST", body: JSON.stringify({ path, content }) },
    options,
  );
}

/** Yeni klasör. */
export async function makeDirectory(
  parent: string,
  name: string,
  options: FsOptions = {},
): Promise<{ path: string; message: string }> {
  return call<{ path: string; message: string }>(
    "/fs/mkdir",
    { method: "POST", body: JSON.stringify({ path: parent, name }) },
    options,
  );
}

/** Yeniden adlandır. */
export async function renameEntry(
  path: string,
  name: string,
  options: FsOptions = {},
): Promise<{ path: string; message: string }> {
  return call<{ path: string; message: string }>(
    "/fs/rename",
    { method: "POST", body: JSON.stringify({ path, name }) },
    options,
  );
}

/** Taşı (sürükle-bırak). */
export async function moveEntries(
  sources: string[],
  destination: string,
  options: FsOptions = {},
): Promise<{ ok: boolean; message: string; errors: string[] }> {
  return call<{ ok: boolean; message: string; errors: string[] }>(
    "/fs/move",
    { method: "POST", body: JSON.stringify({ sources, destination }) },
    options,
  );
}

/** Geri dönüşüm kutusuna taşı. */
export async function trashEntries(
  paths: string[],
  options: FsOptions = {},
): Promise<{ ok: boolean; message: string; errors: string[] }> {
  return call<{ ok: boolean; message: string; errors: string[] }>(
    "/fs/trash",
    { method: "POST", body: JSON.stringify({ paths }) },
    options,
  );
}

/** Kalıcı sil (onay zorunlu). */
export async function deleteEntries(
  paths: string[],
  options: FsOptions = {},
): Promise<{ ok: boolean; message: string; errors: string[] }> {
  return call<{ ok: boolean; message: string; errors: string[] }>(
    "/fs/delete",
    { method: "POST", body: JSON.stringify({ paths, confirm: true }) },
    options,
  );
}

/** Yükle (tarayıcıdan sürüklenen dosyalar). */
export async function uploadFile(
  directory: string,
  file: File,
  options: FsOptions = {},
): Promise<{ path: string; message: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Büyük dizilerde `String.fromCharCode(...)` yığını taşırır — parça parça çevir.
  let binary = "";
  const CHUNK = 8192;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }

  return call<{ path: string; message: string }>(
    "/fs/upload",
    {
      method: "POST",
      body: JSON.stringify({ path: directory, name: file.name, data: btoa(binary) }),
    },
    options,
  );
}

/** İndirme adresi (tarayıcı doğrudan indirir). */
export function downloadUrl(path: string, options: FsOptions = {}): string {
  const { base } = normalize(options);
  return `${base}/fs/download?path=${encodeURIComponent(path)}`;
}

/** Dosya uzantısına göre simge. */
export function fileIcon(entry: FsEntry): string {
  if (entry.is_dir) return "📁";

  const ext = entry.extension;
  if (["txt", "md", "log", "ini", "cfg", "conf"].includes(ext)) return "📝";
  if (["json", "yml", "yaml", "xml", "csv"].includes(ext)) return "🧾";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"].includes(ext)) return "🖼";
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) return "🎬";
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext)) return "🎵";
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return "🗜";
  if (["exe", "msi", "bat", "cmd", "ps1", "sh"].includes(ext)) return "⚙";
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "📘";
  if (["xls", "xlsx", "ods"].includes(ext)) return "📗";
  if (["ppt", "pptx", "odp"].includes(ext)) return "📙";
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "cs", "rb", "php", "sql"].includes(ext))
    return "⌨";
  return "📄";
}

/** Düzenlenebilir metin dosyası mı? */
export function isTextFile(entry: FsEntry): boolean {
  return [
    "txt", "md", "log", "ini", "cfg", "conf", "json", "yml", "yaml", "xml", "csv",
    "ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "cs", "rb",
    "php", "sql", "sh", "bat", "cmd", "ps1", "html", "css", "env", "toml",
  ].includes(entry.extension);
}
