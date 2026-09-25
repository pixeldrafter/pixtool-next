/**
 * Tarayıcı — sunucu üzerinden gezen web tarayıcısı.
 *
 * Sayfalar **sunucu tarafında** çekilir ve bağlantılar proxy'ye çevrilir;
 * böylece panelin içinde gezen trafik sunucunun IP'siyle çıkar. Adres
 * çubuğunun yanındaki göstergede o IP canlı olarak yazılır.
 *
 * Desteklenenler: gezinme, geri/ileri, yenileme, ana sayfa, sekme çubuğu
 * (iframe), yer imleri, adres çubuğu için arama (adres değilse Google).
 *
 * Sınırlama: POST formları proxy'den geçemez (yalnızca GET). Giriş gerektiren
 * siteler bu yüzden sınırlı çalışır — amaç genel gezinme ve doğrulamadır.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE } from "../../lib/apiBase";
import { toast } from "../../notifications";
import "../apps.css";
import "./browser-window.css";

/** Yanıt: dış IP */
interface IpInfo {
  ok: boolean;
  ip: string | null;
  source?: string;
  country?: string;
  city?: string;
  org?: string;
  message?: string;
}

/** Yer imi */
interface Bookmark {
  label: string;
  url: string;
}

const STORAGE_KEY = "pixtool.browser.v1";

/** Ana sayfa (sunucu da aynı adresi döndürür) */
const DEFAULT_HOME = "https://omercataloglu.com";

/** Varsayılan yer imleri */
const DEFAULT_BOOKMARKS: Bookmark[] = [
  { label: "Ana Sayfa", url: "https://omercataloglu.com" },
  { label: "Panel", url: "https://pixtool.omercataloglu.com" },
  { label: "NocoDB", url: "https://noco.omercataloglu.com" },
  { label: "n8n", url: "https://otomasyon.omercataloglu.com" },
];

/** Kalıcı durum */
interface Persisted {
  history: string[];
  index: number;
  bookmarks: Bookmark[];
}

function loadPersisted(): Persisted {
  const fallback: Persisted = { history: [DEFAULT_HOME], index: 0, bookmarks: DEFAULT_BOOKMARKS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const history = Array.isArray(parsed.history) && parsed.history.length
      ? parsed.history
      : fallback.history;
    return {
      history,
      index: Math.min(Math.max(parsed.index ?? 0, 0), history.length - 1),
      bookmarks: Array.isArray(parsed.bookmarks) && parsed.bookmarks.length
        ? parsed.bookmarks
        : fallback.bookmarks,
    };
  } catch {
    return fallback;
  }
}

/** Adres mi, arama mı? */
function toUrl(input: string): string {
  const text = input.trim();
  if (!text) return DEFAULT_HOME;

  // Açık şema
  if (/^https?:\/\//i.test(text)) return text;

  // Yerel/özel şemalar → arama
  if (/^(about|data|javascript|file|mailto|tel):/i.test(text)) return DEFAULT_HOME;

  // Alan adı benzeri mi? (nokta var ve boşluk yok)
  if (/^[^\s]+\.[a-z]{2,}([/:?#].*)?$/i.test(text)) return `https://${text}`;

  // Yerel adres
  if (/^(localhost|\d+\.\d+\.\d+\.\d+)(:\d+)?([/?#].*)?$/i.test(text)) {
    return `http://${text}`;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
}

/** Proxy URL'i üretir. */
function proxyUrl(target: string, bust = 0): string {
  const base = `${API_BASE}/api/v1/browser/fetch?url=${encodeURIComponent(target)}`;
  return bust ? `${base}&_=${bust}` : base;
}

export function BrowserWindow() {
  const initial = useRef(loadPersisted());

  const [history, setHistory] = useState<string[]>(initial.current.history);
  const [index, setIndex] = useState(initial.current.index);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initial.current.bookmarks);

  const [address, setAddress] = useState(history[initial.current.index] ?? DEFAULT_HOME);
  const [loading, setLoading] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  /** Proxy'nin yanıt verdiği son adres (yönlendirmelerden sonra değişir) */
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const current = history[index] ?? DEFAULT_HOME;

  // --- Kalıcılık ---
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ history, index, bookmarks } satisfies Persisted),
      );
    } catch {
      /* kota dolu — yoksay */
    }
  }, [history, index, bookmarks]);

  // --- Dış IP (bir kez) ---
  const loadIp = useCallback(async () => {
    setIpLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/browser/myip`);
      setIp((await response.json()) as IpInfo);
    } catch {
      setIp({ ok: false, ip: null, message: "Öğrenilemedi" });
    } finally {
      setIpLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIp();
  }, [loadIp]);

  // --- Gezinme ---
  const navigate = useCallback(
    (target: string) => {
      const url = toUrl(target);
      setHistory((stack) => {
        const trimmed = stack.slice(0, index + 1);
        if (trimmed[trimmed.length - 1] === url) return stack;
        return [...trimmed, url];
      });
      setIndex((position) => (history[position] === url ? position : position + 1));
      setAddress(url);
      setLoading(true);
      setFinalUrl(null);
    },
    [history, index],
  );

  const goBack = useCallback(() => {
    if (index <= 0) return;
    const next = index - 1;
    setIndex(next);
    setAddress(history[next] ?? DEFAULT_HOME);
    setLoading(true);
  }, [history, index]);

  const goForward = useCallback(() => {
    if (index >= history.length - 1) return;
    const next = index + 1;
    setIndex(next);
    setAddress(history[next] ?? DEFAULT_HOME);
    setLoading(true);
  }, [history, index]);

  const reload = useCallback(() => {
    setReloadNonce(Date.now());
    setLoading(true);
  }, []);

  const goHome = useCallback(() => {
    navigate(DEFAULT_HOME);
  }, [navigate]);

  // --- Yer imleri ---
  const addBookmark = useCallback(() => {
    const url = current;
    if (bookmarks.some((item) => item.url === url)) {
      toast.info("Zaten yer imlerinde", url, "Tarayıcı");
      return;
    }
    let label = url;
    try {
      label = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* yoksay */
    }
    setBookmarks((list) => [...list, { label, url }]);
    toast.ok("Yer imine eklendi", label, "Tarayıcı");
  }, [bookmarks, current]);

  const removeBookmark = useCallback((url: string) => {
    setBookmarks((list) => list.filter((item) => item.url !== url));
  }, []);

  // --- iframe yükleme durumu ---
  const frameSrc = useMemo(() => proxyUrl(current, reloadNonce), [current, reloadNonce]);

  const hostname = useMemo(() => {
    try {
      return new URL(current).hostname;
    } catch {
      return current;
    }
  }, [current]);

  const ipLabel = ipLoading
    ? "öğreniliyor…"
    : ip?.ok && ip.ip
      ? ip.ip
      : (ip?.message ?? "bilinmiyor");

  return (
    <div className="app browser">
      <div className="app__toolbar">
        <h2 className="app__title">Tarayıcı</h2>

        <button className="app-btn" onClick={goBack} disabled={index <= 0} title="Geri">
          ←
        </button>
        <button
          className="app-btn"
          onClick={goForward}
          disabled={index >= history.length - 1}
          title="İleri"
        >
          →
        </button>
        <button className="app-btn" onClick={reload} title="Yenile">
          ⟳
        </button>
        <button className="app-btn" onClick={goHome} title={DEFAULT_HOME}>
          ⌂
        </button>

        <span className="browser__exit" title="Bu tarayıcı trafiği sunucu üzerinden çıkar">
          <span className={`browser__dot${ip?.ok ? " is-on" : ""}`} />
          çıkış IP: <strong>{ipLabel}</strong>
        </span>

        <span className="app__spacer" />

        <button className="app-btn" onClick={addBookmark} title="Yer imlerine ekle">
          ☆
        </button>
      </div>

      {/* --- Adres çubuğu --- */}
      <div className="browser__nav">
        <input
          className="browser__address"
          type="text"
          value={address}
          spellCheck={false}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(address);
            if (event.key === "Escape") setAddress(current);
          }}
          placeholder="Adres veya arama yazın…"
          title="Enter ile git · arama için düz metin yazın"
        />
        <button
          className="app-btn app-btn--primary"
          onClick={() => navigate(address)}
          disabled={loading}
        >
          Git
        </button>
        <button
          className="app-btn"
          onClick={() => {
            void navigator.clipboard
              .writeText(current)
              .then(() => toast.ok("Adres kopyalandı", current, "Tarayıcı"))
              .catch(() => toast.error("Kopyalanamadı", "", "Tarayıcı"));
          }}
          title="Adresi kopyala"
        >
          ⧉
        </button>
      </div>

      {/* --- Yer imleri --- */}
      <div className="browser__bookmarks">
        {bookmarks.map((item) => (
          <span key={item.url} className="browser__bookmark">
            <button
              type="button"
              className="browser__bookmark-go"
              onClick={() => navigate(item.url)}
              title={item.url}
            >
              {item.label}
            </button>
            <button
              type="button"
              className="browser__bookmark-del"
              onClick={() => removeBookmark(item.url)}
              title="Yer imini kaldır"
            >
              ✕
            </button>
          </span>
        ))}
        {bookmarks.length === 0 && (
          <span className="browser__bookmarks-empty">Yer imi yok — ☆ ile ekle</span>
        )}
      </div>

      {/* --- Görünüm --- */}
      <div className="browser__stage">
        {loading && (
          <div className="browser__loading">
            <span className="app-spinner" />
            <span>{hostname} yükleniyor… (sunucu üzerinden)</span>
          </div>
        )}

        <iframe
          ref={frameRef}
          className="browser__frame"
          src={frameSrc}
          title="Tarayıcı"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
        />
      </div>

      <div className="browser__status">
        <span>{current}</span>
        {finalUrl && finalUrl !== current && <span>· yönlendi: {finalUrl}</span>}
        <span className="app__spacer" />
        <span>
          {ip?.ok
            ? `${ip.country ?? ""} ${ip.org ? `· ${ip.org}` : ""}`.trim() || "sunucu üzerinden"
            : "çıkış IP öğrenilemedi"}
        </span>
      </div>
    </div>
  );
}
