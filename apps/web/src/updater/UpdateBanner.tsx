/**
 * Güncelleme bildirimi.
 *
 * ## İki katman, iki strateji
 *
 * | Katman | Nasıl güncellenir |
 * |---|---|
 * | **Arayüz** | Sunucudan yüklenir → uygulama açılışta en güncelini alır. Bildirim gerekmez. |
 * | **Kabuk** | Tauri güncelleyicisi imzalı paketi indirir, kurar, yeniden başlatır. |
 *
 * ## Neden artık tam otomatik değil?
 *
 * Önceki sürüm güncellemeyi açılışta **kendiliğinden** indirip kuruyordu.
 * Windows'ta kurulum başlayınca uygulama süreci aniden kapanıyor ve bu,
 * kullanıcıyı tedirgin ediyordu. Ayrıca çalışan **köprü süreci** kurulum
 * dosyasını kilitlediği için "durdur / yoksay / yeniden dene" hatası çıkıyordu.
 *
 * Artık akış kullanıcı denetiminde:
 *
 * ```
 * uygulama açılır
 *    ↓
 * /api/v1/app/latest.json okunur
 *    ↓
 * sürüm daha yeni mi?  ──hayır──→  hiçbir şey yapma
 *    ↓ evet
 * "Yeni sürüm bulundu: x.y.z"  →  [Güncelle] butonu        (kullanıcı bekler)
 *    ↓ (tıklanınca)
 * köprü durdurulur → indirme (ilerleme çubuğu) → kurulum → yeniden başlatma
 * ```
 *
 * ## Geri dönüş
 *
 * Tauri güncelleyicisi yoksa (eski kabuk veya tarayıcı) sunucudan sürüm bilgisi
 * çekilir ve **elle indirme** bağlantısı sunulur.
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
const LOCAL_SHELL_VERSION = "1.2.7";

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

/** Kısa bekleme (Windows kurulumunun dosya kilidini bırakması için). */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  /** Bulunan güncelleme (kullanıcı onayı bekler) */
  const [update, setUpdate] = useState<UpdaterHandle | null>(null);
  /** Son kurulum denemesi hatası */
  const [installError, setInstallError] = useState<string | null>(null);

  const startedRef = useRef(false);
  const installingRef = useRef(false);

  /** Güncellemeyi yoklar — indirmez; bulursa bildirim gösterir. */
  const checkUpdate = useCallback(async (): Promise<void> => {
    const tauri = (window as unknown as TauriGlobal).__TAURI__;
    if (!tauri?.updater?.check) return;

    try {
      const found = await tauri.updater.check();
      if (found) {
        setUpdate(found);
        setPhase("available");
        setMessage(`Yeni sürüm bulundu: ${found.version}`);
      }
    } catch {
      /* sessiz — bir sonraki kontrol tekrar dener */
    }
  }, []);

  /** Kullanıcı "Güncelle" dedi: köprüyü durdur → indir → kur → yeniden başlat. */
  const installUpdate = useCallback(async () => {
    if (!update || installingRef.current) return;
    installingRef.current = true;
    setInstallError(null);

    const tauri = (window as unknown as TauriGlobal).__TAURI__;

    // ⚠️ Kurulum dosyası çalışan süreçler tarafından kilitlenirse Windows
    // "durdur / yoksay / yeniden dene" diyalogu çıkar. Köprü exe'si tam olarak
    // böyle bir kilittir; kurulumdan ÖNCE durdurulur.
    try {
      await tauri?.core?.invoke?.("bridge_stop");
    } catch {
      /* köprü zaten kapalı olabilir */
    }
    await wait(1200);

    setPhase("downloading");
    setProgress(0);
    setMessage("İndiriliyor…");

    let total = 0;
    let received = 0;

    try {
      await update.downloadAndInstall((event) => {
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
      installingRef.current = false;
      const text = error instanceof Error ? error.message : String(error);
      setInstallError(text);
      setPhase("available");
      toast.warn("Güncelleme tamamlanamadı", text, "Güncelleme");
      return;
    }

    setPhase("done");
    setMessage("Güncelleme tamamlandı — yeniden başlatılıyor…");

    // Windows'ta kurulum uygulamayı kapatabilir; yine de yeniden başlatmayı dene.
    try {
      await tauri?.process?.relaunch?.();
    } catch {
      toast.ok("Güncelleme kuruldu", "Uygulamayı kapatıp açın", "Güncelleme");
    }
  }, [update]);

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

  // --- Açılışta: kabuk sürümü + güncelleyici yeteneği + güncelleme yoklaması ---
  //
  // ⚠️ Tek akış: "yeteneği algıla" ile "yokla" ayrı effect'lerde yarışırdı
  // (açılış effect'i ilk render'da `canAutoUpdate === false` görüp kilidi
  // kapatıyordu). Bu yüzden algılama aynı async akışta yapılır.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      if (IS_TAURI) {
        const tauri = (window as unknown as TauriGlobal).__TAURI__;

        // 1) Kabuk sürümünü Rust'tan oku (yoksa gömülü sürüm kalır)
        try {
          const version = await tauri?.core?.invoke?.("shell_version");
          if (typeof version === "string" && version) setCurrentVersion(version);
        } catch {
          /* gömülü sürüm */
        }

        // 2) Güncelleyici eklentisi yüklü mü? (plugin-updater global API)
        const canAuto = Boolean(tauri?.updater?.check);
        setCanAutoUpdate(canAuto);

        // 3) Yokla — ama KENDİLİĞİNDEN İNDİRME. Bulursa buton göster.
        if (canAuto) {
          await checkUpdate();
          return;
        }
      }

      // Yedek: sürüm bildirimi (tarayıcı veya güncelleyicisiz eski kabuk)
      await fetchVersion();
    })();
  }, [checkUpdate, fetchVersion]);

  // --- Periyodik yoklama (6 saat) — yine yalnızca bildirim ---
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (IS_TAURI && canAutoUpdate) {
        void checkUpdate();
      } else {
        void fetchVersion();
      }
    }, 6 * 60 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [checkUpdate, canAutoUpdate, fetchVersion]);

  // Aktif güncelleme sürerken ilerleme görünür (yoklama sessizdir)
  const busy = phase === "downloading" || phase === "installing" || phase === "done";

  if (busy) {
    return (
      <div className="update-banner is-busy">
        <span className="update-banner__icon" aria-hidden="true">
          ⬆
        </span>
        <div className="update-banner__body">
          <div className="update-banner__title">Güncelleme</div>
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

  if (dismissed) return null;

  // --- Yol 1: Tauri güncelleyici mevcut ve sürüm bulundu → buton ---
  if (update) {
    return (
      <div className="update-banner">
        <span className="update-banner__icon" aria-hidden="true">
          ⬆
        </span>

        <div className="update-banner__body">
          <div className="update-banner__title">
            Yeni sürüm hazır: <strong>{update.version}</strong>
            <span className="update-banner__current">(kurulu {currentVersion})</span>
          </div>
          <div className="update-banner__notes">
            {update.body || "Tek tıkla indirilip kurulur; uygulama yeniden başlar."}
          </div>
          {installError && (
            <div className="update-banner__notes">
              ⚠ {installError} — tekrar deneyebilirsin.
            </div>
          )}
        </div>

        <div className="update-banner__actions">
          <button
            type="button"
            className="update-banner__btn is-primary"
            onClick={() => void installUpdate()}
          >
            ⬆ Güncelle
          </button>
          <button
            type="button"
            className="update-banner__btn is-ghost"
            onClick={() => setDismissed(true)}
            title="Daha sonra"
          >
            Sonra
          </button>
        </div>
      </div>
    );
  }

  // --- Yol 2: güncelleyici yok (eski kabuk / tarayıcı) → elle indirme ---
  const newer = info ? isNewer(info.shell.version, currentVersion) : false;
  if (!info || !newer) return null;

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
          onClick={() => void checkUpdate()}
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
