/**
 * Güncelleme bildirimi.
 *
 * ## İki katman, iki strateji
 *
 * | Katman | Güncelleme |
 * |---|---|
 * | **Arayüz** | Sunucudan yüklenir → sayfa yenilenince güncel olur. Bildirim gerekmez. |
 * | **Kabuk** | Tauri exe + köprü. Nadiren değişir → kullanıcıya bildirim gösterilir. |
 *
 * Bu bileşen `/api/v1/app/version` ucunu okur ve **kabuk sürümü** daha yeniyse
 * şık bir bildirim gösterir. İndirme bağlantısı sunucudan gelir (GitHub
 * gerekmez).
 */

import { useCallback, useEffect, useState } from "react";

import { API_BASE, IS_TAURI } from "../lib/apiBase";
import { toast } from "../notifications";
import "./UpdateBanner.css";

/** Sürüm yanıtı */
interface VersionInfo {
  ok: boolean;
  ui: { version: string; autoUpdate: boolean };
  shell: {
    version: string;
    notes?: string;
    released?: string;
    download: string | null;
    size_bytes: number | null;
    filename: string | null;
    mandatory?: boolean;
  };
}

/** Yerel uygulama sürümü (build sırasında gömülür). */
const LOCAL_SHELL_VERSION = "1.0.0";

/** Sürüm karşılaştırması: `a > b` mi? */
function isNewer(a: string, b: string): boolean {
  const parse = (value: string) =>
    value
      .split(/[.\-+]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Boyutu okunabilir yapar. */
function humanSize(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(LOCAL_SHELL_VERSION);

  /** Kabuk sürümünü Tauri'den sorar (tarayıcıda gömülü değer kalır). */
  useEffect(() => {
    if (!IS_TAURI) return;

    void (async () => {
      try {
        const api = (window as unknown as { __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<string> } } })
          .__TAURI__;
        const version = await api?.core?.invoke?.("shell_version");
        if (typeof version === "string" && version) setCurrentVersion(version);
      } catch {
        /* gömülü sürüm kullanılır */
      }
    })();
  }, []);

  /** Sürüm bilgisini çeker. */
  const check = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/app/version`);
      if (!response.ok) return;
      setInfo((await response.json()) as VersionInfo);
    } catch {
      /* sessiz — ağ yoksa bildirim gösterme */
    }
  }, []);

  useEffect(() => {
    void check();
    // Günde bir kez yeterli; ayrıca pencere 6 saatte bir tazeler
    const timer = window.setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [check]);

  const newer = info ? isNewer(info.shell.version, currentVersion) : false;

  if (!info || !newer || dismissed) return null;

  const downloadUrl = info.shell.download
    ? `${API_BASE}${info.shell.download}`
    : null;

  return (
    <div className="update-banner">
      <span className="update-banner__icon" aria-hidden="true">
        ⬆
      </span>

      <div className="update-banner__body">
        <div className="update-banner__title">
          Yeni sürüm var: <strong>{info.shell.version}</strong>
          <span className="update-banner__current">(kurulu {currentVersion})</span>
        </div>
        {info.shell.notes && <div className="update-banner__notes">{info.shell.notes}</div>}
        {info.shell.filename && (
          <div className="update-banner__meta">
            {info.shell.filename} · {humanSize(info.shell.size_bytes)}
          </div>
        )}
      </div>

      <div className="update-banner__actions">
        <button
          type="button"
          className="update-banner__btn is-primary"
          disabled={!downloadUrl}
          onClick={() => {
            if (!downloadUrl) {
              toast.warn("İndirme bağlantısı yok", "Sunucuda kurulum dosyası bulunamadı.", "Güncelleme");
              return;
            }
            // Tarayıcıda indirir; Tauri'de varsayılan tarayıcı açar
            window.open(downloadUrl, "_blank", "noopener");
            toast.info("İndiriliyor…", info.shell.filename ?? "", "Güncelleme");
          }}
          title={downloadUrl ? "Kurulum paketini indir" : "Sunucuda kurulum yok"}
        >
          ⬇ İndir
        </button>

        <button
          type="button"
          className="update-banner__btn"
          onClick={() => {
            void check();
            toast.info("Kontrol edildi", `Kurulu: ${currentVersion}`, "Güncelleme");
          }}
          title="Yeniden kontrol et"
        >
          ⟳
        </button>

        <button
          type="button"
          className="update-banner__btn is-ghost"
          onClick={() => setDismissed(true)}
          title="Bu oturumda gizle"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
