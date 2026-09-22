/**
 * Animasyonlu kapatma butonu.
 *
 * Referans: "Animated Logout Button" — durum makinesi (default → hover →
 * yürüme → kapı → düşme). Burada React + CSS ile yeniden yazıldı:
 * butona basıldığında bir figür kapıdan çıkar, ışık söner ve kapatma
 * dizisi oynar.
 *
 * Ayar: `power.animatedShutdown` (kapalıysa animasyonsuz kapatır),
 *       `power.confirmShutdown` (onay ister).
 */

import { useCallback, useEffect, useState } from "react";

import { useSettingsStore } from "../settings/store";
import "./ShutdownButton.css";

interface ShutdownButtonProps {
  /** Kapatma tamamlandığında (çıkış / yeniden başlat) */
  onShutdown: () => void;
  /** Buton etiketi */
  label?: string;
}

type Stage = "idle" | "walking" | "exiting" | "dark";

/** Animasyon adımlarının süreleri (ms). */
const TIMINGS = {
  walking: 900,
  exiting: 1100,
  dark: 700,
} as const;

export function ShutdownButton({ onShutdown, label = "Kapat" }: ShutdownButtonProps) {
  const animated = useSettingsStore((state) => state.settings.power.animatedShutdown);
  const confirmShutdown = useSettingsStore((state) => state.settings.power.confirmShutdown);

  const [stage, setStage] = useState<Stage>("idle");

  const run = useCallback(() => {
    if (!animated) {
      onShutdown();
      return;
    }
    setStage("walking");
  }, [animated, onShutdown]);

  // Animasyon zinciri
  useEffect(() => {
    if (stage === "idle") return undefined;

    const delays: Record<Exclude<Stage, "idle">, [Stage, number]> = {
      walking: ["exiting", TIMINGS.walking],
      exiting: ["dark", TIMINGS.exiting],
      dark: ["idle", TIMINGS.dark],
    };

    const [next, delay] = delays[stage];
    const timer = window.setTimeout(() => {
      if (next === "idle") {
        onShutdown();
      } else {
        setStage(next);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [stage, onShutdown]);

  function handleClick() {
    if (confirmShutdown && !window.confirm("Kapatmak istediğine emin misin?")) {
      return;
    }
    run();
  }

  return (
    <>
      <button
        type="button"
        className={`shutdown-btn${stage !== "idle" ? " is-running" : ""}`}
        onClick={handleClick}
        disabled={stage !== "idle"}
        title={`${label} — animasyonlu sıra`}
      >
        <span className="shutdown-btn__door" aria-hidden="true">
          <span className="shutdown-btn__frame" />
          <span className="shutdown-btn__inner" />
        </span>
        <span className="shutdown-btn__figure" aria-hidden="true">
          <span className="shutdown-btn__head" />
          <span className="shutdown-btn__body" />
        </span>
        <span className="shutdown-btn__text">{label}</span>
      </button>

      {/* Tam ekran kapatma perdesi */}
      {stage !== "idle" && (
        <div className={`shutdown-overlay shutdown-overlay--${stage}`}>
          <div className="shutdown-overlay__room">
            <div className="shutdown-overlay__light" />
            <div className="shutdown-overlay__figure">
              <span className="shutdown-figure__head" />
              <span className="shutdown-figure__body" />
              <span className="shutdown-figure__leg shutdown-figure__leg--left" />
              <span className="shutdown-figure__leg shutdown-figure__leg--right" />
            </div>
            <div className="shutdown-overlay__door">
              <span className="shutdown-door__panel" />
            </div>
          </div>
          <div className="shutdown-overlay__message mono">
            {stage === "walking" && "> oturum kapatılıyor…"}
            {stage === "exiting" && "> bağlantılar sonlandırılıyor…"}
            {stage === "dark" && "> sistem kapatıldı"}
          </div>
        </div>
      )}
    </>
  );
}
