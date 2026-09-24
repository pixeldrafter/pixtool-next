/**
 * Konsol ekranı.
 *
 * Giriş sonrası çalışır: makinenin tüm bilgisini terminal akışıyla basar.
 * Sonunda **"bu bilgileri veritabanına kaydetmek ister misin?"** diye sorar;
 * onaylanırsa backend'e gönderir (NocoDB `devices` tablosu — Faz 2).
 *
 * Ayar: `flow.consoleVerbosity`
 *   off        → bu ekran hiç açılmaz (App atlar)
 *   summary    → yalnızca özet satırlar
 *   everything → tüm satırlar
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useSettingsStore } from "../settings/store";
import { buildConsoleSections, filterSections, type ConsoleLine } from "./consoleLines";
import { probeMachine, type MachineInfo } from "./probe";
import { resolveBridgeOptions } from "./bridge";
import { saveDeviceReport } from "./api";
import "./ConsoleScreen.css";

interface ConsoleScreenProps {
  /** Rapor kaydedildikten (veya atlandıktan) sonra */
  onFinished: (result: { saved: boolean }) => void;
  /** Oturum tokenı — rapor kaydında kullanılır */
  token?: string;
}

const LINE_DELAY_MS = 42;
const SECTION_DELAY_MS = 150;

export function ConsoleScreen({ onFinished, token }: ConsoleScreenProps) {
  const verbosity = useSettingsStore((state) => state.settings.flow.consoleVerbosity);
  const askSaveReport = useSettingsStore((state) => state.settings.flow.askSaveReport);
  const bridgeSettings = useSettingsStore((state) => state.settings.bridge);

  const [info, setInfo] = useState<MachineInfo | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Makine bilgisi topla (yerel köprü dahil — Faz 3)
  useEffect(() => {
    let cancelled = false;
    const useBridge = bridgeSettings.enabled && bridgeSettings.autoProbe;

    void (async () => {
      // Masaüstü kabuğunda köprüyü kabuk başlatır; adres+token oradan gelir
      const bridgeOptions = useBridge
        ? await resolveBridgeOptions({
            url: bridgeSettings.url,
            token: bridgeSettings.token || undefined,
          })
        : undefined;

      const result = await probeMachine({
        skipBridge: !useBridge,
        ...(bridgeOptions ?? {}),
      });
      if (!cancelled) setInfo(result);
    })();

    return () => {
      cancelled = true;
    };
    // Köprü ayarları yalnızca açılışta okunur (konsol tek seferlik bir akıştır)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Düz satır listesi (bölüm başlıkları dahil)
  const flatLines = useMemo<ConsoleLine[]>(() => {
    if (!info) return [];

    const level = verbosity === "summary" ? "summary" : "everything";
    const sections = filterSections(buildConsoleSections(info), level);

    const lines: ConsoleLine[] = [];
    for (const section of sections) {
      lines.push({ text: section.title, tone: "head" });
      lines.push(...section.lines);
      lines.push({ text: "", tone: "default" });
    }
    return lines;
  }, [info, verbosity]);

  // Satır satır akıtma
  useEffect(() => {
    if (flatLines.length === 0) return undefined;
    if (revealed >= flatLines.length) {
      const timer = window.setTimeout(() => setAsking(true), 400);
      return () => window.clearTimeout(timer);
    }

    const current = flatLines[revealed];
    const delay = current?.tone === "head" ? SECTION_DELAY_MS : LINE_DELAY_MS;
    const timer = window.setTimeout(() => setRevealed((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [flatLines, revealed]);

  // Otomatik kaydırma
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [revealed, asking]);

  // Rapor kaydetme sorusu kapatılmışsa doğrudan geç
  useEffect(() => {
    if (asking && !askSaveReport) {
      onFinished({ saved: false });
    }
  }, [asking, askSaveReport, onFinished]);

  async function handleSave() {
    if (!info) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await saveDeviceReport(info, token);
      setSaveMessage(response.message ?? "Rapor kaydedildi.");
      window.setTimeout(() => onFinished({ saved: true }), 900);
    } catch (caught) {
      setSaveMessage(
        caught instanceof Error
          ? `Kaydedilemedi: ${caught.message}`
          : "Kaydedilemedi.",
      );
      setSaving(false);
    }
  }

  const finished = revealed >= flatLines.length && flatLines.length > 0;

  return (
    <div className="console-screen">
      <div className="console-screen__header mono">
        <span className="console-screen__title">PIXTOOL — SYSTEM INVENTORY</span>
        <span className="console-screen__level">
          {verbosity === "summary" ? "ÖZET" : "TAM DÖKÜM"}
        </span>
      </div>

      <div className="console-screen__body" ref={scrollRef}>
        <pre className="console-screen__logo">{String.raw`
  ┌─────────────────────────────────────────────────────────────┐
  │   P I X T O O L   ·   M A K İ N E   E N V A N T E R İ       │
  └─────────────────────────────────────────────────────────────┘`}</pre>

        {!info && <div className="console-line console-line--info">&gt; makine taranıyor…</div>}

        {flatLines.slice(0, revealed).map((line, index) => (
          <div
            key={index}
            className={`console-line console-line--${line.tone}`}
          >
            {line.text || "\u00a0"}
          </div>
        ))}

        {finished && !asking && <span className="console-cursor" />}

        {asking && (
          <div className="console-screen__ask">
            <div className="console-ask__question">
              &gt; Bu bilgileri veritabanına kaydetmek ister misin?
            </div>
            <div className="console-ask__hint">
              Kaydedilirse sonradan bu makine üzerinde çalışırken bilgilerine
              bakabilirsin (NocoDB <code>devices</code> tablosu).
            </div>

            {saveMessage && <div className="console-ask__message">{saveMessage}</div>}

            <div className="console-ask__buttons">
              <button
                type="button"
                className="console-btn console-btn--primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Kaydediliyor…" : "Evet, kaydet"}
              </button>
              <button
                type="button"
                className="console-btn"
                onClick={() => onFinished({ saved: false })}
                disabled={saving}
              >
                Hayır, atla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
