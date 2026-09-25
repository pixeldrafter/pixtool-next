/**
 * Canlı donanım metrikleri — yerel köprüden periyodik okuma.
 *
 * Widget'lar bu kancayı kullanır. Köprü yoksa/erişilemezse `ok: false` döner
 * ve kartlar "köprü yok" durumunu gösterir (uygulama çökmez).
 *
 * ## İki hız
 *
 * Termal toplama (nvidia-smi + WMI) ağırdır; CPU/RAM/Disk ise hafiftir. Bu
 * yüzden **hızlı döngü** CPU/RAM/Disk'i sık, **yavaş döngü** sıcaklıkları
 * seyrek okur. Termal widget'ı yoksa hiç okunmaz.
 *
 * Sekme gizliyken yoklama duraklatılır.
 */

import { useEffect, useRef, useState } from "react";

import {
  asArray,
  asNumber,
  asRecord,
  asText,
  fetchBridgeInfo,
  readBridge,
  resolveBridgeOptions,
  type BridgeOptions,
} from "../console/bridge";

/** Tek bir disk bölümü özeti. */
export interface DiskMetric {
  mountpoint: string;
  percent: number | null;
  usedHuman: string;
  totalHuman: string;
}

/** Tek bir sıcaklık sensörü. */
export interface ThermalMetric {
  label: string;
  celsius: number;
}

export interface HardwareMetrics {
  /** Köprüden veri alınabiliyor mu */
  ok: boolean;
  /** İlk yükleme sürüyor mu */
  loading: boolean;
  /** Hata mesajı (varsa) */
  error: string | null;
  cpu: {
    percent: number | null;
    model: string;
    cores: number | null;
    frequencyMhz: number | null;
  };
  memory: {
    percent: number | null;
    usedHuman: string;
    totalHuman: string;
  };
  disks: DiskMetric[];
  thermal: ThermalMetric[];
  collectedAt: string | null;
}

const EMPTY: HardwareMetrics = {
  ok: false,
  loading: true,
  error: null,
  cpu: { percent: null, model: "", cores: null, frequencyMhz: null },
  memory: { percent: null, usedHuman: "", totalHuman: "" },
  disks: [],
  thermal: [],
  collectedAt: null,
};

/** Hızlı döngü yanıtını ayrıştırır (CPU/RAM/Disk). */
function parseFast(report: Record<string, unknown>): Pick<
  HardwareMetrics,
  "ok" | "loading" | "error" | "cpu" | "memory" | "disks"
> {
  const cpu = readBridge(report, "cpu");
  const memory = readBridge(report, "memory");
  const rawDisks = report["disks"];
  const diskList = Array.isArray(rawDisks) ? rawDisks : [];

  return {
    ok: true,
    loading: false,
    error: null,
    cpu: {
      percent: asNumber(cpu["usage_percent"]),
      model: asText(cpu["model"]),
      cores: asNumber(cpu["logical_cores"]),
      frequencyMhz: asNumber(cpu["current_frequency_mhz"]),
    },
    memory: {
      percent: asNumber(memory["percent"]),
      usedHuman: asText(memory["used_human"]),
      totalHuman: asText(memory["total_human"]),
    },
    disks: diskList.map((item) => {
      const entry = asRecord(item);
      return {
        mountpoint: asText(entry["mountpoint"]) || asText(entry["device"]) || "?",
        percent: asNumber(entry["percent"]),
        usedHuman: asText(entry["used_human"]),
        totalHuman: asText(entry["total_human"]),
      };
    }),
  };
}

/** Termal yanıtı ayrıştırır. */
function parseThermal(report: Record<string, unknown>): ThermalMetric[] {
  const thermalRecord = readBridge(report, "thermal");
  return asArray(thermalRecord["temperatures"]).map((item) => {
    const entry = asRecord(item);
    return {
      label: asText(entry["label"]) || "sensör",
      celsius: asNumber(entry["celsius"]) ?? 0,
    };
  });
}

export interface UseHardwareMetricsOptions {
  /** Hızlı yoklama aralığı (ms) — varsayılan 2500 */
  intervalMs?: number;
  /** Sıcaklıklar da okunsun mu (termal widget varsa) */
  needThermal?: boolean;
  /** Ayarlardan köprü adresi (kabuk yoksa yedek) */
  bridgeUrl?: string;
  /** Ayarlardan köprü tokenı (kabuk yoksa yedek) */
  bridgeToken?: string;
}

/**
 * Donanım metriklerini periyodik olarak okur.
 */
export function useHardwareMetrics(options: UseHardwareMetricsOptions = {}): HardwareMetrics {
  const { intervalMs = 2500, needThermal = false, bridgeUrl, bridgeToken } = options;
  const [metrics, setMetrics] = useState<HardwareMetrics>(EMPTY);
  const optionsRef = useRef<BridgeOptions | null>(null);
  const thermalRef = useRef(needThermal);
  thermalRef.current = needThermal;

  // Ayarlar değişince köprü seçeneklerini yenile
  useEffect(() => {
    optionsRef.current = null;
  }, [bridgeUrl, bridgeToken]);

  // --- Hızlı döngü: CPU / RAM / Disk ---
  useEffect(() => {
    let cancelled = false;

    const read = async (): Promise<void> => {
      try {
        if (!optionsRef.current) {
          optionsRef.current = await resolveBridgeOptions({
            url: bridgeUrl,
            token: bridgeToken,
          });
        }
        const info = await fetchBridgeInfo({
          ...optionsRef.current,
          parts: ["cpu", "memory", "disks"],
          timeoutMs: 8000,
        });
        if (cancelled) return;
        if (!info?.ok) {
          setMetrics((prev) => ({
            ...prev,
            ok: false,
            loading: false,
            error: "Köprü yanıt vermedi.",
          }));
          return;
        }
        setMetrics((prev) => ({ ...prev, ...parseFast(info.report), collectedAt: info.collected_at ?? null }));
      } catch {
        if (cancelled) return;
        setMetrics((prev) => ({
          ...prev,
          ok: false,
          loading: false,
          error: "Köprüye ulaşılamadı.",
        }));
      }
    };

    void read();
    const timer = window.setInterval(() => {
      if (!document.hidden) void read();
    }, intervalMs);

    const onVisible = (): void => {
      if (!document.hidden) void read();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  // --- Yavaş döngü: Sıcaklıklar (yalnızca termal widget varsa) ---
  useEffect(() => {
    if (!needThermal) return undefined;
    let cancelled = false;

    const readThermal = async (): Promise<void> => {
      try {
        if (!optionsRef.current) {
          optionsRef.current = await resolveBridgeOptions({
            url: bridgeUrl,
            token: bridgeToken,
          });
        }
        const info = await fetchBridgeInfo({
          ...optionsRef.current,
          parts: ["thermal"],
          timeoutMs: 25000,
        });
        if (cancelled || !info?.ok) return;
        setMetrics((prev) => ({ ...prev, thermal: parseThermal(info.report) }));
      } catch {
        /* termal okunamadı — kart "sensör yok" gösterir */
      }
    };

    void readThermal();
    const timer = window.setInterval(() => {
      if (!document.hidden && thermalRef.current) void readThermal();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [needThermal, bridgeUrl, bridgeToken]);

  return metrics;
}
