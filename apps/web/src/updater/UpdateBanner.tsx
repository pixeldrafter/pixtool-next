/**
 * Otomatik güncelleme.
 *
 * ## İki katman, iki strateji
 *
 * | Katman | Nasıl güncellenir |
 * |---|---|
 * | **Arayüz** | Sunucudan yüklenir → uygulama açılışta en güncelini alır. Bildirim gerekmez. |
 * | **Kabuk** | Tauri güncelleyicisi imzalı paketi **indirir, kurar, yeniden başlatır**. |
 *
 * Kullanıcı hiçbir şey yapmaz: uygulama açılır, güncelleme varsa indirir,
 * kurar ve kendini yeniden başlatır.
 *
 * ## Akış
 *
 * ```
 * uygulama açılır
 *    ↓
 * /api/v1/app/latest.json okunur   (imzalı, Tauri biçimi)
 *    ↓
 * sürüm daha yeni mi?  ──hayır──→  hiçbir şey yapma
 *    ↓ evet
 * indirme başlar → ilerleme çubuğu
 *    ↓
 * imza doğrulanır → kurulum (sessiz) → yeniden başlatma
 * ```
 *
 * ## Geri dönüş
 *
 * Tauri güncelleyicisi yoksa (eski kabuk veya tarayıcı) bildirim gösterilir ve
 * **elle indirme** bağlantısı sunulur. Böylece 1.0.0 gibi güncelleyicisiz bir
 * sürümden de 1.1.0'a geçilebilir; sonrası tamamen otomatik olur.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE, IS_TAURI } from "../lib/apiBase";
import { toast } from "../notifications";
import "./UpdateBanner.css";

/** Sunucudan gelen sürüm bilgisi */
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

/** Tauri güncelleyici nesnesi (plugin-updater) */
interface UpdaterHandle {
  version: string;
  currentVersion: string;
  body?: string;
  downloadAndInstall: (
    onEvent?: (event: {
      event: string;
      data?: { contentLength?: number; chunkLength?: number };
    }) => void,
  ) => Promise<void>;
}

/** Tauri çalışma zamanı köprüsü */
type TauriGlobal = {
  __TAURI__?: {
    core?: { invoke?: (command: string) => Promise<unknown> };
    updater?: { check?: () => Promise<UpdaterHandle | null> };
    process?: { relaunch?: () => Promise<void> };
  };
};

/** Güncelleme durumu */
type Phase = "idle" | "checking" | "available" | "downloading" | "installing" | "done" | "error";

/** Yerel uygulama sürümü (gömülü — Tauri'de komuttan okunur) */
const LOCAL_SHELL_VERSION = "1.1.0";

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
function humanSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(LOCAL_SHELL_VERSION);
  /** Güncelleyici kullanılabiliyor mu (yoksa elle indirme) */
  const [canAutoUpdate, setCanAutoUpdate] = useState(false);

  const startedRef = useRef(false);

  // --- Kabuk sürümü + güncelleyici yeteneği ---
  useEffect(() => {
    if (!IS_TAURI) return;

    const tauri = (window as unknown as TauriGlobal).__TAURI__;

    void (async () => {
      try {
        const version = await tauri?.core?.invoke?.("shell_version");
        if (typeof version === "string" && version) setCurrentVersion(version);
      } catch {
        /* gömülü sürüm */
      }

      // Güncelleyici eklentisi yüklü mü?
      setCanAutoUpdate(Boolean(tauri?.updater?.check));
    })();
  }, []);

  /** Tam otomatik güncelleme: indir → kur → yeniden başlat */
  const autoUpdate = useCallback(async () => {
    const tauri = (window as unknown as TauriGlobal).__TAURI__;
    if (!tauri?.updater?.check) return false;

    setPhase("checking");
    setMessage("Güncelleme kontrol ediliyor…");

    let updater: UpdaterHandle | null = null;
    try {
      updater = await tauri.updater.check();
    } catch (error) {
      setPhase("error");
      setMessage(`Güncelleme kontrol edilemedi: ${error instanceof Error ? error.message : error}`);
      return false;
    }

    if (!updater) {
      setPhase("idle");
      return true; // güncelleme yok
    }

    setPhase("available");
    setMessage(`Yeni sürüm bulundu: ${updater.version}`);

    // Kullanıcıya çok kısa bilgi verip indirmeye geç
    await new Promise((resolve) => setTimeout(resolve, 900));

    setPhase("downloading");
    setProgress(0);

    let total = 0;
    let received = 0;

    try {
      await updater.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data?.contentLength ?? 0;
          setMessage(`İndiriliyor… ${humanSize(total)}`);
        } else if (event.event === "Progress") {
          received += event.data?.chunkLength ?? 0;
          if (total > 0) {
            setProgress(Math.min(100, Math.round((received / total) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
          setPhase("installing");
          setMessage("Kuruluyor… uygulama yeniden başlayacak");
        }
      });
    } catch (error) {
      setPhase("error");
      setMessage(`Güncellenemedi: ${error instanceof Error ? error.message : error}`);
      return false;
    }

    setPhase("done");
    setMessage("Güncelleme tamamlandı — yeniden başlatılıyor…");

    // Yeniden başlat (plugin-process)
    try {
      await tauri.process?.relaunch?.();
    } catch {
      toast.ok("Güncelleme kuruldu", "Uygulamayı kapatıp açın", "Güncelleme");
    }

    return true;
  }, []);

  /** Sürüm bilgisini çeker (yalnızca elle indirme yedeği için). */
  const fetchVersion = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/app/version`);
      if (!response.ok) return;
      setInfo((await response.json()) as VersionInfo);
    } catch {
      /* sessiz */
    }
  }, []);

  // --- Açılışta: otomatik güncelleme dene ---
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      // Önce tam otomatik yol
      if (IS_TAURI && canAutoUpdate) {
        const handled = await autoUpdate();
        if (handled) return;
      }

      // Yedek: sürüm bildirimi (elle indirme)
      await fetchVersion();
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoUpdate]);

  // --- Periyodik kontrol (6 saat) ---
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (IS_TAURI && canAutoUpdate) {
        void autoUpdate();
      } else {
        void fetchVersion();
      }
    }, 6 * 60 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [autoUpdate, canAutoUpdate, fetchVersion]);

  // Aktif güncelleme sürerken bildirim her zaman görünür
  const busy = phase === "checking" || phase === "downloading" || phase === "installing" || phase === "done";

  if (busy) {
    return (
      <div className="update-banner is-busy">
        <span className="update-banner__icon" aria-hidden="true">
          ⬆
        </span>
        <div className="update-banner__body">
          <div className="update-banner__title">Otomatik güncelleme</div>
          <div className="update-banner__notes">{message}</div>
          {phase === "downloading" && (
            <div className="update-banner__progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Yedek yol: elle indirme bildirimi
  const newer = info ? isNewer(info.shell.version, currentVersion) : false;

  if (!info || !newer || dismissed || phase === "error") return null;

  const downloadUrl = info.shell.download ? `${API_BASE}${info.shell.download}` : null;

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
              toast.warn("İndirme bağlantısı yok", "", "Güncelleme");
              return;
            }
            window.open(downloadUrl, "_blank", "noopener");
            toast.info("İndiriliyor…", "Kurulumu çalıştırın", "Güncelleme");
          }}
        >
          ⬇ İndir
        </button>

        <button
          type="button"
          className="update-banner__btn"
          onClick={() => {
            void autoUpdate();
            void fetchVersion();
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
