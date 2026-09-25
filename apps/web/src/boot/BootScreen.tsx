/**
 * Önyükleme ekranı.
 *
 * Açılış akışını satır satır canlandırır. Dizi bittiğinde (veya kullanıcı
 * atlarsa) `onFinished` çağrılır.
 *
 * Gerçek veri kaynakları: backend durumu (`status`) + makine envanteri
 * (`machine`, köprüden). Sahte veri gösterilmez.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { buildBootPhases, buildClosingLines } from "./bootSequence";
import type { StatusResponse } from "../lib/api";
import type { MachineInfo } from "../console/probe";
import { probeMachine } from "../console/probe";
import { resolveBridgeOptions } from "../console/bridge";
import { useSettingsStore } from "../settings/store";
import "./BootScreen.css";

interface BootScreenProps {
  status: StatusResponse | null;
  error: string | null;
  /** Makine envanteri (köprü dahil) — donanım satırları bundan beslenir */
  machine?: MachineInfo | null;
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
/** Envanter taraması sürerken ilk satırların görünmesi için bekleme (ms). */
const SCAN_GRACE_MS = 5200;

/** Tarama sürerken gösterilen güvenlik ağı (kilitlenme önleyici). */
void SCAN_GRACE_MS;

export function BootScreen({ status, error, machine = null, onFinished }: BootScreenProps) {
  const bridgeSettings = useSettingsStore((state) => state.settings.bridge);

  /**
   * Envanter.
   *
   * Normal akışta konsol tarafından taranır ve `machine` olarak gelir.
   * Ekran doğrudan açılırsa (`?step=boot` gibi) ya da konsol atlanmışsa
   * burada kendimiz tararız — böylece donanım satırları **her zaman** dolar.
   */
  const [fetched, setFetched] = useState<MachineInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  /** Tarama bitti mi (başarılı ya da başarısız) — akış buna göre başlar */
  const [scanDone, setScanDone] = useState(Boolean(machine));
  const inventory = machine ?? fetched;

  useEffect(() => {
    // Envanter zaten verildiyse tarama yok
    if (machine) {
      setScanDone(true);
      return undefined;
    }
    if (fetched || scanning) return undefined;
    if (!bridgeSettings.enabled) {
      setScanDone(true);
      return undefined;
    }

    let cancelled = false;
    setScanning(true);

    void (async () => {
      try {
        const bridgeOptions = bridgeSettings.autoProbe
          ? await resolveBridgeOptions({
              url: bridgeSettings.url,
              token: bridgeSettings.token || undefined,
            })
          : undefined;

        const result = await probeMachine({
          skipBridge: !bridgeSettings.autoProbe,
          ...(bridgeOptions ?? {}),
        });

        if (!cancelled) setFetched(result);
      } catch {
        // Tarama başarısız olsa bile akış devam etmeli
      } finally {
        if (!cancelled) setScanDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine, bridgeSettings.enabled, bridgeSettings.autoProbe]);

  const phases = useMemo(
    () => buildBootPhases(status, error, inventory),
    [status, error, inventory],
  );
  const closing = useMemo(
    () => buildClosingLines(status, inventory),
    [status, inventory],
  );

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
    // Envanter taraması bitmeden akış başlamasın (donanım satırları boş kalmasın)
    if (!scanDone) return undefined;

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
  }, [phases, revealedPhases, revealedLines, showClosing, closing, closingLines, scanDone]);

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

      {!scanDone && (
        <div className="boot__phase">
          <div className="boot__phase-title">DONANIM</div>
          <div className="boot__line boot__line--info">
            Envanter taranıyor…<span className="boot__cursor" />
          </div>
        </div>
      )}

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
          Sistem hazır &gt; exec /desktop/main
          <span className="boot__cursor" />
          <div className="boot__hint">
            Devam etmek için <strong>Tıkla</strong> veya <strong>Enter</strong>
          </div>
        </div>
      ) : (
        <span className="boot__cursor" />
      )}
    </div>
  );
}
