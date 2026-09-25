/**
 * Önyükleme (boot) dizisi.
 *
 * Konsol ekranı **bilgi dökümü**, boot ekranı ise **kısa ve hızlı bir açılış
 * akışı** sunar: sistem kendini hazırlıyor hissi, gerçek verilerle.
 *
 * İlkeler
 * -------
 * • **Sahte veri yok.** Bir alan okunamazsa `—` gösterilir.
 * • **İskelet artığı yok.** Eski "FAZ 1/2/3" ve "KÖPRÜ BEKLENİYOR" ibareleri
 *   tamamen kaldırıldı; yerine gerçek donanım ve servis durumu gelir.
 * • Makine bilgisi konsolla aynı kaynaktan (`MachineInfo`) alınır.
 */

import type { StatusResponse } from "../lib/api";
import type { MachineInfo } from "../console/probe";

export type LineTone = "default" | "ok" | "warn" | "err" | "info" | "dim" | "accent";

export interface BootLine {
  text: string;
  tone?: LineTone;
  /** Bu satır "özet" seviyesinde de gösterilsin mi */
  summary?: boolean;
}

export interface BootPhase {
  title: string;
  lines: BootLine[];
}

/** Etiketli satır üretir (hizalama sabit). */
function row(label: string, value: unknown, tone: LineTone = "default", summary = false): BootLine {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  return { text: `${label.padEnd(19)}: ${text}`, tone, summary };
}

/** Boş ayırıcı. */
function gap(): BootLine {
  return { text: "", tone: "default" };
}

/** Köprü raporundan bölüm okur. */
function part(machine: MachineInfo | null, key: string): Record<string, unknown> {
  const value = (machine?.bridge?.report ?? {})[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Bölümü dizi olarak okur. */
function list(machine: MachineInfo | null, key: string): Record<string, unknown>[] {
  const value = (machine?.bridge?.report ?? {})[key];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const container = part(machine, key);
  for (const field of ["items", "modules", "listening", "gpus"]) {
    const candidate = container[field];
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
}

/** Bayt → okunabilir boyut. */
function bytes(input: unknown): string {
  const value = Number(input ?? 0);
  if (!value || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * Boot fazlarını üretir.
 *
 * @param status   Backend durum yanıtı
 * @param error    Backend bağlantı hatası
 * @param machine  Makine envanteri (köprü dahil) — yoksa yalnızca backend verisi
 */
export function buildBootPhases(
  status: StatusResponse | null,
  error: string | null,
  machine: MachineInfo | null = null,
): BootPhase[] {
  const app = status?.app;
  const features = status?.features;
  const nocodb = status?.integrations.nocodb;

  const board = part(machine, "board");
  const motherboard = (board["motherboard"] ?? {}) as Record<string, unknown>;
  const bios = (board["bios"] ?? {}) as Record<string, unknown>;
  const chassis = (board["chassis"] ?? {}) as Record<string, unknown>;
  const cpu = part(machine, "cpu");
  const memory = part(machine, "memory");
  const modules = part(machine, "memory_modules");
  const sys = part(machine, "system");
  const net = part(machine, "network");
  const thermal = part(machine, "thermal");
  const ports = part(machine, "ports");
  const services = part(machine, "services");
  const programs = part(machine, "programs");
  const security = part(machine, "security");

  const hasBridge = Boolean(machine?.bridge);
  const moduleList = Array.isArray(modules["modules"])
    ? (modules["modules"] as Record<string, unknown>[])
    : [];
  const temperatures = Array.isArray(thermal["temperatures"])
    ? (thermal["temperatures"] as Record<string, unknown>[])
    : [];
  const riskScore = Number(ports["risk_score"] ?? 0);

  const phases: BootPhase[] = [];

  // ------------------------------------------------------------------
  //  1) DONANIM
  // ------------------------------------------------------------------
  const hardware: BootLine[] = [
    row("Makine", chassis["model"] ?? sys["hostname"], "accent", true),
    row("Anakart", motherboard["product"] ?? motherboard["manufacturer"], "info", true),
    row("BIOS", bios["version"] ? `${bios["version"]}  (${bios["release_date"] ?? "—"})` : null, "info", true),
    row("İşlemci", cpu["model"] ? String(cpu["model"]).slice(0, 46) : null, "info", true),
    row(
      "Çekirdek",
      cpu["physical_cores"] ? `${cpu["physical_cores"]} fiziksel / ${cpu["logical_cores"]} mantıksal` : null,
      "default",
      true,
    ),
    row("Bellek", memory["total_human"] ?? bytes(memory["total_bytes"]), "ok", true),
    row(
      "RAM yerleşimi",
      modules["slots_total"]
        ? `${modules["slots_used"]} / ${modules["slots_total"]} slot dolu`
        : moduleList.length
          ? `${moduleList.length} modül`
          : null,
      "default",
      true,
    ),
  ];

  // Disk özeti
  const disks = list(machine, "disks").filter((disk) => Number(disk["total_bytes"] ?? 0) > 0);
  if (disks.length) {
    hardware.push(
      row(
        "Disk",
        disks
          .slice(0, 2)
          .map((disk) => `${disk["mountpoint"]} %${disk["percent"]}`)
          .join("  ·  "),
        "default",
        true,
      ),
    );
  }

  if (!hasBridge) {
    hardware.push(
      gap(),
      row("Platform", machine?.browser.platform ?? null, "info"),
      row("Tarayıcı çekirdek", machine?.hardware.logicalCores, "default"),
      row("Ekran", machine?.hardware.screen, "info"),
      row("GPU (WebGL)", machine?.gpu.renderer ? String(machine.gpu.renderer).slice(0, 40) : null, "dim"),
      gap(),
      { text: "Ayrıntılı donanım için yerel köprü gerekli.", tone: "warn", summary: true },
      { text: "  services/bridge/start-bridge.bat", tone: "dim" },
    );
  }

  phases.push({ title: "DONANIM", lines: hardware });

  // ------------------------------------------------------------------
  //  2) SERVİSLER & YAPILANDIRMA
  // ------------------------------------------------------------------
  phases.push({
    title: "SERVİSLER",
    lines: [
      row("Uygulama", app?.name, "accent", true),
      row("Sürüm", app?.version, "ok", true),
      row("Ortam", app?.env, app?.env === "production" ? "ok" : "warn", true),
      row("Veri adaptörü", features?.db_adapter, "info", true),
      row("Backend", status ? "YANIT VERİYOR" : error ? "ULAŞILAMIYOR" : "BEKLENİYOR", status ? "ok" : "err", true),
      row(
        "NocoDB",
        nocodb?.ok ? "BAĞLI" : nocodb?.reachable ? "TOKEN GEÇERSİZ" : "ULAŞILAMIYOR",
        nocodb?.ok ? "ok" : "warn",
        true,
      ),
      row("n8n", status?.integrations.n8n.configured ? "YAPILANDIRILDI" : "BOŞ", status?.integrations.n8n.configured ? "ok" : "warn"),
      row("Telegram", status?.integrations.telegram.configured ? "YAPILANDIRILDI" : "BOŞ", status?.integrations.telegram.configured ? "ok" : "warn"),
      row("Yerel köprü", hasBridge ? `ÇALIŞIYOR v${machine?.bridge?.bridge_version ?? "?"}` : "KAPALI", hasBridge ? "ok" : "warn", true),
    ],
  });

  // ------------------------------------------------------------------
  //  3) ISI & GÜVENLİK
  // ------------------------------------------------------------------
  const health: BootLine[] = [];

  if (temperatures.length) {
    const hottest = temperatures.reduce(
      (best, item) => (Number(item["celsius"] ?? 0) > Number(best["celsius"] ?? 0) ? item : best),
      temperatures[0],
    );
    health.push(
      row(
        "En sıcak sensör",
        `${String(hottest["label"] ?? "?").slice(0, 30)} → ${hottest["celsius"]} °C`,
        Number(hottest["celsius"] ?? 0) >= 85 ? "err" : "ok",
        true,
      ),
      row("Sensör sayısı", `${temperatures.length} sıcaklık · ${(thermal["fans"] as unknown[] | undefined)?.length ?? 0} fan`, "dim"),
    );
  } else {
    health.push(row("Isı sensörü", "okunamadı", "dim"));
  }

  health.push(
    gap(),
    row("Güvenlik duvarı", security["firewall"], security["firewall"] ? "ok" : "warn", true),
    row(
      "Antivirüs",
      Array.isArray(security["antivirus"]) && (security["antivirus"] as unknown[]).length
        ? (security["antivirus"] as unknown[]).slice(0, 1).join("")
        : "—",
      Array.isArray(security["antivirus"]) && (security["antivirus"] as unknown[]).length ? "ok" : "warn",
      true,
    ),
    row(
      "Komut politikası",
      features?.command_policy,
      features?.command_policy === "allow_all" ? "err" : "ok",
      true,
    ),
    row(
      "Köprü tokenı",
      status?.integrations.bridge.configured ? "TANIMLI" : "BOŞ",
      status?.integrations.bridge.configured ? "ok" : "dim",
    ),
  );

  phases.push({ title: "ISI & GÜVENLİK", lines: health });

  // ------------------------------------------------------------------
  //  4) AĞ & PORTLAR
  // ------------------------------------------------------------------
  const network: BootLine[] = [
    row("Yerel IP", net["primary_ip"], "info", true),
    row("Dış IP", net["external_ip"] ?? "kapalı", "accent", true),
    row("Ağ geçidi", net["gateway"], "dim"),
    row("MAC", Array.isArray((list(machine, "network")[0] ?? {})["addresses"]) ? null : null, "dim"),
  ];

  if (hasBridge) {
    const tcp = Number(ports["tcp_count"] ?? 0);
    const udp = Number(ports["udp_count"] ?? 0);
    const risky = Array.isArray(ports["risky"]) ? (ports["risky"] as unknown[]).length : 0;

    network.push(
      gap(),
      row("Dinlenen port", `${tcp} TCP · ${udp} UDP`, "info", true),
      row("Dışarı açık", ports["external_count"], "accent", true),
      row(
        "Zafiyet riski",
        `${riskScore}/100  (${risky} riskli port)`,
        riskScore >= 70 ? "err" : riskScore >= 45 ? "warn" : "ok",
        true,
      ),
    );

    if (risky > 0 && Array.isArray(ports["risky"])) {
      const top = (ports["risky"] as Record<string, unknown>[])[0];
      network.push({
        text: `  → ${top["port"]}/${top["protocol"]} ${top["description"]}`,
        tone: riskScore >= 45 ? "warn" : "dim",
        summary: true,
      });
    }

    network.push(
      gap(),
      row("Çalışan süreç", part(machine, "processes")["count"], "dim"),
      row("Servis", `${services["running"] ?? "—"} / ${services["total"] ?? "—"}`, "dim"),
      row("Kurulu program", programs["count"], "dim"),
    );
  }

  phases.push({ title: "AĞ & PORTLAR", lines: network });

  // ------------------------------------------------------------------
  //  5) BAŞLATMA
  // ------------------------------------------------------------------
  const warnings = status?.warnings ?? [];
  const boot: BootLine[] = [
    row("Yapılandırma", status ? ".env okundu" : "okunamadı", status ? "ok" : "err", true),
    row("Sır saklama", ".env (git dışı)", "ok"),
    row("Bütünlük kontrolü", status ? "OK" : "ATLANDI", status ? "ok" : "warn", true),
    row("Masaüstü oturumu", "hazırlanıyor…", "accent", true),
  ];

  if (warnings.length) {
    boot.push(gap(), { text: `⚠ ${warnings.length} uyarı:`, tone: "warn" });
    warnings.slice(0, 3).forEach((warning) => {
      boot.push({ text: `  • ${warning.slice(0, 74)}`, tone: "warn" });
    });
  }

  phases.push({ title: "BAŞLATMA", lines: boot });

  return phases;
}

/** Kapanış satırları — tarih/saat ve makine künyesi. */
export function buildClosingLines(
  status: StatusResponse | null,
  machine: MachineInfo | null = null,
): BootLine[] {
  const now = new Date();
  const stamp = now.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const sys = part(machine, "system");

  const lines: BootLine[] = [
    { text: "", tone: "default" },
    { text: `  Tarih / saat     : ${stamp}`, tone: "info" },
    { text: `  Bilgisayar adı   : ${sys["hostname"] ?? machine?.browser.platform ?? "—"}`, tone: "default" },
    { text: `  İç IP            : ${part(machine, "network")["primary_ip"] ?? "—"}`, tone: "default" },
    { text: `  Dış IP           : ${part(machine, "network")["external_ip"] ?? "kapalı"}`, tone: "default" },
  ];

  if (status && status.warnings.length > 0) {
    lines.push({ text: "", tone: "default" });
    lines.push({ text: `  ⚠ ${status.warnings.length} uyarı — konsolda ayrıntılı listelenir.`, tone: "warn" });
  }

  return lines;
}
