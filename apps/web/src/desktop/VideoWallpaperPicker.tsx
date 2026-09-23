/**
 * Canlı duvar kağıdı seçici (mp4 / webm).
 *
 * İki yol sunar:
 *   1. **Dosya yükle** → video IndexedDB'ye kaydedilir, kalıcı olur
 *   2. **URL gir** → uzak bir videoyu doğrudan oynatır
 *
 * IndexedDB kullanılamıyorsa yalnızca URL yolu gösterilir.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  INDEXEDDB_SOURCE,
  clearVideo,
  formatBytes,
  isIndexedDbAvailable,
  saveVideo,
  videoInfo,
} from "../wallpaper";
import "./VideoWallpaperPicker.css";

interface VideoWallpaperPickerProps {
  /** Ayar değeri: URL veya `"indexeddb"` */
  source: string;
  /** Değişince ayarlara yazılır */
  onChange: (source: string) => void;
}

export function VideoWallpaperPicker({
  source,
  onChange,
}: VideoWallpaperPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<{ size: number; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsIndexedDb = isIndexedDbAvailable();
  const usingStored = source === INDEXEDDB_SOURCE;

  // --- Kayıtlı videoyu sorgula ---
  const refresh = useCallback(async () => {
    const found = await videoInfo();
    setInfo(found);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, source]);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;

    setError(null);

    if (!/^video\//.test(file.type)) {
      setError("Yalnızca video dosyaları (mp4, webm) yüklenebilir.");
      return;
    }

    // 512 MB güvenlik sınırı
    if (file.size > 512 * 1024 * 1024) {
      setError(`Dosya çok büyük (${formatBytes(file.size)}) — en fazla 512 MB.`);
      return;
    }

    setBusy(true);
    try {
      await saveVideo(file);
      await refresh();
      onChange(INDEXEDDB_SOURCE);
    } catch {
      setError("Video kaydedilemedi. Tarayıcı depolama iznini kontrol edin.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleClear(): Promise<void> {
    setBusy(true);
    try {
      await clearVideo();
      setInfo(null);
      if (usingStored) onChange("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vwpick">
      <div className="vwpick__row">
        <span className="vwpick__label">Canlı duvar kağıdı</span>

        {supportsIndexedDb && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              className="vwpick__file"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "…" : "🎬 Video seç"}
            </button>
          </>
        )}

        {usingStored && (
          <button
            type="button"
            className="app-btn app-btn--danger"
            onClick={() => void handleClear()}
            disabled={busy}
            title="Yüklü videoyu sil"
          >
            🗑 Kaldır
          </button>
        )}
      </div>

      {/* Durum */}
      {usingStored && info && (
        <p className="vwpick__status vwpick__status--ok">
          ✔ Yüklü video kullanılıyor — {formatBytes(info.size)}
          {info.type ? ` · ${info.type.replace("video/", "")}` : ""}
        </p>
      )}

      {usingStored && !info && (
        <p className="vwpick__status vwpick__status--warn">
          ⚠ Yüklü video bulunamadı — yeniden yükleyin.
        </p>
      )}

      {!usingStored && info && (
        <p className="vwpick__status">
          Kayıtlı video var ({formatBytes(info.size)}) — kullanmak için yukarıdan
          seçin.
        </p>
      )}

      {!supportsIndexedDb && (
        <p className="vwpick__status vwpick__status--warn">
          ⚠ Bu tarayıcı IndexedDB desteklemiyor — yalnızca URL kullanılabilir.
        </p>
      )}

      {error && <p className="vwpick__status vwpick__status--warn">⚠ {error}</p>}

      <p className="vwpick__hint">
        Video sessiz ve döngüsel oynar. 4K dosyalar sorunsuz çalışır
        (öneri: H.264 mp4).
      </p>
    </div>
  );
}
