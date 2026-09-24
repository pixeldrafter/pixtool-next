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

function value(text: unknown, suffix = ""): string {
  if (text === null || text === undefined || text === "") return "—";
  return `${text}${suffix}`;
}

function yesNo(condition: boolean | null | undefined, yes = "EVET", no = "HAYIR"): string {
  if (condition === null || condition === undefined) return "—";
  return condition ? yes : no;
}

// ----------------------------------------------------------------------
//  Yerel köprü (Faz 3) — okuma yardımcıları
// ----------------------------------------------------------------------
/** Köprü verisi var mı (gerçekten bilgi geldi mi)? */
function hasBridge(info: MachineInfo): boolean {
  return Boolean(info.bridge?.report && Object.keys(info.bridge.report).length > 0);
}

/** Köprü raporundan bir bölümü nesne olarak okur. */
function bridgePart(info: MachineInfo, key: string): Record<string, unknown> {
  const report = info.bridge?.report ?? {};
  const value = report[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Köprü raporundan bir bölümü dizi olarak okur. */
function bridgeList(info: MachineInfo, key: string): Record<string, unknown>[] {
  const value = bridgePart(info, key);
  const items = value["items"] ?? value["top_memory"] ?? value["interfaces"] ?? value["local_accounts"];
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

/** İlk N öğenin adını birleştirir. */
function joinNames(items: Record<string, unknown>[], key: string, limit = 3): string {
  return items
    .slice(0, limit)
    .map((item) => String(item[key] ?? "?"))
    .join(" · ");
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
  const bridgeNet = bridgePart(info, "network");
  const bridgeIfaces = Array.isArray(bridgeNet["interfaces"])
    ? (bridgeNet["interfaces"] as Record<string, unknown>[])
    : [];
  const primaryIface = bridgeIfaces[0];
  const ifaceAddresses = Array.isArray(primaryIface?.["addresses"])
    ? (primaryIface["addresses"] as Record<string, unknown>[])
    : [];
  const ipv4 = ifaceAddresses.find((item) => item["kind"] === "ipv4");
  const mac = ifaceAddresses.find((item) => item["kind"] === "mac");

  sections.push({
    title: "FAZ 4: AĞ KATMANI",
    lines: [
      { text: `Bağlantı tipi       : ${value(net.effectiveType)}`, tone: "info", summary: true },
      { text: `Tahmini hız         : ${value(net.downlinkMbps, " Mbps")}`, tone: "default" },
      { text: `Gecikme (RTT)       : ${value(net.rttMs, " ms")}`, tone: "default" },
      { text: `Veri tasarrufu      : ${yesNo(net.saveData, "AÇIK", "KAPALI")}`, tone: "default" },
      {
        text: `İç IP               : ${ipv4 ? String(ipv4["address"]) : "köprü bekleniyor"}`,
        tone: ipv4 ? "ok" : "dim",
        summary: Boolean(ipv4),
      },
      {
        text: `Dış IP              : ${bridgeNet["external_ip"] ? String(bridgeNet["external_ip"]) : "köprü bekleniyor"}`,
        tone: bridgeNet["external_ip"] ? "ok" : "dim",
        summary: Boolean(bridgeNet["external_ip"]),
      },
      {
        text: `MAC adresi          : ${mac ? String(mac["address"]) : "köprü bekleniyor"}`,
        tone: mac ? "ok" : "dim",
      },
      {
        text: `Ağ geçidi           : ${bridgeNet["gateway"] ? String(bridgeNet["gateway"]) : "köprü bekleniyor"}`,
        tone: bridgeNet["gateway"] ? "default" : "dim",
      },
      {
        text: `Arayüz sayısı       : ${bridgeIfaces.length || "köprü bekleniyor"}`,
        tone: bridgeIfaces.length ? "default" : "dim",
      },
      {
        text: `DNS sunucuları      : ${
          Array.isArray(bridgeNet["dns"]) && (bridgeNet["dns"] as unknown[]).length
            ? (bridgeNet["dns"] as unknown[]).slice(0, 3).join(", ")
            : "köprü bekleniyor"
        }`,
        tone: Array.isArray(bridgeNet["dns"]) && (bridgeNet["dns"] as unknown[]).length ? "default" : "dim",
      },
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
      {
        text: `Fiziksel diskler    : ${
          (() => {
            const disks = Array.isArray(info.bridge?.report?.["disks"])
              ? (info.bridge?.report?.["disks"] as Record<string, unknown>[])
              : [];
            if (!disks.length) return "köprü bekleniyor";
            return disks
              .slice(0, 3)
              .map(
                (disk) =>
                  `${disk["mountpoint"]} %${disk["percent"]} (${disk["used_human"]}/${disk["total_human"]})`,
              )
              .join("  ·  ");
          })()
        }`,
        tone: Array.isArray(info.bridge?.report?.["disks"]) &&
          (info.bridge?.report?.["disks"] as unknown[]).length
          ? "ok"
          : "dim",
        summary: true,
      },
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

  // --- 7) Yerel köprü verisi (Faz 3) ---
  const bridgeActive = hasBridge(info);
  const health = info.bridgeHealth;

  if (bridgeActive) {
    const cpu = bridgePart(info, "cpu");
    const mem = bridgePart(info, "memory");
    const sys = bridgePart(info, "system");
    const sec = bridgePart(info, "security");
    const proc = bridgePart(info, "processes");
    const users = bridgePart(info, "users");
    const gpuList = Array.isArray(info.bridge?.report?.["gpu"])
      ? (info.bridge?.report?.["gpu"] as Record<string, unknown>[])
      : [];
    const topMem = Array.isArray(proc["top_memory"])
      ? (proc["top_memory"] as Record<string, unknown>[])
      : [];
    const antivirus = Array.isArray(sec["antivirus"]) ? (sec["antivirus"] as unknown[]) : [];

    const bridgeLines: ConsoleLine[] = [
        {
          text: `Köprü               : ÇALIŞIYOR · v${info.bridge?.bridge_version} · ${health?.platform ?? "?"}`,
          tone: "ok",
          summary: true,
        },
        {
          text: `Cihaz kimliği       : ${info.bridge?.device_id ?? "—"}`,
          tone: "info",
          summary: true,
        },
        { text: `Toplama süresi      : ${value(info.bridge?.duration_ms, " ms")}`, tone: "default" },
        { text: `psutil              : ${yesNo(info.bridge?.psutil, "kurulu", "yok (PowerShell yedekleri)")}`, tone: "dim" },

        { text: "", tone: "default" },
        { text: "── İŞLETİM SİSTEMİ ──", tone: "head" },
        { text: `Sürüm               : ${value(String(sys["os_name"] ?? ""), "")}`.replace("  : ", " : "), tone: "info" },
        { text: `Derleme             : ${value(sys["os_build"])}`, tone: "default" },
        { text: `Kurulum tarihi      : ${value(sys["install_date"])}`, tone: "default" },
        { text: `Çalışma süresi      : ${value(sys["uptime_human"])}`, tone: "ok", summary: true },
        { text: `Makine adı          : ${value(String(sys["hostname"] ?? ""), "")}`.replace("  : ", " : "), tone: "info" },
        { text: `Mimari              : ${value(String(sys["machine"] ?? ""), "")}`.replace("  : ", " : "), tone: "default" },

        { text: "", tone: "default" },
        { text: "── İŞLEMCİ ──", tone: "head" },
        { text: `Model               : ${String(cpu["model"] ?? "—").slice(0, 52)}`, tone: "info", summary: true },
        { text: `Çekirdek            : ${value(cpu["physical_cores"])} fiziksel / ${value(cpu["logical_cores"])} mantıksal`, tone: "default", summary: true },
        { text: `Frekans             : ${value(cpu["max_frequency_mhz"], " MHz")}`, tone: "default" },
        { text: `Anlık yük           : ${value(cpu["usage_percent"], " %")}`, tone: "ok" },

        { text: "", tone: "default" },
        { text: "── BELLEK ──", tone: "head" },
        { text: `Toplam              : ${value(String(mem["total_human"] ?? ""), "")}`.replace("  : ", " : "), tone: "info", summary: true },
        { text: `Kullanılan          : ${value(String(mem["used_human"] ?? ""), "")} (${value(mem["percent"], "%")})`.replace("  : ", " : "), tone: "ok", summary: true },
        {
          text: `Donanım modülü      : ${
            Array.isArray(mem["modules"]) ? `${(mem["modules"] as unknown[]).length} modül` : "—"
          }`,
          tone: "dim",
        },

        { text: "", tone: "default" },
        { text: "── EKRAN KARTI ──", tone: "head" },
        ...(gpuList.length
          ? gpuList.slice(0, 2).map<ConsoleLine>((gpu) => ({
              text: `GPU                 : ${String(gpu["name"] ?? "?").slice(0, 48)}${gpu["driver"] ? ` · sürücü ${String(gpu["driver"]).slice(0, 16)}` : ""}`,
              tone: "info",
            }))
          : ([{ text: "GPU                 : köprü verisi yok", tone: "dim" }] as ConsoleLine[])),

        { text: "", tone: "default" },
        { text: "── İŞLEMLER & SERVİSLER ──", tone: "head" },
        { text: `Çalışan işlem       : ${value(proc["count"])}`, tone: "default", summary: true },
        {
          text: `En çok RAM          : ${topMem.length ? `${String(topMem[0]?.["name"] ?? "?")} (${topMem[0]?.["rss_human"] ?? "?"})` : "—"}`,
          tone: "default",
          summary: true,
        },
        { text: `Servis sayısı       : ${value(bridgePart(info, "services")["count"])}`, tone: "default" },
        {
          text: `Örnek servisler     : ${joinNames(bridgeList(info, "services"), "name", 3) || "—"}`,
          tone: "dim",
        },

        { text: "", tone: "default" },
        { text: "── KULLANICILAR ──", tone: "head" },
        { text: `Yerel hesap         : ${bridgeList(info, "users").length}`, tone: "default" },
        {
          text: `Hesaplar            : ${joinNames(bridgeList(info, "users"), "name", 5) || "—"}`,
          tone: "dim",
        },
        {
          text: `Açık oturum         : ${Array.isArray(users["logged_in"]) ? (users["logged_in"] as unknown[]).length : 0}`,
          tone: "default",
        },

        { text: "", tone: "default" },
        { text: "── YAZILIM ──", tone: "head" },
        { text: `Kurulu program      : ${value(bridgePart(info, "programs")["count"])}`, tone: "ok", summary: true },
        {
          text: `Örnek programlar    : ${joinNames(bridgeList(info, "programs"), "name", 3) || "—"}`,
          tone: "dim",
        },

        { text: "", tone: "default" },
        { text: "── GÜVENLİK ──", tone: "head" },
        { text: `Güvenlik duvarı     : ${value(String(sec["firewall"] ?? ""), "")}`.replace("  : ", " : "), tone: sec["firewall"] ? "ok" : "dim", summary: true },
        { text: `Antivirüs           : ${antivirus.length ? antivirus.slice(0, 2).join(", ") : "—"}`, tone: antivirus.length ? "ok" : "dim", summary: true },
        { text: `Secure Boot         : ${value(String(sec["secure_boot"] ?? ""), "")}`.replace("  : ", " : "), tone: "dim" },

        { text: "", tone: "default" },
        { text: "── GELİŞTİRİCİ ARAÇLARI ──", tone: "head" },
        ...Object.entries(bridgePart(info, "environment")["tools"] ?? {})
          .filter(([, toolValue]) => Boolean(toolValue))
          .map<ConsoleLine>(([tool, toolValue]) => ({
            text: `${tool.padEnd(20)}: ${String(toolValue).slice(0, 46)}`,
            tone: "default",
          })),
    ];

    sections.push({
      title: "FAZ 7: YEREL KÖPRÜ VERİSİ (Faz 3 · CANLI)",
      lines: bridgeLines,
    });
  } else {
    // Köprü yok — ne beklendiğini açıkça göster (sahte veri ÜRETİLMEZ)
    sections.push({
      title: "FAZ 7: YEREL KÖPRÜ GEREKTİREN ALANLAR (Faz 3)",
      lines: [
        {
          text: "Köprü durumu        : ÇALIŞMIYOR",
          tone: "warn" as const,
          summary: true,
        },
        {
          text: `Sebep               : ${info.bridgeError ?? "bilinmiyor"}`,
          tone: "dim" as const,
        },
        { text: "", tone: "default" as const },
        ...BRIDGE_REQUIRED_FIELDS.map<ConsoleLine>((field) => ({
          text: `⏳ ${field.label.padEnd(20)}: ${field.description}`,
          tone: "dim",
        })),
        { text: "", tone: "default" as const },
        {
          text: "Kurulum:  services/bridge/start-bridge.bat  (Windows)  veya  ./start-bridge.sh",
          tone: "info" as const,
          summary: true,
        },
        {
          text: "Token'ı Ayarlar > Köprü alanına girin. Ayrıntı: services/bridge/README.md",
          tone: "info" as const,
          summary: true,
        },
      ],
    });
  }

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
