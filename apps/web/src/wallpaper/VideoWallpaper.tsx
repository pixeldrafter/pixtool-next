/**
 * Canlı duvar kağıdı — video (mp4 / webm).
 *
 * İki kaynak desteklenir:
 *   • `source` bir URL ise  → doğrudan oynatılır
 *   • `source === "indexeddb"` → kullanıcının yüklediği dosya IndexedDB'den
 *     okunup `blob:` URL ile oynatılır (kalıcı)
 *
 * Video **sessiz**, **döngüsel** ve `playsInline` oynar; tıklamayı
 * engellememesi için `pointer-events: none`.
 */

import { useEffect, useRef, useState } from "react";

import { loadVideoUrl } from "./videoStore";
import "./VideoWallpaper.css";

interface VideoWallpaperProps {
  /** Video kaynağı: bir URL veya `"indexeddb"` */
  source: string;
  /** Oynatma hızı (0.25 - 3) */
  speed?: number;
  /** Karartma (0-1) */
  dim?: number;
}

/** IndexedDB'den yüklenen dosya için kullanılan işaretçi. */
export const INDEXEDDB_SOURCE = "indexeddb";

export function VideoWallpaper({ source, speed = 1, dim = 0 }: VideoWallpaperProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Kaynağı çöz ---
  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setError(null);
    setUrl(null);

    if (!source) {
      setError("Video kaynağı seçilmedi.");
      return undefined;
    }

    if (source !== INDEXEDDB_SOURCE) {
      setUrl(source);
      return undefined;
    }

    void loadVideoUrl()
      .then((objectUrl) => {
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        if (!objectUrl) {
          setError("Yüklü video bulunamadı.");
          return;
        }
        created = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Video okunamadı.");
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [source]);

  // --- Oynatma hızı ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = Math.min(3, Math.max(0.25, speed));
  }, [speed, url]);

  // --- Otomatik oynatma (tarayıcı engelleyebilir) ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const attempt = (): void => {
      void video.play().catch(() => {
        // Otomatik oynatma engellendi — kullanıcı etkileşimini bekle
        const resume = (): void => {
          void video.play().catch(() => undefined);
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
    };

    attempt();
    return undefined;
  }, [url]);

  if (error) {
    return (
      <div className="vwall vwall--empty">
        <span className="vwall__hint">🎬 {error}</span>
      </div>
    );
  }

  return (
    <div className="vwall">
      {url && (
        <video
          ref={videoRef}
          className="vwall__video"
          src={url}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
      )}
      {dim > 0 && <div className="vwall__dim" style={{ opacity: dim }} />}
    </div>
  );
}
