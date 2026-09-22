/**
 * Önyükleme ekranı.
 *
 * Konsol boot dizisini satır satır canlandırır. Dizi bittiğinde (veya
 * kullanıcı atlarsa) `onFinished` çağrılır.
 *
 * Kaynak referansı: v5 `core/console_ui.py` — harfiyen korunacak (karar #10).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { buildBootPhases, buildClosingLines } from "./bootSequence";
import type { StatusResponse } from "../lib/api";
import "./BootScreen.css";

interface BootScreenProps {
  status: StatusResponse | null;
  error: string | null;
  onFinished: () => void;
}

const LOGO = String.raw`
  ██████╗ ██╗██╗  ██╗████████╗ ██████╗  ██████╗ ██╗
  ██╔══██╗██║╚██╗██╔╝╚══██╔══╝██╔═══██╗██╔═══██╗██║
  ██████╔╝██║ ╚███╔╝    ██║   ██║   ██║██║   ██║██║
  ██╔═══╝ ██║ ██╔██╗    ██║   ██║   ██║██║   ██║██║
  ██║     ██║██╔╝ ██╗   ██║   ╚██████╔╝╚██████╔╝███████╗
  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝
          S Y S T E M   B O O T L O A D E R`;

/** Satır başına gecikme (ms). */
const LINE_DELAY_MS = 55;
/** Faz başlıkları arasında ek bekleme (ms). */
const PHASE_DELAY_MS = 180;

export function BootScreen({ status, error, onFinished }: BootScreenProps) {
  const phases = useMemo(() => buildBootPhases(status, error), [status, error]);
  const closing = useMemo(() => buildClosingLines(status), [status]);

  /** Kaç faz tamamen gösterildi. */
  const [revealedPhases, setRevealedPhases] = useState(0);
  /** İçinde bulunulan fazda kaç satır gösterildi. */
  const [revealedLines, setRevealedLines] = useState(0);
  /** Kapanış gösterilsin mi. */
  const [showClosing, setShowClosing] = useState(false);
  const [closingLines, setClosingLines] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Otomatik kaydırma
  useEffect(() => {
    const element = scrollerRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [revealedPhases, revealedLines, closingLines, showClosing]);

  // Satır satır ilerleme
  useEffect(() => {
    const phase = phases[revealedPhases];

    if (!phase) {
      if (!showClosing) {
        const timer = window.setTimeout(() => setShowClosing(true), PHASE_DELAY_MS);
        return () => window.clearTimeout(timer);
      }
      if (closingLines < closing.length) {
        const timer = window.setTimeout(() => setClosingLines((n) => n + 1), LINE_DELAY_MS);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    if (revealedLines < phase.lines.length) {
      const timer = window.setTimeout(() => setRevealedLines((n) => n + 1), LINE_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setRevealedPhases((n) => n + 1);
      setRevealedLines(0);
    }, PHASE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phases, revealedPhases, revealedLines, showClosing, closing, closingLines]);

  // Klavye ile atlama + Enter ile devam
  const finished = !phases[revealedPhases] && showClosing && closingLines >= closing.length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (finished && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onFinished();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finished, onFinished]);

  return (
    <div className="boot" ref={scrollerRef} onClick={finished ? onFinished : undefined}>
      <pre className="boot__logo">{LOGO}</pre>

      {phases.slice(0, revealedPhases + 1).map((phase, phaseIndex) => {
        const isCurrent = phaseIndex === revealedPhases;
        const lines = isCurrent ? phase.lines.slice(0, revealedLines) : phase.lines;

        // Henüz hiç satırı gösterilmemiş gelecek fazı çizme
        if (lines.length === 0 && isCurrent) {
          return null;
        }

        return (
          <div className="boot__phase" key={phase.title}>
            <div className="boot__phase-title">{phase.title}</div>
            {lines.map((line, lineIndex) => (
              <div
                className={`boot__line boot__line--${line.tone ?? "default"}`}
                key={`${phase.title}-${lineIndex}`}
              >
                {line.text}
              </div>
            ))}
          </div>
        );
      })}

      {showClosing && (
        <div className="boot__phase">
          {closing.slice(0, closingLines).map((line, index) => (
            <div
              className={`boot__line boot__line--${line.tone ?? "default"}`}
              key={`closing-${index}`}
            >
              {line.text}
            </div>
          ))}
        </div>
      )}

      {finished ? (
        <div className="boot__ready">
          All systems operational. &gt; exec /desktop/main
          <span className="boot__cursor" />
          <div className="boot__hint">
            Giriş yapmak için <strong>Tıkla</strong> veya <strong>Enter</strong> · (Faz 1: login + OTP
            eklenecek)
          </div>
        </div>
      ) : (
        <span className="boot__cursor" />
      )}
    </div>
  );
}
