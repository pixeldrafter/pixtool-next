/**
 * Ceza ekranı — "The Impossible Light Bulb".
 *
 * Kullanıcı OTP'yi 3 kez yanlış girince bu ekran açılır ve belirlenen süre
 * (varsayılan **2 dakika**) boyunca kalır.
 *
 * Neden: kullanıcı beklerken **sıkılmasın** — lambanın ipini çekip ışığı
 * yakıp söndürebilir. Kapı sesleri periyodik olarak çalar.
 *
 * Referans: "The impossible light bulb" (gsap + MorphSVG + CodePen CDN sesleri).
 * Burada bağımlılıksız yeniden yazıldı; sesler **yerelden** çalınır
 * (`/audio/bulb/*.mp3`).
 *
 * ⚠️ Not: Referans demo **MorphSVGPlugin** (GSAP Club — ücretli) kullanıyordu.
 * Bu sürüm onu kullanmaz; saf CSS + SVG ile çizilmiştir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSettingsStore } from "../settings/store";
import type { LoginTheme } from "./types";
import "./PunishmentScreen.css";

interface PunishmentScreenProps {
  theme: LoginTheme;
  /** Kaç saniye ceza */
  seconds: number;
  /** Süre dolduğunda */
  onFinished: () => void;
  /** Kaç yanlış deneme yapıldı (bilgi amaçlı) */
  wrongAttempts: number;
}

/** Ses dosyaları — yerel kopyalar (CodePen CDN bağımlılığı kaldırıldı). */
const AUDIO = {
  doorOpen: "/audio/bulb/door-open.mp3",
  doorClose: "/audio/bulb/door-close.mp3",
  bearLong: "/audio/bulb/bear-groan-long.mp3",
  bearShort: "/audio/bulb/bear-groan-short.mp3",
  click: "/audio/bulb/click.mp3",
} as const;

function playSound(source: string, volume = 0.45): void {
  try {
    const audio = new Audio(source);
    audio.volume = volume;
    void audio.play().catch(() => {
      /* Tarayıcı otomatik oynatmayı engelledi — sessizce yut */
    });
  } catch {
    /* Ses desteklenmiyor */
  }
}

export function PunishmentScreen({
  theme,
  seconds,
  onFinished,
  wrongAttempts,
}: PunishmentScreenProps) {
  const soundEnabled = useSettingsStore(
    (state) => state.settings.login.punishment.sound,
  );
  const globalSound = useSettingsStore((state) => state.settings.appearance.soundEnabled);

  const [remaining, setRemaining] = useState(seconds);
  const [lightOn, setLightOn] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const [pulls, setPulls] = useState(0);
  const [sadBear, setSadBear] = useState(false);

  const cordRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; offset: number } | null>(null);

  const canPlaySound = soundEnabled && globalSound;

  // --- Geri sayım ---
  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onFinished();
      return undefined;
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, onFinished]);

  // --- Açılışta kapı sesi ---
  useEffect(() => {
    if (!canPlaySound) return;
    playSound(AUDIO.doorOpen, 0.5);
    const timer = window.setTimeout(() => playSound(AUDIO.doorClose, 0.42), 1400);
    return () => window.clearTimeout(timer);
  }, [canPlaySound]);

  // --- Periyodik sesler (kullanıcı sıkılmasın, atmosfer sürsün) ---
  useEffect(() => {
    if (!canPlaySound) return undefined;
    const timer = window.setInterval(() => {
      playSound(Math.random() > 0.5 ? AUDIO.bearLong : AUDIO.bearShort, 0.3);
    }, 22000);
    return () => window.clearInterval(timer);
  }, [canPlaySound]);

  // --- İp çekme (sürükleme) ---
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    dragStartRef.current = { y: event.clientY, offset: pullOffset };
    setPulling(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }, [pullOffset]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const delta = Math.max(0, Math.min(90, event.clientY - start.y + start.offset));
    setPullOffset(delta);
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      setPulling(false);

      // Yeterince çekildiyse ışığı değiştir
      const pulledEnough = start ? event.clientY - start.y + start.offset >= 45 : false;
      if (pulledEnough) {
        setLightOn((value) => !value);
        setPulls((value) => value + 1);
        if (canPlaySound) playSound(AUDIO.click, 0.4);
        setSadBear(true);
        window.setTimeout(() => setSadBear(false), 900);
      }
      setPullOffset(0);
    },
    [canPlaySound],
  );

  // Klavye erişilebilirliği: Boşluk/Enter ile çek
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setLightOn((value) => !value);
        setPulls((value) => value + 1);
        if (canPlaySound) playSound(AUDIO.click, 0.4);
        setSadBear(true);
        window.setTimeout(() => setSadBear(false), 900);
      }
    },
    [canPlaySound],
  );

  const style: React.CSSProperties = useMemo(
    () => ({
      ["--pun-accent" as string]: theme.colors.accent,
      ["--pun-border" as string]: theme.colors.border,
      ["--pun-text" as string]: theme.colors.text,
      ["--pun-muted" as string]: theme.colors.muted,
      ["--pun-error" as string]: theme.colors.error,
      ["--pun-font" as string]: theme.font,
    }),
    [theme],
  );

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / seconds;

  return (
    <div className={`punishment${lightOn ? " is-lit" : ""}`} style={style}>
      {/* Odanın zemini */}
      <div className="punishment__room" aria-hidden="true" />

      {/* Tavan ve lamba */}
      <div className="punishment__ceiling" aria-hidden="true" />

      <div className="bulb-scene">
        {/* İp */}
        <div
          ref={cordRef}
          className={`cord${pulling ? " is-pulling" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Lambanın ipini çek"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          style={{ height: `${120 + pullOffset}px` }}
        >
          <span className="cord__line" />
          <span className="cord__tassel" />
        </div>

        {/* Abajur + ampul */}
        <div className="lamp-assembly">
          <div className="lamp-assembly__shade" />
          <div className="lamp-assembly__bulb" />
          <div className="lamp-assembly__light" />
        </div>

        {/* Ayı patisi (referanstaki ayıya selam) */}
        <div className={`bear-paw${sadBear ? " is-sad" : ""}`} aria-hidden="true">
          <span className="bear-paw__pad" />
          <span className="bear-paw__claw bear-paw__claw--1" />
          <span className="bear-paw__claw bear-paw__claw--2" />
          <span className="bear-paw__claw bear-paw__claw--3" />
        </div>
      </div>

      {/* Bilgi paneli */}
      <div className="punishment__panel">
        <div className="punishment__badge" role="alert">
          <span aria-hidden="true">⛔</span>
          {wrongAttempts} yanlış deneme — erişim geçici olarak kilitlendi
        </div>

        <h2 className="punishment__title">Ampulü yak</h2>
        <p className="punishment__text">
          Beklerken sıkılmana gerek yok. İpi aşağı sürükleyip ışığı yakıp söndürebilirsin.
        </p>

        <div className="punishment__countdown">
          <svg viewBox="0 0 120 120" className="punishment__ring" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * progress}
              transform="rotate(-90 60 60)"
              className="punishment__ring-progress"
            />
          </svg>
          <div className="punishment__time mono">
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        </div>

        <div className="punishment__stats">
          <span>Çekme sayısı: <strong>{pulls}</strong></span>
          <span>Durum: <strong>{lightOn ? "Aydınlık" : "Karanlık"}</strong></span>
        </div>

        <p className="punishment__footnote">
          Süre dolduğunda doğrulama ekranına döneceksin.
        </p>
      </div>
    </div>
  );
}
