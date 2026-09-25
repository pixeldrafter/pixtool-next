/**
 * Tanıtım videosu — giriş başarılı olduktan sonra gösterilir.
 *
 * Akış: Giriş → OTP → **Video** → Konsol → Boot → Masaüstü
 *
 * Davranış:
 *   • Video bitince (veya "Atla" ile) sonraki adıma geçer.
 *   • Ses açılmazsa (tarayıcı otomatik oynatma engeli) sessiz oynatılır.
 *   • Video yüklenemezse adım sessizce atlanır — akış asla kilitlenmez.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import "./IntroVideo.css";

interface IntroVideoProps {
  /** Video dosya yolu (varsayılan: /vendor/pixtool.mp4) */
  src?: string;
  /** Kaç sn sonra "Atla" düğmesi görünsün */
  skipAfterSeconds?: number;
  /** Bitince veya atlanınca çağrılır */
  onFinished: () => void;
}

export function IntroVideo({
  src = "/vendor/pixtool.mp4",
  skipAfterSeconds = 1,
  onFinished,
}: IntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showSkip, setShowSkip] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const finished = useRef(false);

  /** Tek seferlik bitiş — çift çağrıya karşı korumalı. */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  }, [onFinished]);

  // Video yüklenemezse akışı kilitleme
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSkip(true), skipAfterSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [skipAfterSeconds]);

  // Otomatik oynatma engellenirse sessiz başlat
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      void attempt.catch(() => {
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => {
          // Hiç oynatılamıyorsa adımı atla
          setFailed(true);
          window.setTimeout(finish, 600);
        });
      });
    }

    return () => {
      video.pause();
    };
  }, [finish]);

  // Yükleme hatası → adımı atla
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (videoRef.current && videoRef.current.readyState === 0) {
        setFailed(true);
        finish();
      }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [finish]);

  // Klavye: Esc/Boşluk → atla
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === " ") {
        event.preventDefault();
        finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (failed) {
    return (
      <div className="intro-video intro-video--failed">
        <p>Tanıtım videosu oynatılamadı.</p>
        <button type="button" className="intro-video__skip" onClick={finish}>
          Devam et
        </button>
      </div>
    );
  }

  return (
    <div className="intro-video">
      <video
        ref={videoRef}
        className="intro-video__player"
        src={src}
        playsInline
        autoPlay
        onEnded={finish}
        onError={() => {
          setFailed(true);
          finish();
        }}
      />

      {/* Üstte marka şeridi */}
      <div className="intro-video__brand">
        <span className="intro-video__logo">PIXTOOL NEXT</span>
        <span className="intro-video__tagline">Güvenli giriş doğrulandı · tanıtım</span>
      </div>

      {/* Alt kontroller */}
      <div className="intro-video__bar">
        <button
          type="button"
          className="intro-video__mute"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = !video.muted;
            setMuted(video.muted);
          }}
          title={muted ? "Sesi aç" : "Sesi kapat"}
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <div className="intro-video__progress">
          <span className="intro-video__hint">Video bitince otomatik devam eder</span>
        </div>

        {showSkip && (
          <button type="button" className="intro-video__skip" onClick={finish}>
            Atla ▸
          </button>
        )}
      </div>
    </div>
  );
}
