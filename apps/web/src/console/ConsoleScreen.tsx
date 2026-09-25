/**
 * Konsol ekranı.
 *
 * Giriş sonrası çalışır: makinenin **tüm envanterini** terminal akışıyla basar.
 * Sonunda "bu bilgileri veritabanına kaydetmek ister misin?" diye sorar.
 *
 * Toplama ~6-10 sn sürer (anakart/BIOS/ısı/port sorguları). Bu sırada başlıkta
 * canlı durum gösterilir; hiçbir alan **uydurulmaz**.
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
  /** Dışarıdan verilen envanter (varsa yeniden taranmaz) */
  machine?: MachineInfo | null;
  /** Tarama tamamlanınca üst bileşene bildir (boot ekranı paylaşır) */
  onMachine?: (info: MachineInfo) => void;
}

const LINE_DELAY_MS = 42;
const SECTION_DELAY_MS = 150;

export function ConsoleScreen({
  onFinished,
  token,
  machine: provided = null,
  onMachine,
}: ConsoleScreenProps) {
  const verbosity = useSettingsStore((state) => state.settings.flow.consoleVerbosity);
  const askSaveReport = useSettingsStore((state) => state.settings.flow.askSaveReport);
  const bridgeSettings = useSettingsStore((state) => state.settings.bridge);

  const [info, setInfo] = useState<MachineInfo | null>(provided);
  const [revealed, setRevealed] = useState(0);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** Toplama aşaması — başlıkta canlı gösterilir */
  const [stage, setStage] = useState("makine taranıyor");
  /** Geçen süre (ms) */
  const [elapsed, setElapsed] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Geçen süre sayacı
  useEffect(() => {
    if (info) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(timer);
  }, [info]);

  // Makine bilgisi topla (yerel köprü dahil)
  useEffect(() => {
    // Üst bileşen zaten taradıysa yeniden tarama
    if (provided) {
      setInfo(provided);
      setStage("envanter hazır");
      return undefined;
    }

    let cancelled = false;
    const useBridge = bridgeSettings.enabled && bridgeSettings.autoProbe;

    const stages = [
      "işlemci ve bellek okunuyor",
      "anakart ve BIOS sorgulanıyor",
      "RAM slotları taranıyor",
      "diskler ve ağ okunuyor",
      "ısı sensörleri sorgulanıyor",
      "portlar taranıyor",
      "süreç ve servisler sayılıyor",
      "envanter tamamlanıyor",
    ];
    let stageIndex = 0;
    const stageTimer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, stages.length - 1);
      setStage(stages[stageIndex] ?? "taranıyor");
    }, 1100);

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

      window.clearInterval(stageTimer);
      if (!cancelled) {
        setStage("envanter hazır");
        setInfo(result);
        onMachine?.(result);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(stageTimer);
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

  /** Kısa özet — altbilgide gösterilir. */
  const summary = useMemo(() => {
    const report = (info?.bridge?.report ?? {}) as Record<string, unknown>;
    const ports = (report["ports"] ?? {}) as Record<string, unknown>;
    const board = (report["board"] ?? {}) as Record<string, unknown>;
    const thermal = (report["thermal"] ?? {}) as Record<string, unknown>;
    const memoryModules = (report["memory_modules"] ?? {}) as Record<string, unknown>;
    const bios = (board["bios"] ?? {}) as Record<string, unknown>;

    return {
      duration: info?.bridge?.duration_ms,
      ports: Number(ports["tcp_count"] ?? 0) + Number(ports["udp_count"] ?? 0),
      risky: Array.isArray(ports["risky"]) ? (ports["risky"] as unknown[]).length : 0,
      riskScore: Number(ports["risk_score"] ?? 0),
      slots: Array.isArray(memoryModules["modules"])
        ? (memoryModules["modules"] as unknown[]).length
        : 0,
      slotsTotal: memoryModules["slots_total"],
      temps: Array.isArray(thermal["temperatures"])
        ? (thermal["temperatures"] as unknown[]).length
        : 0,
      fans: Array.isArray(thermal["fans"]) ? (thermal["fans"] as unknown[]).length : 0,
      biosVersion: bios["version"],
      biosAge: bios["age_days"],
      bridge: Boolean(info?.bridge),
    };
  }, [info]);

  return (
    <div className="console-screen">
      <div className="console-screen__header mono">
        <span className="console-screen__title">PIXTOOL — MAKİNE ENVANTERİ</span>
        <span className="console-screen__level">
          {verbosity === "summary" ? "ÖZET" : "TAM DÖKÜM"}
        </span>
        <span className="console-screen__stage">
          {info
            ? `${flatLines.length} satır · ${summary.duration ?? 0} ms`
            : `${stage}… ${(elapsed / 1000).toFixed(1)} sn`}
        </span>
      </div>

      <div className="console-screen__body" ref={scrollRef}>
        <pre className="console-screen__logo">{String.raw`
  ┌─────────────────────────────────────────────────────────────┐
  │   P I X T O O L   ·   M A K İ N E   E N V A N T E R İ       │
  └─────────────────────────────────────────────────────────────┘`}</pre>

        {!info && (
          <div className="console-line console-line--info">
            &gt; {stage}… ({(elapsed / 1000).toFixed(1)} sn)
          </div>
        )}

        {flatLines.slice(0, revealed).map((line, index) => (
          <div
            key={index}
            className={`console-line console-line--${line.tone}`}
          >
            {line.text || "\u00a0"}
          </div>
        ))}

        {finished && !asking && (
          <>
            <div className="console-line console-line--head">ÖZET</div>
            <div className="console-line console-line--ok">
              {`  Köprü             : ${summary.bridge ? "BAĞLI" : "YOK (tarayıcı verisiyle sınırlı)"}`}
            </div>
            {summary.bridge && (
              <>
                <div className="console-line console-line--default">
                  {`  Toplam süre       : ${summary.duration} ms`}
                </div>
                <div className="console-line console-line--default">
                  {`  RAM modülü        : ${summary.slots}${summary.slotsTotal ? ` / ${summary.slotsTotal} slot` : ""}`}
                </div>
                <div className="console-line console-line--default">
                  {`  BIOS              : ${summary.biosVersion ?? "—"}${summary.biosAge ? ` (${summary.biosAge} gün)` : ""}`}
                </div>
                <div className="console-line console-line--default">
                  {`  Sıcaklık sensörü  : ${summary.temps}  ·  Fan: ${summary.fans}`}
                </div>
                <div
                  className={`console-line console-line--${summary.riskScore >= 70 ? "err" : summary.riskScore >= 45 ? "warn" : "ok"}`}
                >
                  {`  Dinlenen port     : ${summary.ports}  (riskli: ${summary.risky}, puan: ${summary.riskScore}/100)`}
                </div>
              </>
            )}
            <span className="console-cursor" />
          </>
        )}

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
