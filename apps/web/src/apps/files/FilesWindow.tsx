/**
 * Dosya Yöneticisi — Windows tarzı.
 *
 * | Özellik | Nasıl |
 * |---|---|
 * | Kaynak | Yerel makine (köprü) · Uzak sunucu (SFTP, salt okunur) |
 * | Gezinme | Geri/ileri/üst, kırıntı yolu, kenar çubuğu kısayolları |
 * | Seçim | Tık, Ctrl+tık, Shift+tık, boşluğa tıkla → kutu seçimi |
 * | Sürükle-bırak | Öğe → klasör/kenar çubuğu (taşı) · OS dosyası → pencere (yükle) |
 * | Düzenleme | Yerleşik metin düzenleyici, kaydet |
 * | Silme | Geri dönüşüm kutusu (varsayılan) veya kalıcı (onaylı) |
 * | Kalıcılık | Son dizin + görünüm modu kaydedilir |
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { describeError, fetchRemoteStatus, sftpList, type RemoteFile } from "../../lib/api";
import {
  deleteEntries,
  downloadUrl,
  fileIcon,
  isTextFile,
  listDirectory,
  listLocations,
  makeDirectory,
  moveEntries,
  probeBridge,
  readTextFile,
  renameEntry,
  trashEntries,
  uploadFile,
  writeTextFile,
  type FsEntry,
  type FsLocation,
} from "../../lib/fsApi";
import { toast } from "../../notifications";
import { useSettings } from "../../settings";
import "../apps.css";
import "./files-window.css";

const STORAGE_KEY = "pixtool.files.v1";

type Source = "local" | "remote";
type ViewMode = "list" | "grid";

interface Persisted {
  source: Source;
  localPath: string;
  remotePath: string;
  view: ViewMode;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = { source: "local", localPath: "", remotePath: ".", view: "list" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/** Bir öğeyi diğerine göre sıralar (klasörler önce). */
function sortEntries(entries: FsEntry[]): FsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name, "tr");
  });
}

export function FilesWindow() {
  const { settings } = useSettings();
  const bridgeOptions = useMemo(
    () => ({ baseUrl: settings.bridge.url, token: settings.bridge.token || undefined }),
    [settings.bridge.url, settings.bridge.token],
  );

  const initial = useRef(loadPersisted());

  const [source, setSource] = useState<Source>(initial.current.source);
  const [view, setView] = useState<ViewMode>(initial.current.view);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [locations, setLocations] = useState<FsLocation[]>([]);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [remoteOk, setRemoteOk] = useState(false);

  // Düzenleyici / yeniden adlandırma / kutu seçimi
  const [editing, setEditing] = useState<{ path: string; name: string; content: string; dirty: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [dropping, setDropping] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  // --- Kalıcılık ---
  useEffect(() => {
    const payload: Persisted = {
      source,
      localPath: source === "local" ? path : initial.current.localPath,
      remotePath: source === "remote" ? path : initial.current.remotePath,
      view,
    };
    initial.current = payload;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* kota dolu — yoksay */
    }
  }, [source, path, view]);

  // --- Köprü durumu ---
  const checkBridge = useCallback(async () => {
    const result = await probeBridge(bridgeOptions);
    setBridgeOk(result.ok);
    if (result.ok) {
      try {
        const list = await listLocations(bridgeOptions);
        setLocations(list);
      } catch {
        setLocations([]);
      }
    }
    return result.ok;
  }, [bridgeOptions]);

  useEffect(() => {
    void fetchRemoteStatus()
      .then((status) => setRemoteOk(Boolean(status.default_host_set && status.paramiko_available)))
      .catch(() => setRemoteOk(false));
  }, []);

  // --- Yerel dizin yükle ---
  const loadLocal = useCallback(
    async (target: string, options: { pushHistory?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const listing = await listDirectory(target, bridgeOptions);
        setEntries(sortEntries(listing.entries));
        setPath(listing.path);
        setSelected(new Set());
        setAnchor(null);
        if (options.pushHistory !== false) {
          setHistory((stack) => [...stack.slice(0, historyIndex + 1), listing.path]);
          setHistoryIndex((index) => index + 1);
        }
      } catch (caught) {
        setError(describeError(caught));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [bridgeOptions, historyIndex],
  );

  // --- Uzak dizin yükle (SFTP, salt okunur) ---
  const loadRemote = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await sftpList(target);
      setEntries(
        sortEntries(
          data.entries.map((entry: RemoteFile) => ({
            name: entry.name,
            path: entry.path,
            is_dir: entry.is_dir,
            size_bytes: entry.size_bytes,
            size: entry.is_dir ? "—" : String(entry.size_bytes),
            modified: entry.modified ?? "",
            modified_ts: entry.modified ? Date.parse(entry.modified) / 1000 : 0,
            extension: entry.is_dir ? "" : (entry.name.split(".").pop() ?? "").toLowerCase(),
            readonly: true,
          })),
        ),
      );
      setPath(data.path);
      setSelected(new Set());
      setAnchor(null);
    } catch (caught) {
      setError(describeError(caught));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Geçerli kaynakta dizin açar. */
  const navigate = useCallback(
    (target: string, options: { pushHistory?: boolean } = {}) => {
      if (source === "local") {
        void loadLocal(target, options);
      } else {
        void loadRemote(target);
      }
    },
    [source, loadLocal, loadRemote],
  );

  // --- İlk yükleme ---
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const ok = await checkBridge();
      if (cancelled) return;

      if (source === "local") {
        if (ok) {
          const start = initial.current.localPath;
          void loadLocal(start || (await listLocations(bridgeOptions))[0]?.path || ".");
        } else {
          setError("Yerel köprü çalışmıyor — dosya sistemine erişilemiyor.");
        }
      } else {
        void loadRemote(initial.current.remotePath || ".");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Kaynak değişince ---
  const switchSource = useCallback(
    (next: Source) => {
      if (next === source) return;
      setSource(next);
      setQuery("");
      setHistory([]);
      setHistoryIndex(-1);
      if (next === "local") {
        void loadLocal(initial.current.localPath || "");
      } else {
        void loadRemote(initial.current.remotePath || ".");
      }
    },
    [source, loadLocal, loadRemote],
  );

  // --- Gezinme yardımcıları ---
  const goUp = useCallback(() => {
    const parent =
      path.replace(/[\\/]+$/, "").split(/[\\/]/).slice(0, -1).join(path.includes("\\") ? "\\" : "/") ||
      (path.includes("\\") ? "" : "/");
    if (parent) navigate(parent);
  }, [path, navigate]);

  const canGoUp = path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).length > 0;

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    setHistoryIndex(index);
    navigate(history[index] ?? "", { pushHistory: false });
  }, [history, historyIndex, navigate]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    setHistoryIndex(index);
    navigate(history[index] ?? "", { pushHistory: false });
  }, [history, historyIndex, navigate]);

  // --- Türetilmiş ---
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    if (!needle) return entries;
    return entries.filter((entry) => entry.name.toLocaleLowerCase("tr").includes(needle));
  }, [entries, query]);

  const breadcrumbs = useMemo(() => {
    const separator = path.includes("\\") ? "\\" : "/";
    const parts = path.split(separator).filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = path.startsWith(separator) ? separator : "";
    parts.forEach((part, index) => {
      accumulated =
        index === 0 && !path.startsWith(separator)
          ? part
          : `${accumulated.replace(/[\\/]$/, "")}${separator}${part}`;
      crumbs.push({ label: part, path: accumulated });
    });
    return crumbs;
  }, [path]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selected.has(entry.path)),
    [entries, selected],
  );

  // --- Seçim ---
  const handleSelect = useCallback(
    (entry: FsEntry, event: React.MouseEvent | React.ChangeEvent) => {
      const native = "nativeEvent" in event ? (event.nativeEvent as MouseEvent) : null;
      const multi = native ? native.ctrlKey || native.metaKey : false;
      const range = native ? native.shiftKey : false;

      setSelected((current) => {
        const next = new Set(current);
        if (range && anchor) {
          const from = filtered.findIndex((item) => item.path === anchor);
          const to = filtered.findIndex((item) => item.path === entry.path);
          if (from >= 0 && to >= 0) {
            const [low, high] = from < to ? [from, to] : [to, from];
            filtered.slice(low, high + 1).forEach((item) => next.add(item.path));
            return next;
          }
        }
        if (multi) {
          if (next.has(entry.path)) next.delete(entry.path);
          else next.add(entry.path);
          return next;
        }
        return new Set([entry.path]);
      });
      setAnchor(entry.path);
    },
    [anchor, filtered],
  );

  /** Boş alana tık → seçimi temizle. */
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  // --- Kutu seçimi (rubber band) ---
  useEffect(() => {
    if (!marquee) return undefined;

    function onMove(event: MouseEvent) {
      setMarquee((current) =>
        current ? { ...current, x2: event.clientX, y2: event.clientY } : current,
      );
    }

    function onUp(event: MouseEvent) {
      const start = marqueeStart.current;
      marqueeStart.current = null;
      setMarquee(null);
      if (!start || !listRef.current) return;

      const box = {
        left: Math.min(start.x, event.clientX),
        right: Math.max(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        bottom: Math.max(start.y, event.clientY),
      };

      // Çok küçük kutu → seçim temizle
      if (box.right - box.left < 4 && box.bottom - box.top < 4) return;

      const items = listRef.current.querySelectorAll<HTMLElement>("[data-entry-path]");
      const hits: string[] = [];
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top
        ) {
          const value = item.getAttribute("data-entry-path");
          if (value) hits.push(value);
        }
      });

      if (hits.length) setSelected(new Set(hits));
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [marquee]);

  // Kutu çizimi sırasında varsayılan metin seçimini engelle
  useLayoutEffect(() => {
    document.body.style.userSelect = marquee ? "none" : "";
    return () => {
      document.body.style.userSelect = "";
    };
  }, [marquee]);

  const startMarquee = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0 || event.target !== event.currentTarget) return;
      clearSelection();
      marqueeStart.current = { x: event.clientX, y: event.clientY };
      setMarquee({ x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY });
    },
    [clearSelection],
  );

  // --- Eylemler ---
  const openEntry = useCallback(
    (entry: FsEntry) => {
      if (entry.is_dir) {
        navigate(entry.path);
        return;
      }
      if (source === "remote") {
        toast.info("Uzak dosya", "Uzak sunucudaki dosyalar indirilebilir, düzenlenemez.");
        return;
      }
      if (isTextFile(entry)) {
        void readTextFile(entry.path, bridgeOptions)
          .then((file) =>
            setEditing({ path: file.path, name: file.name, content: file.content, dirty: false }),
          )
          .catch((caught) => toast.error("Dosya açılamadı", describeError(caught), "Dosyalar"));
      } else {
        toast.info(entry.name, "Bu dosya türü düzenleyicide açılamaz — indirebilirsin.", "Dosyalar");
      }
    },
    [navigate, source, bridgeOptions],
  );

  const doSave = useCallback(async () => {
    if (!editing) return;
    try {
      const result = await writeTextFile(editing.path, editing.content, bridgeOptions);
      toast.ok("Kaydedildi", result.path, "Dosyalar");
      setEditing({ ...editing, dirty: false });
      if (path) void loadLocal(path, { pushHistory: false });
    } catch (caught) {
      toast.error("Kaydedilemedi", describeError(caught), "Dosyalar");
    }
  }, [editing, bridgeOptions, path, loadLocal]);

  const doNewFolder = useCallback(async () => {
    try {
      const result = await makeDirectory(path, "Yeni klasör", bridgeOptions);
      toast.ok("Klasör oluşturuldu", result.path, "Dosyalar");
      void loadLocal(path, { pushHistory: false });
    } catch (caught) {
      toast.error("Klasör oluşturulamadı", describeError(caught), "Dosyalar");
    }
  }, [path, bridgeOptions, loadLocal]);

  const doNewFile = useCallback(async () => {
    const separator = path.includes("\\") ? "\\" : "/";
    let name = "yeni-metin.txt";
    let candidate = `${path}${separator}${name}`;
    let counter = 1;
    while (entries.some((entry) => entry.path.toLowerCase() === candidate.toLowerCase())) {
      name = `yeni-metin (${counter}).txt`;
      candidate = `${path}${separator}${name}`;
      counter += 1;
    }

    try {
      await writeTextFile(candidate, "", bridgeOptions);
      toast.ok("Dosya oluşturuldu", candidate, "Dosyalar");
      await loadLocal(path, { pushHistory: false });
      setEditing({ path: candidate, name, content: "", dirty: false });
    } catch (caught) {
      toast.error("Dosya oluşturulamadı", describeError(caught), "Dosyalar");
    }
  }, [path, entries, bridgeOptions, loadLocal]);

  const doRename = useCallback(
    async (entry: FsEntry, name: string) => {
      setRenaming(null);
      if (!name.trim() || name === entry.name) return;
      try {
        await renameEntry(entry.path, name.trim(), bridgeOptions);
        toast.ok("Yeniden adlandırıldı", name.trim(), "Dosyalar");
        if (path) void loadLocal(path, { pushHistory: false });
      } catch (caught) {
        toast.error("Yeniden adlandırılamadı", describeError(caught), "Dosyalar");
      }
    },
    [bridgeOptions, path, loadLocal],
  );

  const doTrash = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      try {
        const result = await trashEntries(paths, bridgeOptions);
        if (result.ok) toast.ok("Geri dönüşüm kutusuna taşındı", result.message, "Dosyalar");
        if (result.errors?.length) toast.warn("Bazı öğeler taşınamadı", result.errors.join(" · "), "Dosyalar");
        if (path) void loadLocal(path, { pushHistory: false });
      } catch (caught) {
        toast.error("Taşınamadı", describeError(caught), "Dosyalar");
      }
    },
    [bridgeOptions, path, loadLocal],
  );

  const doDelete = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      const label = paths.length === 1 ? paths[0].split(/[\\/]/).pop() : `${paths.length} öğe`;
      if (!window.confirm(`${label} KALICI olarak silinsin mi?\n\nBu işlem geri alınamaz.`)) return;

      try {
        const result = await deleteEntries(paths, bridgeOptions);
        if (result.ok) toast.ok("Kalıcı olarak silindi", result.message, "Dosyalar");
        if (result.errors?.length) toast.warn("Bazı öğeler silinemedi", result.errors.join(" · "), "Dosyalar");
        if (path) void loadLocal(path, { pushHistory: false });
      } catch (caught) {
        toast.error("Silinemedi", describeError(caught), "Dosyalar");
      }
    },
    [bridgeOptions, path, loadLocal],
  );

  const doMove = useCallback(
    async (sources: string[], destination: string) => {
      const real = sources.filter((item) => item !== destination);
      if (!real.length) return;
      try {
        const result = await moveEntries(real, destination, bridgeOptions);
        if (result.ok) toast.ok("Taşındı", result.message, "Dosyalar");
        if (result.errors?.length) toast.warn("Bazı öğeler taşınamadı", result.errors.join(" · "), "Dosyalar");
        if (path) void loadLocal(path, { pushHistory: false });
      } catch (caught) {
        toast.error("Taşınamadı", describeError(caught), "Dosyalar");
      }
    },
    [bridgeOptions, path, loadLocal],
  );

  /** Tarayıcıdan sürüklenen dosyaları yükler. */
  const doUpload = useCallback(
    async (files: File[], directory: string) => {
      if (!files.length) return;
      let succeeded = 0;
      for (const file of files) {
        try {
          await uploadFile(directory, file, bridgeOptions);
          succeeded += 1;
        } catch (caught) {
          toast.error(`${file.name} yüklenemedi`, describeError(caught), "Dosyalar");
        }
      }
      if (succeeded) toast.ok(`${succeeded} dosya yüklendi`, directory, "Dosyalar");
      if (path) void loadLocal(path, { pushHistory: false });
    },
    [bridgeOptions, path, loadLocal],
  );

  // --- Sürükle-bırak: pencereye dosya bırakma ---
  const onDropFiles = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDropping(false);

      const files = Array.from(event.dataTransfer.files ?? []);
      const target = dropTarget && entries.some((entry) => entry.path === dropTarget && entry.is_dir)
        ? dropTarget
        : path;

      if (files.length) {
        // Tarayıcıdan dosya geldi → yükle
        void doUpload(files, target);
        setDropTarget(null);
        return;
      }

      // İç öğe taşıma
      const payload = event.dataTransfer.getData("application/x-pixtool-paths");
      if (payload) {
        try {
          const sources = JSON.parse(payload) as string[];
          void doMove(sources, target);
        } catch {
          /* yoksay */
        }
      }
      setDropTarget(null);
    },
    [dropTarget, entries, path, doUpload, doMove],
  );

  // --- Klavye ---
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (editing || renaming) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (event.key === "F5") {
        event.preventDefault();
        if (path) navigate(path, { pushHistory: false });
      } else if (event.key === "F2" && selectedEntries.length === 1) {
        event.preventDefault();
        setRenaming({ path: selectedEntries[0].path, value: selectedEntries[0].name });
      } else if (event.key === "Delete" && selected.size) {
        event.preventDefault();
        void doTrash([...selected]);
      } else if (event.key === "Backspace" && canGoUp) {
        event.preventDefault();
        goUp();
      } else if (event.key === "a" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setSelected(new Set(filtered.map((entry) => entry.path)));
      } else if (event.key === "Escape") {
        clearSelection();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, renaming, selectedEntries, selected, canGoUp, goUp, filtered, navigate, path, clearSelection, doTrash]);

  const remoteReadOnly = source === "remote";
  const unavailable = source === "local" && bridgeOk === false;

  return (
    <div
      className={`app files${dropping ? " is-dropping" : ""}`}
      onDragOver={(event) => {
        if (remoteReadOnly) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDropping(false);
        setDropTarget(null);
      }}
      onDrop={onDropFiles}
    >
      {/* --- Araç çubuğu --- */}
      <div className="app__toolbar">
        <h2 className="app__title">Dosya Yöneticisi</h2>

        <div className="files__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={source === "local"}
            className={`files__tab${source === "local" ? " is-active" : ""}`}
            onClick={() => switchSource("local")}
          >
            🖥 Yerel makine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "remote"}
            className={`files__tab${source === "remote" ? " is-active" : ""}`}
            onClick={() => switchSource("remote")}
            disabled={!remoteOk && source !== "remote"}
            title={remoteOk ? "Uzak sunucu (SFTP, salt okunur)" : "SSH yapılandırılmamış"}
          >
            🌐 Uzak sunucu
          </button>
        </div>

        <span className="app__spacer" />

        <input
          className="app-input"
          type="search"
          placeholder="Bu dizinde ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!entries.length}
        />

        <button
          className="app-btn"
          onClick={() => setView(view === "list" ? "grid" : "list")}
          title="Görünüm"
        >
          {view === "list" ? "▤" : "▦"}
        </button>
        <button className="app-btn" onClick={() => navigate(path, { pushHistory: false })} disabled={loading}>
          {loading ? "…" : "⟳"}
        </button>
      </div>

      {/* --- Adres çubuğu --- */}
      <div className="files__nav">
        <button className="app-btn" onClick={goBack} disabled={historyIndex <= 0} title="Geri">
          ←
        </button>
        <button
          className="app-btn"
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          title="İleri"
        >
          →
        </button>
        <button className="app-btn" onClick={goUp} disabled={!canGoUp} title="Üst dizin">
          ↑
        </button>

        <div className="files__crumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="files__crumb-wrap">
              {index > 0 && <span className="files__crumb-sep">›</span>}
              <button
                type="button"
                className="files__crumb"
                onClick={() => navigate(crumb.path)}
                title={crumb.path}
              >
                {crumb.label}
              </button>
            </span>
          ))}
          {!breadcrumbs.length && <span className="files__crumb is-muted">{path || "—"}</span>}
        </div>

        {!remoteReadOnly && (
          <>
            <button className="app-btn" onClick={() => void doNewFolder()} disabled={unavailable} title="Yeni klasör">
              ＋ Klasör
            </button>
            <button className="app-btn" onClick={() => void doNewFile()} disabled={unavailable} title="Yeni metin dosyası">
              ＋ Metin
            </button>
          </>
        )}
      </div>

      {/* --- Uyarılar --- */}
      {unavailable && (
        <div className="app-msg app-msg--warn">
          <strong>Yerel köprü çalışmıyor.</strong> Dosya işlemleri için köprüyü başlatın
          (<code>start-bridge.bat</code>) veya masaüstü uygulamasını açın.
        </div>
      )}
      {remoteReadOnly && (
        <div className="app-msg app-msg--info">
          Uzak sunucu <strong>salt okunur</strong> listelenir (SFTP). Düzenleme için yerel makineyi kullanın.
        </div>
      )}
      {error && <div className="app-msg app-msg--error">{error}</div>}

      {/* --- Gövde --- */}
      <div className="files__body">
        {/* Kenar çubuğu */}
        <aside className="files__sidebar">
          <div className="files__side-head">Hızlı erişim</div>
          {locations.length === 0 && <div className="files__side-empty">Köprü bekleniyor…</div>}
          {locations.map((location) => (
            <button
              key={location.path}
              type="button"
              className={`files__side-item${path === location.path ? " is-active" : ""}${
                dropTarget === location.path ? " is-drop" : ""
              }`}
              onClick={() => navigate(location.path)}
              onDragOver={(event) => {
                if (!remoteReadOnly) {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTarget(location.path);
                }
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const payload = event.dataTransfer.getData("application/x-pixtool-paths");
                if (payload) {
                  try {
                    void doMove(JSON.parse(payload) as string[], location.path);
                  } catch {
                    /* yoksay */
                  }
                }
                setDropTarget(null);
                setDropping(false);
              }}
              title={location.path}
            >
              <span className="files__side-icon">📂</span>
              <span className="files__side-label">{location.label}</span>
            </button>
          ))}

          {selected.size > 0 && (
            <div className="files__side-actions">
              <div className="files__side-head">{selected.size} öğe seçili</div>
              {!remoteReadOnly && (
                <>
                  <button className="files__side-btn" onClick={() => void doTrash([...selected])}>
                    🗑 Geri dönüşüm kutusu
                  </button>
                  <button className="files__side-btn is-danger" onClick={() => void doDelete([...selected])}>
                    ⚠ Kalıcı sil
                  </button>
                </>
              )}
              <button
                className="files__side-btn"
                onClick={() => {
                  selectedEntries.forEach((entry) => {
                    if (!entry.is_dir) {
                      const link = document.createElement("a");
                      link.href = downloadUrl(entry.path, bridgeOptions);
                      link.download = entry.name;
                      link.click();
                    }
                  });
                }}
              >
                ⬇ İndir
              </button>
            </div>
          )}
        </aside>

        {/* Liste / ızgara */}
        <div
          ref={listRef}
          className={`files__list files__list--${view}`}
          onMouseDown={startMarquee}
          onDragOver={(event) => {
            if (remoteReadOnly) return;
            event.preventDefault();
          }}
        >
          {loading && entries.length === 0 && (
            <div className="app-loading">
              <span className="app-spinner" /> Dizin okunuyor…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="app-empty">
              <span aria-hidden="true">📁</span>
              {entries.length === 0
                ? unavailable
                  ? "Köprü yok"
                  : "Dizin boş"
                : "Aramaya uyan öğe yok"}
            </div>
          )}

          {view === "list" && filtered.length > 0 && (
            <table className="files__table">
              <thead>
                <tr>
                  <th style={{ width: 34 }} />
                  <th>Ad</th>
                  <th style={{ width: 100 }}>Boyut</th>
                  <th style={{ width: 165 }}>Değişim</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.path}
                    data-entry-path={entry.path}
                    className={`${selected.has(entry.path) ? "is-selected" : ""}${
                      dropTarget === entry.path ? " is-drop" : ""
                    }`}
                    draggable={!remoteReadOnly}
                    onDragStart={(event) => {
                      const payload = selected.has(entry.path) ? [...selected] : [entry.path];
                      event.dataTransfer.setData("application/x-pixtool-paths", JSON.stringify(payload));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      if (remoteReadOnly || !entry.is_dir) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setDropTarget(entry.path);
                    }}
                    onDragLeave={() => setDropTarget((current) => (current === entry.path ? null : current))}
                    onDrop={(event) => {
                      if (remoteReadOnly || !entry.is_dir) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const payload = event.dataTransfer.getData("application/x-pixtool-paths");
                      if (payload) {
                        try {
                          void doMove(JSON.parse(payload) as string[], entry.path);
                        } catch {
                          /* yoksay */
                        }
                      }
                      setDropTarget(null);
                      setDropping(false);
                    }}
                    onClick={(event) => handleSelect(entry, event)}
                    onDoubleClick={() => openEntry(entry)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!selected.has(entry.path)) setSelected(new Set([entry.path]));
                    }}
                  >
                    <td className="files__icon">{fileIcon(entry)}</td>
                    <td className="files__name">
                      {renaming?.path === entry.path ? (
                        <input
                          className="files__rename"
                          autoFocus
                          value={renaming.value}
                          onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
                          onBlur={() => void doRename(entry, renaming.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void doRename(entry, renaming.value);
                            if (event.key === "Escape") setRenaming(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <span title={entry.path}>{entry.name}</span>
                      )}
                    </td>
                    <td className="app-table__mono">{entry.size}</td>
                    <td className="app-table__mono">
                      {entry.modified_ts
                        ? new Date(entry.modified_ts * 1000).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "grid" && filtered.length > 0 && (
            <div className="files__grid">
              {filtered.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  data-entry-path={entry.path}
                  className={`files__tile${selected.has(entry.path) ? " is-selected" : ""}${
                    dropTarget === entry.path ? " is-drop" : ""
                  }`}
                  draggable={!remoteReadOnly}
                  onDragStart={(event) => {
                    const payload = selected.has(entry.path) ? [...selected] : [entry.path];
                    event.dataTransfer.setData("application/x-pixtool-paths", JSON.stringify(payload));
                  }}
                  onDragOver={(event) => {
                    if (remoteReadOnly || !entry.is_dir) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDropTarget(entry.path);
                  }}
                  onDragLeave={() => setDropTarget((current) => (current === entry.path ? null : current))}
                  onDrop={(event) => {
                    if (remoteReadOnly || !entry.is_dir) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const payload = event.dataTransfer.getData("application/x-pixtool-paths");
                    if (payload) {
                      try {
                        void doMove(JSON.parse(payload) as string[], entry.path);
                      } catch {
                        /* yoksay */
                      }
                    }
                    setDropTarget(null);
                    setDropping(false);
                  }}
                  onClick={(event) => handleSelect(entry, event)}
                  onDoubleClick={() => openEntry(entry)}
                  title={entry.path}
                >
                  <span className="files__tile-icon">{fileIcon(entry)}</span>
                  <span className="files__tile-name">{entry.name}</span>
                  <span className="files__tile-meta">{entry.size}</span>
                </button>
              ))}
            </div>
          )}

          {/* Kutu seçimi */}
          {marquee && (
            <div
              className="files__marquee"
              style={{
                left: Math.min(marquee.x1, marquee.x2) - (listRef.current?.getBoundingClientRect().left ?? 0),
                top: Math.min(marquee.y1, marquee.y2) - (listRef.current?.getBoundingClientRect().top ?? 0),
                width: Math.abs(marquee.x2 - marquee.x1),
                height: Math.abs(marquee.y2 - marquee.y1),
              }}
            />
          )}
        </div>
      </div>

      {/* --- Durum çubuğu --- */}
      <div className="files__status">
        <span>{entries.length} öğe</span>
        {selected.size > 0 && <span>· {selected.size} seçili</span>}
        <span className="app__spacer" />
        <span>{remoteReadOnly ? "salt okunur" : path}</span>
      </div>

      {/* --- Metin düzenleyici --- */}
      {editing && (
        <div className="files__editor-backdrop" onClick={() => setEditing(null)}>
          <div className="files__editor" onClick={(event) => event.stopPropagation()}>
            <div className="files__editor-head">
              <span className="files__editor-title">
                📝 {editing.name}
                {editing.dirty && <span className="files__editor-dirty">•</span>}
              </span>
              <span className="app__spacer" />
              <button className="app-btn" onClick={() => setEditing(null)}>
                Kapat
              </button>
              <button className="app-btn app-btn--primary" onClick={() => void doSave()} disabled={!editing.dirty}>
                💾 Kaydet
              </button>
            </div>
            <textarea
              className="files__editor-body"
              spellCheck={false}
              value={editing.content}
              onChange={(event) => setEditing({ ...editing, content: event.target.value, dirty: true })}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "s") {
                  event.preventDefault();
                  void doSave();
                }
              }}
            />
            <div className="files__editor-foot">
              <span className="app-table__mono">{editing.path}</span>
              <span className="app__spacer" />
              <span>
                {editing.content.length} karakter · {editing.content.split("\n").length} satır
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
