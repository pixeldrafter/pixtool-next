/**
 * Konsol rapor satırları.
 *
 * `MachineInfo`'yu terminal satırlarına çevirir. Ayrıntı seviyesi ayardan gelir:
 *   off        → konsol hiç gösterilmez (App bu adımı atlar)
 *   summary    → yalnızca "özet" işaretli satırlar
 *   everything → tüm satırlar
 */

import type { MachineInfo } from "./probe";
import { BRIDGE_REQUIRED_FIELDS } from "./probe";

export type ConsoleTone = "default" | "ok" | "warn" | "err" | "info" | "dim" | "accent" | "head";

export interface ConsoleLine {
  text: string;
  tone: ConsoleTone;
  /** Yalnızca "özet" seviyesinde gösterilsin mi */
  summary?: boolean;
}

export interface ConsoleSection {
  title: string;
  lines: ConsoleLine[];
}

function value(text: string | number | null | undefined, suffix = ""): string {
  if (text === null || text === undefined || text === "") return "—";
  return `${text}${suffix}`;
}

function yesNo(condition: boolean | null | undefined, yes = "EVET", no = "HAYIR"): string {
  if (condition === null || condition === undefined) return "—";
  return condition ? yes : no;
}

/** Bilgi yapısını bölümlere ayırır. */
export function buildConsoleSections(info: MachineInfo): ConsoleSection[] {
  const sections: ConsoleSection[] = [];

  // --- 1) Makine kimliği ---
  sections.push({
    title: "FAZ 1: MAKİNE KİMLİĞİ",
    lines: [
      { text: `Platform            : ${info.browser.platform}`, tone: "info", summary: true },
      { text: `Dil                 : ${info.browser.language}  (${info.browser.languages.slice(0, 4).join(", ")})`, tone: "default" },
      { text: `Saat dilimi         : ${info.browser.timezone}  (UTC${-info.browser.timezoneOffsetMinutes / 60 >= 0 ? "+" : ""}${-info.browser.timezoneOffsetMinutes / 60})`, tone: "default" },
      { text: `Yerel saat          : ${info.browser.localeDate}`, tone: "default", summary: true },
      { text: `Çevrimiçi           : ${yesNo(info.browser.online, "BAĞLI", "ÇEVRİMDIŞI")}`, tone: info.browser.online ? "ok" : "err", summary: true },
    ],
  });

  // --- 2) Donanım ---
  sections.push({
    title: "FAZ 2: DONANIM ÖZELLİKLERİ",
    lines: [
      {
        text: `Mantıksal çekirdek  : ${value(info.hardware.logicalCores, " çekirdek")}`,
        tone: info.hardware.logicalCores ? "ok" : "warn",
        summary: true,
      },
      {
        text: `Cihaz belleği       : ${value(info.hardware.deviceMemoryGb, " GB (tarayıcı tahmini)")}`,
        tone: info.hardware.deviceMemoryGb ? "ok" : "dim",
        summary: true,
      },
      { text: `Dokunmatik nokta    : ${value(info.hardware.touchPoints)}`, tone: "default" },
    ],
  });

  // --- 3) Ekran & grafik ---
  sections.push({
    title: "FAZ 3: EKRAN & GRAFİK KATMANI",
    lines: [
      { text: `Çözünürlük          : ${info.hardware.screen}`, tone: "info", summary: true },
      { text: `Kullanılabilir alan : ${info.hardware.availableScreen}`, tone: "default" },
      { text: `Renk derinliği      : ${value(info.hardware.colorDepth, " bit")}`, tone: "default" },
      { text: `Piksel oranı        : ${value(info.hardware.pixelRatio, "×")}`, tone: "default" },
      { text: `GPU üreticisi       : ${info.gpu.vendor}`, tone: "info", summary: true },
      { text: `GPU modeli          : ${info.gpu.renderer}`, tone: "info", summary: true },
      { text: `WebGL sürümü        : ${info.gpu.webglVersion}`, tone: "default" },
      { text: `Maks. doku boyutu   : ${value(info.gpu.maxTextureSize, " px")}`, tone: "default" },
      { text: `WebGPU desteği      : ${yesNo(info.gpu.webgpu, "VAR", "YOK")}`, tone: info.gpu.webgpu ? "ok" : "dim" },
    ],
  });

  // --- 4) Ağ ---
  const net = info.network;
  sections.push({
    title: "FAZ 4: AĞ KATMANI",
    lines: [
      { text: `Bağlantı tipi       : ${value(net.effectiveType)}`, tone: "info", summary: true },
      { text: `Tahmini hız         : ${value(net.downlinkMbps, " Mbps")}`, tone: "default" },
      { text: `Gecikme (RTT)       : ${value(net.rttMs, " ms")}`, tone: "default" },
      { text: `Veri tasarrufu      : ${yesNo(net.saveData, "AÇIK", "KAPALI")}`, tone: "default" },
      { text: `İç IP / dış IP      : köprü bekleniyor`, tone: "dim" },
      { text: `MAC adresleri       : köprü bekleniyor`, tone: "dim" },
    ],
  });

  // --- 5) Depolama & güç ---
  const storage = info.storage;
  const battery = info.battery;
  sections.push({
    title: "FAZ 5: DEPOLAMA & GÜÇ",
    lines: [
      { text: `Depolama kotası     : ${value(storage.quotaMb, " MB")}`, tone: "default", summary: true },
      { text: `Kullanılan alan     : ${value(storage.usageMb, " MB")}  (${value(storage.usagePercent, "%")})`, tone: "default" },
      { text: `Yerel kayıt sayısı  : ${value(storage.localStorageItems, " öge")}`, tone: "default" },
      {
        text: `Pil durumu          : ${battery.available ? `${value(battery.level, "%")} · ${yesNo(battery.charging, "ŞARJ OLUYOR", "ŞARJDA DEĞİL")}` : "kullanılamıyor (masaüstü)"}`,
        tone: battery.available ? "info" : "dim",
        summary: true,
      },
      {
        text: `Şarj süresi         : ${value(battery.chargingTimeSeconds, " saniye")}`,
        tone: "default",
      },
      { text: `Fiziksel diskler    : köprü bekleniyor`, tone: "dim" },
    ],
  });

  // --- 6) Çevre birimleri & güvenlik ---
  sections.push({
    title: "FAZ 6: ÇEVRE BİRİMLERİ & GÜVENLİK",
    lines: [
      { text: `Ses girişi          : ${value(info.media.audioInputs, " cihaz")}`, tone: "default" },
      { text: `Ses çıkışı          : ${value(info.media.audioOutputs, " cihaz")}`, tone: "default" },
      { text: `Kamera              : ${value(info.media.videoInputs, " cihaz")}`, tone: "default", summary: true },
      { text: `Çerezler            : ${yesNo(info.browser.cookiesEnabled, "AÇIK", "KAPALI")}`, tone: info.browser.cookiesEnabled ? "ok" : "warn" },
      { text: `İzleme koruması     : ${info.browser.doNotTrack === "1" ? "AÇIK" : "kapalı / ayarlanmamış"}`, tone: info.browser.doNotTrack === "1" ? "ok" : "dim" },
      { text: `Sayfa yüklenme      : ${value(info.performance.pageLoadMs, " ms")}`, tone: "default" },
      { text: `DOM hazır           : ${value(info.performance.domInteractiveMs, " ms")}`, tone: "default" },
      { text: `JS yığın kullanımı  : ${value(info.performance.jsHeapMb, " MB")}`, tone: "default" },
      { text: `Tarayıcı            : ${info.browser.userAgent.slice(0, 78)}`, tone: "dim" },
    ],
  });

  // --- 7) Köprü beklenen alanlar ---
  sections.push({
    title: "FAZ 7: YEREL KÖPRÜ GEREKTİREN ALANLAR (Faz 3)",
    lines: [
      ...BRIDGE_REQUIRED_FIELDS.map<ConsoleLine>((field) => ({
        text: `⏳ ${field.label.padEnd(20)}: ${field.description}`,
        tone: "dim",
      })),
      { text: "", tone: "default" },
      {
        text: "Bu alanlar tarayıcıdan okunamaz. Yerel köprü (Faz 3) kurulduğunda doldurulacaktır.",
        tone: "warn",
        summary: true,
      },
    ],
  });

  return sections;
}

/** Ayrıntı seviyesine göre satırları süzer. */
export function filterSections(
  sections: ConsoleSection[],
  verbosity: "summary" | "everything",
): ConsoleSection[] {
  if (verbosity === "everything") return sections;

  return sections
    .map((section) => ({
      ...section,
      lines: section.lines.filter((line) => line.summary),
    }))
    .filter((section) => section.lines.length > 0);
}
