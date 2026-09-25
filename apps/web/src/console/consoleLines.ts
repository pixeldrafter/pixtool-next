/**
 * Konsol rapor satırları.
 *
 * `MachineInfo`'yu terminal satırlarına çevirir. **Sahte veri üretilmez**:
 * bir alan okunamazsa `—` gösterilir ve nedeni yazılır.
 *
 * Bölüm başlıkları düz Türkçedir (eski "FAZ 1/2/3" iskelet artıkları kaldırıldı).
 */

import type { MachineInfo } from "./probe";

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

// ----------------------------------------------------------------------
//  Biçimlendirme yardımcıları
// ----------------------------------------------------------------------

/** Değeri gösterilebilir metne çevirir (boş → —). */
function val(input: unknown, suffix = ""): string {
  if (input === null || input === undefined || input === "" || input === 0) return "—";
  return `${input}${suffix}`;
}

function yesNo(condition: boolean | null | undefined, yes = "EVET", no = "HAYIR"): string {
  if (condition === null || condition === undefined) return "—";
  return condition ? yes : no;
}

/** `etiket : değer` satırı üretir (hizalama sabit). */
function row(label: string, value: unknown, tone: ConsoleTone = "default", summary = false): ConsoleLine {
  return { text: `${label.padEnd(20)}: ${val(value)}`, tone, summary };
}

/** Bayt → okunabilir boyut. */
function bytes(input: number | null | undefined): string {
  if (!input || input <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = input;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Boş ayırıcı satır. */
function gap(): ConsoleLine {
  return { text: "", tone: "default" };
}

/** Alt başlık satırı. */
function sub(title: string): ConsoleLine {
  return { text: `── ${title} ${"─".repeat(Math.max(0, 44 - title.length))}`, tone: "head" };
}

// ----------------------------------------------------------------------
//  Köprü verisi okuma
// ----------------------------------------------------------------------

/** Köprü verisi geldi mi? */
function hasBridge(info: MachineInfo): boolean {
  return Boolean(info.bridge?.report && Object.keys(info.bridge.report).length > 0);
}

/** Köprü raporundan nesne bölümü okur. */
function part(info: MachineInfo, key: string): Record<string, unknown> {
  const value = (info.bridge?.report ?? {})[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Köprü raporundan dizi bölümü okur (dizi veya `{items:[...]}`). */
function list(info: MachineInfo, key: string): Record<string, unknown>[] {
  const value = (info.bridge?.report ?? {})[key];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const container = part(info, key);
  for (const field of ["items", "modules", "listening", "risky", "gpu_cards"]) {
    const candidate = container[field];
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
}

/** İlk N öğenin belirtilen alanını birleştirir. */
function joinNames(items: Record<string, unknown>[], key: string, limit = 4, sep = " · "): string {
  const names = items
    .slice(0, limit)
    .map((item) => String(item[key] ?? "").trim())
    .filter(Boolean);
  return names.length ? names.join(sep) : "—";
}

// ======================================================================
//  BÖLÜMLER
// ======================================================================

/** Sistem kimliği + anakart + BIOS. */
function sectionIdentity(info: MachineInfo): ConsoleSection {
  const board = part(info, "board");
  const sys = part(info, "system");
  const motherboard = (board["motherboard"] ?? {}) as Record<string, unknown>;
  const bios = (board["bios"] ?? {}) as Record<string, unknown>;
  const chassis = (board["chassis"] ?? {}) as Record<string, unknown>;

  const lines: ConsoleLine[] = [
    row("Makine adı", chassis["model"] ?? sys["hostname"]),
    row("Üretici", chassis["vendor"] ?? motherboard["manufacturer"], "info", true),
    row("Model", chassis["model"], "info", true),
    row("Seri numarası", chassis["serial"]),
    row("UUID", chassis["uuid"]),
    gap(),
    sub("ANAKART"),
    row("Üretici", motherboard["manufacturer"], "info"),
    row("Ürün", motherboard["product"], "info", true),
    row("Sürüm", motherboard["version"]),
    row("Seri numarası", motherboard["serial"]),
    row("Etiket", motherboard["tag"]),
    gap(),
    sub("BIOS / UEFI"),
    row("Üretici", bios["vendor"], "info"),
    row("Sürüm", bios["version"], "accent", true),
    row("Yayın tarihi", bios["release_date"], "accent", true),
    row(
      "Yaş",
      bios["age_days"] !== null && bios["age_days"] !== undefined
        ? `${bios["age_days"]} gün (${Math.round(Number(bios["age_days"]) / 30)} ay)`
        : null,
      Number(bios["age_days"] ?? 0) > 730 ? "warn" : "ok",
      true,
    ),
    row("SMBIOS", bios["smbios_version"]),
  ];

  // BIOS güncelleme kontrolü
  const check = (info.bridge?.report?.["bios_check"] ?? {}) as Record<string, unknown>;
  if (check && Object.keys(check).length) {
    lines.push(gap(), sub("BIOS GÜNCELLEME KONTROLÜ"));
    lines.push(row("Üretici", check["vendor"], "info"));
    lines.push(row("Model kimliği", check["model"]));
    lines.push(row("Kurulu sürüm", check["current_version"], "accent"));
    lines.push(row("Kurulu tarih", check["current_date"]));
    if (check["latest_version"]) {
      lines.push(row("Sitedeki sürüm", check["latest_version"], "accent"));
      lines.push(
        row(
          "Durum",
          check["update_available"] ? "YENİ SÜRÜM VAR" : "GÜNCEL",
          check["update_available"] ? "warn" : "ok",
          true,
        ),
      );
    } else {
      lines.push(row("Durum", check["blocked"] ? "otomatik sorgu engellendi" : "sorgulanamadı", "dim", true));
    }
    if (check["support_url"]) {
      lines.push({ text: `Destek sayfası      : ${check["support_url"]}`, tone: "info" });
    }
    if (check["note"]) {
      lines.push({ text: `${check["note"]}`, tone: "dim" });
    }
  }

  return { title: "SİSTEM KİMLİĞİ & ANAKART", lines };
}

/** İşlemci. */
function sectionCpu(info: MachineInfo): ConsoleSection {
  const cpu = part(info, "cpu");
  const lines: ConsoleLine[] = [
    row("Model", String(cpu["model"] ?? info.gpu.vendor ?? "—").slice(0, 56), "info", true),
    row(
      "Çekirdek",
      cpu["physical_cores"]
        ? `${cpu["physical_cores"]} fiziksel / ${cpu["logical_cores"]} mantıksal`
        : val(cpu["logical_cores"], " mantıksal"),
      "default",
      true,
    ),
    row("Maks. frekans", cpu["max_frequency_mhz"], "default"),
    row("Anlık frekans", cpu["current_frequency_mhz"]),
    row(
      "Kullanım",
      cpu["usage_percent"] !== null && cpu["usage_percent"] !== undefined
        ? `%${Number(cpu["usage_percent"]).toFixed(1)}`
        : null,
      "accent",
      true,
    ),
  ];

  const perCore = cpu["per_core_percent"];
  if (Array.isArray(perCore) && perCore.length) {
    lines.push(
      row(
        "Çekirdek yükü",
        perCore
          .slice(0, 8)
          .map((value) => `%${Number(value).toFixed(0)}`)
          .join(" "),
        "dim",
      ),
    );
  }

  const load = cpu["load_average"];
  if (Array.isArray(load) && load.length) {
    lines.push(row("Yük ortalaması", load.slice(0, 3).join("  ")));
  }

  // Sıcaklık varsa burada da göster
  const thermal = part(info, "thermal");
  const byLabel = Array.isArray(thermal["temperatures"])
    ? (thermal["temperatures"] as Record<string, unknown>[])
    : [];
  const cpuTemp = byLabel.find((item) => /cpu|package|core|tctl|tdie/i.test(String(item["label"] ?? "")));
  if (cpuTemp) {
    lines.push(row("Sıcaklık", `${cpuTemp["celsius"]} °C`, "accent", true));
  }

  return { title: "İŞLEMCİ", lines };
}

/** Bellek ve slotlar. */
function sectionMemory(info: MachineInfo): ConsoleSection {
  const memory = part(info, "memory");
  const modules = part(info, "memory_modules");
  const slots = Array.isArray(modules["modules"]) ? (modules["modules"] as Record<string, unknown>[]) : [];

  const totalRam = Number(memory["total_bytes"] ?? 0);
  const usedRam = Number(memory["used_bytes"] ?? 0);

  const lines: ConsoleLine[] = [
    row("Toplam bellek", totalRam ? bytes(totalRam) : memory["total_human"], "info", true),
    row(
      "Kullanılan",
      usedRam
        ? `${bytes(usedRam)}  (%${Number(memory["percent"] ?? 0).toFixed(1)})`
        : memory["used_human"],
      "accent",
      true,
    ),
    row("Kullanılabilir", memory["available_human"] ?? (memory["available_bytes"] ? bytes(Number(memory["available_bytes"])) : null)),
    row(
      "Takas (swap)",
      memory["swap_total_bytes"] && Number(memory["swap_total_bytes"]) > 0
        ? `${bytes(Number(memory["swap_used_bytes"]))} / ${bytes(Number(memory["swap_total_bytes"]))}`
        : "yok",
    ),
    gap(),
    sub("SLOT YERLEŞİMİ"),
    row(
      "Slot sayısı",
      modules["slots_total"] !== null && modules["slots_total"] !== undefined
        ? `${modules["slots_used"] ?? slots.length} dolu / ${modules["slots_total"]} toplam`
        : `${slots.length} dolu`,
      "accent",
      true,
    ),
    row(
      "Maks. kapasite",
      modules["max_capacity_gb"] ? `${modules["max_capacity_gb"]} GB` : null,
      "default",
      true,
    ),
  ];

  if (slots.length) {
    lines.push(gap());
    slots.forEach((module, index) => {
      const slot = String(module["slot"] ?? `Slot ${index + 1}`);
      const bank = module["bank"] ? ` (${module["bank"]})` : "";
      const size = module["size_gb"] ? `${module["size_gb"]} GB` : bytes(Number(module["size_bytes"] ?? 0));
      const type = module["memory_type"] ?? "";
      const speed = module["speed_mhz"] ? `${module["speed_mhz"]} MHz` : "";
      const rated =
        module["rated_speed_mhz"] && module["speed_mhz"] && module["rated_speed_mhz"] !== module["speed_mhz"]
          ? ` (nominal ${module["rated_speed_mhz"]})`
          : "";

      lines.push({
        text: `  ${slot}${bank}`.padEnd(22) + `${size} ${type} ${speed}${rated}`.trim(),
        tone: "ok",
        summary: index < 4,
      });
      const extra: string[] = [];
      if (module["manufacturer"]) extra.push(String(module["manufacturer"]));
      if (module["part_number"]) extra.push(`parça ${module["part_number"]}`);
      if (module["form_factor"]) extra.push(String(module["form_factor"]));
      if (module["voltage_mv"]) extra.push(`${(Number(module["voltage_mv"]) / 1000).toFixed(2)} V`);
      if (extra.length) {
        lines.push({ text: `  ${" ".repeat(18)}${extra.join(" · ")}`, tone: "dim" });
      }
    });
  }

  const notes = modules["notes"];
  if (Array.isArray(notes) && notes.length) {
    lines.push(gap());
    notes.forEach((note) => lines.push({ text: String(note), tone: "dim" }));
  }

  return { title: "BELLEK (RAM)", lines };
}

/** Diskler. */
function sectionStorage(info: MachineInfo): ConsoleSection {
  const disks = list(info, "disks");

  const lines: ConsoleLine[] = [];

  if (disks.length) {
    disks
      .filter((disk) => Number(disk["total_bytes"] ?? 0) > 0)
      .forEach((disk) => {
        const mount = String(disk["mountpoint"] ?? disk["device"] ?? "?");
        const percent = Number(disk["percent"] ?? 0);
        const tone: ConsoleTone = percent >= 90 ? "err" : percent >= 75 ? "warn" : "ok";

        lines.push({
          text:
            `  ${mount}`.padEnd(16) +
            `${String(disk["used_human"] ?? bytes(Number(disk["used_bytes"] ?? 0)))} / ` +
            `${String(disk["total_human"] ?? bytes(Number(disk["total_bytes"] ?? 0)))}`.padEnd(20) +
            `%${percent.toFixed(0).padStart(3)}  ${String(disk["free_human"] ?? bytes(Number(disk["free_bytes"] ?? 0)))} boş`,
          tone,
          summary: true,
        });
        const meta: string[] = [];
        if (disk["filesystem"]) meta.push(String(disk["filesystem"]));
        if (disk["device"]) meta.push(String(disk["device"]));
        if (disk["is_removable"]) meta.push("çıkarılabilir");
        if (meta.length) lines.push({ text: `  ${" ".repeat(14)}${meta.join(" · ")}`, tone: "dim" });
      });
  } else {
    lines.push(row("Disk bilgisi", "köprü verisi gerekli", "dim"));
  }

  lines.push(gap(), sub("TARAYICI DEPOLAMA"));
  lines.push(row("Kota", info.storage.quotaMb, "default"));
  lines.push(row("Kullanılan", `${val(info.storage.usageMb, " MB")}  (%${val(info.storage.usagePercent)})`));
  lines.push(row("Yerel kayıt", val(info.storage.localStorageItems, " öge")));

  return { title: "DEPOLAMA", lines };
}

/** Ekran kartı. */
function sectionGpu(info: MachineInfo): ConsoleSection {
  const thermal = part(info, "thermal");
  const cards = Array.isArray(thermal["gpu_cards"])
    ? (thermal["gpu_cards"] as Record<string, unknown>[])
    : [];
  const gpus = list(info, "gpu");

  const lines: ConsoleLine[] = [];

  if (cards.length) {
    cards.forEach((card) => {
      lines.push({
        text: `  ${String(card["name"] ?? "?")}`,
        tone: "info",
        summary: true,
      });
      lines.push(row("    Sürücü", card["driver"]));
      lines.push(
        row(
          "    Sıcaklık",
          card["temperature_c"] !== null && card["temperature_c"] !== undefined
            ? `${card["temperature_c"]} °C`
            : null,
          "accent",
          true,
        ),
      );
      lines.push(
        row(
          "    Fan",
          card["fan_percent"] !== null && card["fan_percent"] !== undefined
            ? `%${card["fan_percent"]}`
            : null,
        ),
      );
      lines.push(
        row(
          "    Güç",
          card["power_w"] !== null && card["power_w"] !== undefined
            ? `${Number(card["power_w"]).toFixed(1)} W / ${Number(card["power_limit_w"] ?? 0).toFixed(0)} W`
            : null,
          "accent",
          true,
        ),
      );
      lines.push(
        row(
          "    Kullanım",
          card["utilization_percent"] !== null && card["utilization_percent"] !== undefined
            ? `GPU %${Number(card["utilization_percent"]).toFixed(0)} · VRAM %${Number(card["memory_utilization_percent"] ?? 0).toFixed(0)}`
            : null,
        ),
      );
      lines.push(
        row(
          "    VRAM",
          card["memory_used_mb"] !== null && card["memory_used_mb"] !== undefined
            ? `${Math.round(Number(card["memory_used_mb"]))} / ${Math.round(Number(card["memory_total_mb"] ?? 0))} MB`
            : null,
        ),
      );
      lines.push(
        row(
          "    Saat hızı",
          card["clock_graphics_mhz"] !== null && card["clock_graphics_mhz"] !== undefined
            ? `${Math.round(Number(card["clock_graphics_mhz"]))} / ${Math.round(Number(card["clock_max_graphics_mhz"] ?? 0))} MHz`
            : null,
        ),
      );
      lines.push(gap());
    });
  } else if (gpus.length) {
    gpus.forEach((gpu) => {
      lines.push({
        text: `  ${String(gpu["name"] ?? "?")}${gpu["memory_total_mb"] ? ` · ${gpu["memory_total_mb"]} MB` : ""}`,
        tone: "info",
        summary: true,
      });
    });
  } else {
    lines.push(row("GPU", "köprü verisi gerekli", "dim"));
    lines.push(row("WebGL üreticisi", info.gpu.vendor));
    lines.push(row("WebGL modeli", info.gpu.renderer));
  }

  lines.push(gap(), sub("TARAYICI GRAFİK KATMANI"));
  lines.push(row("Çözünürlük", info.hardware.screen, "info", true));
  lines.push(row("Piksel oranı", val(info.hardware.pixelRatio, "×")));
  lines.push(row("Renk derinliği", val(info.hardware.colorDepth, " bit")));
  lines.push(row("WebGPU", yesNo(info.gpu.webgpu, "DESTEKLİ", "yok"), info.gpu.webgpu ? "ok" : "dim"));

  return { title: "EKRAN KARTI & GRAFİK", lines };
}

/** Isı ve fanlar. */
function sectionThermal(info: MachineInfo): ConsoleSection {
  const thermal = part(info, "thermal");
  const temperatures = Array.isArray(thermal["temperatures"])
    ? (thermal["temperatures"] as Record<string, unknown>[])
    : [];
  const fans = Array.isArray(thermal["fans"]) ? (thermal["fans"] as Record<string, unknown>[]) : [];

  const lines: ConsoleLine[] = [
    row("Kaynak", thermal["source"], "info", true),
    row("Ölçüm sayısı", `${temperatures.length} sıcaklık · ${fans.length} fan`),
  ];

  if (temperatures.length) {
    lines.push(
      row(
        "En sıcak",
        `${thermal["hottest"] ? (thermal["hottest"] as Record<string, unknown>)["label"] : "?"} → ${thermal["hottest"] ? (thermal["hottest"] as Record<string, unknown>)["celsius"] : "?"} °C`,
        Number((thermal["hottest"] as Record<string, unknown> | undefined)?.["celsius"] ?? 0) >= 85 ? "err" : "ok",
        true,
      ),
    );
    lines.push(row("Ortalama", thermal["average_celsius"] !== undefined ? `${thermal["average_celsius"]} °C` : null));

    lines.push(gap());
    temperatures.slice(0, 16).forEach((sensor) => {
      const celsius = Number(sensor["celsius"] ?? 0);
      const tone: ConsoleTone = celsius >= 90 ? "err" : celsius >= 75 ? "warn" : "ok";
      lines.push({
        text:
          `  ${String(sensor["label"] ?? "?").slice(0, 40).padEnd(42)}` +
          `${celsius.toFixed(1).padStart(6)} °C   ${String(sensor["source"] ?? "")}`,
        tone,
      });
    });
  }

  if (fans.length) {
    lines.push(gap(), sub("FANLAR"));
    fans.slice(0, 10).forEach((fan) => {
      const value = fan["rpm"] ?? (fan["percent"] !== undefined ? `%${fan["percent"]}` : "—");
      lines.push({
        text: `  ${String(fan["label"] ?? "?").slice(0, 40).padEnd(42)}${String(value).padStart(8)}   ${String(fan["source"] ?? "")}`,
        tone: "info",
      });
    });
  }

  if (!temperatures.length && !fans.length) {
    lines.push(gap());
    lines.push({ text: "  Isı sensörü bulunamadı.", tone: "warn", summary: true });
    const notes = thermal["notes"];
    if (Array.isArray(notes)) {
      notes.forEach((note) => lines.push({ text: `  ${note}`, tone: "dim" }));
    }
    lines.push({ text: "  Kurulum: services/bridge/setup-sensors.ps1", tone: "info", summary: true });
  } else if (Array.isArray(thermal["notes"])) {
    (thermal["notes"] as unknown[]).forEach((note) =>
      lines.push({ text: `  ${note}`, tone: "dim" }),
    );
  }

  return { title: "ISI & FAN", lines };
}

/** Port taraması ve zafiyet değerlendirmesi. */
function sectionPorts(info: MachineInfo): ConsoleSection {
  const ports = part(info, "ports");
  const listening = Array.isArray(ports["listening"])
    ? (ports["listening"] as Record<string, unknown>[])
    : [];
  const risky = Array.isArray(ports["risky"]) ? (ports["risky"] as Record<string, unknown>[]) : [];

  const score = Number(ports["risk_score"] ?? 0);
  const scoreTone: ConsoleTone = score >= 70 ? "err" : score >= 45 ? "warn" : score >= 20 ? "info" : "ok";

  const lines: ConsoleLine[] = [
    row("Dinlenen port", `${ports["tcp_count"] ?? 0} TCP · ${ports["udp_count"] ?? 0} UDP`, "info", true),
    row("Dışarı açık", val(ports["external_count"]), "accent", true),
    row(
      "Risk puanı",
      `${score}/100`,
      scoreTone,
      true,
    ),
  ];

  if (risky.length) {
    lines.push(gap(), sub("RİSKLİ PORTLAR"));
    risky.forEach((item) => {
      const tone: ConsoleTone =
        item["severity"] === "Kritik" ? "err" : item["severity"] === "Yüksek" ? "err" : item["severity"] === "Orta" ? "warn" : "dim";
      lines.push({
        text:
          `  ${String(item["port"]).padStart(5)}/${String(item["protocol"]).toUpperCase().padEnd(4)}` +
          `${String(item["severity"]).padEnd(8)}${String(item["description"] ?? "")}`,
        tone,
        summary: true,
      });
      lines.push({
        text: `  ${" ".repeat(15)}${item["external"] ? "DIŞARI AÇIK" : "yalnızca yerel"} · ${item["process"] ?? "?"}`,
        tone: "dim",
      });
    });
  } else if (listening.length) {
    lines.push(gap());
    lines.push({ text: "  Riskli port bulunamadı.", tone: "ok", summary: true });
  }

  if (listening.length) {
    lines.push(gap(), sub("DİNLENEN PORTLAR"));
    listening.slice(0, 24).forEach((item) => {
      lines.push({
        text:
          `  ${String(item["port"]).padStart(5)}/${String(item["protocol"]).toUpperCase().padEnd(4)}` +
          `${String(item["address"] ?? "").padEnd(16)}${String(item["process"] ?? "?").slice(0, 26)}`,
        tone: item["external"] ? "info" : "dim",
      });
    });
    if (listening.length > 24) {
      lines.push({ text: `  … +${listening.length - 24} port daha`, tone: "dim" });
    }
  }

  const notes = ports["notes"];
  if (Array.isArray(notes) && notes.length) {
    lines.push(gap());
    notes.forEach((note) => lines.push({ text: `  ${note}`, tone: "dim" }));
  }

  return { title: "PORT TARAMASI & ZAFİYET", lines };
}

/** İşletim sistemi, ağ, güvenlik, süreçler, kullanıcılar, yazılım. */
function sectionSystem(info: MachineInfo): ConsoleSection {
  const sys = part(info, "system");
  const net = part(info, "network");
  const sec = part(info, "security");
  const proc = part(info, "processes");
  const users = part(info, "users");
  const services = part(info, "services");
  const programs = part(info, "programs");

  const interfaces = Array.isArray(net["interfaces"]) ? (net["interfaces"] as Record<string, unknown>[]) : [];
  const topByMemory = Array.isArray(proc["top_memory"]) ? (proc["top_memory"] as Record<string, unknown>[]) : [];
  const topByCpu = Array.isArray(proc["top_cpu"]) ? (proc["top_cpu"] as Record<string, unknown>[]) : [];
  const loggedIn = Array.isArray(users["logged_in"]) ? (users["logged_in"] as Record<string, unknown>[]) : [];
  const serviceItems = Array.isArray(services["items"]) ? (services["items"] as Record<string, unknown>[]) : [];
  const programItems = Array.isArray(programs["items"]) ? (programs["items"] as Record<string, unknown>[]) : [];
  const antivirus = Array.isArray(sec["antivirus"]) ? (sec["antivirus"] as unknown[]) : [];

  const lines: ConsoleLine[] = [
    sub("İŞLETİM SİSTEMİ"),
    row("Sürüm", sys["os_name"], "info", true),
    row("Derleme", sys["os_build"]),
    row("Mimari", sys["machine"]),
    row("Kurulum tarihi", sys["install_date"]),
    row("Çalışma süresi", sys["uptime_human"] ?? sys["uptime"], "accent", true),
    row("Makine adı", sys["hostname"]),
    row("Kullanıcı", sys["user"]),
    gap(),
    sub("AĞ"),
    row("Yerel IP", net["primary_ip"], "info", true),
    row("Dış IP", net["external_ip"] ?? "kapalı", "accent", true),
    row("Ağ geçidi", net["gateway"]),
    row("DNS", Array.isArray(net["dns"]) ? (net["dns"] as unknown[]).slice(0, 3).join(", ") : null),
    row("Gönderilen", net["sent"] ?? bytes(Number(net["bytes_sent"] ?? 0))),
    row("Alınan", net["received"] ?? bytes(Number(net["bytes_recv"] ?? 0))),
    row("Tarayıcı bağlantısı", info.network.effectiveType, "info"),
  ];

  if (interfaces.length) {
    lines.push(gap());
    interfaces.slice(0, 5).forEach((iface) => {
      const addresses = Array.isArray(iface["addresses"]) ? (iface["addresses"] as Record<string, unknown>[]) : [];
      const ipv4 = addresses.find((item) => item["kind"] === "ipv4");
      const mac = addresses.find((item) => item["kind"] === "mac");
      lines.push({
        text:
          `  ${String(iface["name"] ?? "?").padEnd(22)}` +
          `${String(iface["is_up"] ? "AKTİF" : "kapalı").padEnd(7)}` +
          `${ipv4 ? String(ipv4["address"]) : "—"}`,
        tone: iface["is_up"] ? "ok" : "dim",
      });
      if (mac) {
        lines.push({ text: `  ${" ".repeat(20)}MAC ${String(mac["address"])}`, tone: "dim" });
      }
    });
  }

  lines.push(
    gap(),
    sub("SÜREÇLER & SERVİSLER"),
    row("Çalışan süreç", proc["count"], "info", true),
    row("Servis", `${services["running"] ?? "—"} çalışıyor / ${services["total"] ?? "—"} toplam`),
  );

  if (topByMemory.length) {
    lines.push({ text: "  En çok RAM kullananlar:", tone: "dim" });
    topByMemory.slice(0, 4).forEach((item) => {
      lines.push({
        text: `    ${String(item["name"] ?? "?").slice(0, 30).padEnd(32)}${String(item["rss_human"] ?? "—").padStart(10)}  ${item["pid"] ?? ""}`,
        tone: "default",
      });
    });
  }

  if (topByCpu.length) {
    lines.push({ text: "  En çok CPU kullananlar:", tone: "dim" });
    topByCpu.slice(0, 4).forEach((item) => {
      lines.push({
        text: `    ${String(item["name"] ?? "?").slice(0, 30).padEnd(32)}${String(item["cpu_percent"] ?? "—").padStart(8)}%  ${item["pid"] ?? ""}`,
        tone: "default",
      });
    });
  }

  if (serviceItems.length) {
    lines.push({ text: `  Örnek servisler: ${joinNames(serviceItems, "name", 4)}`, tone: "dim" });
  }

  lines.push(
    gap(),
    sub("KULLANICILAR"),
    row("Yerel hesap", list(info, "users").length, "info", true),
    row("Açık oturum", loggedIn.length, loggedIn.length ? "ok" : "dim", true),
  );

  if (loggedIn.length) {
    loggedIn.slice(0, 5).forEach((session) => {
      lines.push({
        text: `  ${String(session["name"] ?? "?").padEnd(20)}${String(session["terminal"] ?? "").padEnd(12)}${session["host"] ?? ""}`,
        tone: "default",
      });
    });
  }

  lines.push(
    gap(),
    sub("GÜVENLİK"),
    row("Güvenlik duvarı", sec["firewall"], String(sec["firewall"] ?? "").length > 2 ? "ok" : "warn", true),
    row("Antivirüs", antivirus.length ? antivirus.slice(0, 2).join(", ") : "—", antivirus.length ? "ok" : "warn", true),
    row("Secure Boot", sec["secure_boot"], "dim"),
    row("BitLocker", sec["bitlocker"], "dim"),
    row("İzleme koruması", info.browser.doNotTrack === "1" ? "AÇIK" : "kapalı", info.browser.doNotTrack === "1" ? "ok" : "dim"),
  );

  lines.push(
    gap(),
    sub("YAZILIM"),
    row("Kurulu program", programs["count"], "info", true),
  );
  if (programItems.length) {
    lines.push({ text: `  Örnek: ${joinNames(programItems, "name", 4)}`, tone: "dim" });
  }

  const tools = (part(info, "environment")["tools"] ?? {}) as Record<string, unknown>;
  const activeTools = Object.entries(tools).filter(([, value]) => Boolean(value));
  if (activeTools.length) {
    lines.push(gap(), sub("GELİŞTİRİCİ ARAÇLARI"));
    activeTools.forEach(([tool, value]) => {
      lines.push({ text: `  ${tool.padEnd(22)}${String(value).slice(0, 40)}`, tone: "default" });
    });
  }

  return { title: "İŞLETİM SİSTEMİ & ÇEVRE", lines };
}

/** Köprü yoksa ne gerektiğini anlatan bölüm. */
function sectionBridgeRequired(info: MachineInfo): ConsoleSection {
  return {
    title: "YEREL KÖPRÜ GEREKLİ",
    lines: [
      { text: "Köprü çalışmıyor — aşağıdaki alanlar bu yüzden boş.", tone: "warn", summary: true },
      { text: `Sebep: ${info.bridgeError ?? "bilinmiyor"}`, tone: "dim" },
      gap(),
      { text: "Köprü açıldığında otomatik dolar:", tone: "info", summary: true },
      { text: "  • Anakart, BIOS ve seri numaraları", tone: "dim" },
      { text: "  • RAM modülleri (slot, hız, parça numarası)", tone: "dim" },
      { text: "  • Disk kapasiteleri ve boş alan", tone: "dim" },
      { text: "  • CPU / anakart / disk sıcaklıkları ve fan devirleri", tone: "dim" },
      { text: "  • Dinlenen portlar ve zafiyet değerlendirmesi", tone: "dim" },
      { text: "  • İşlem, servis, kullanıcı ve program envanteri", tone: "dim" },
      { text: "  • İç/dış IP, MAC, ağ geçidi, DNS", tone: "dim" },
      gap(),
      { text: "Windows : services/bridge/start-bridge.bat", tone: "info", summary: true },
      { text: "Linux   : services/bridge/start-bridge.sh", tone: "info", summary: true },
      { text: "Token   : Ayarlar > Köprü alanına girilir", tone: "info" },
    ],
  };
}

// ======================================================================
//  Genel
// ======================================================================

/** Bilgi yapısını bölümlere ayırır. */
export function buildConsoleSections(info: MachineInfo): ConsoleSection[] {
  const sections: ConsoleSection[] = [sectionIdentity(info), sectionCpu(info), sectionMemory(info)];

  if (hasBridge(info)) {
    sections.push(
      sectionStorage(info),
      sectionGpu(info),
      sectionThermal(info),
      sectionPorts(info),
      sectionSystem(info),
    );
  } else {
    // Köprü yok — tarayıcıdan okunabilenler yine gösterilir
    sections.push(
      {
        title: "TARAYICI KATMANI",
        lines: [
          row("Platform", info.browser.platform, "info"),
          row("Dil", `${info.browser.language} (${info.browser.languages.slice(0, 3).join(", ")})`),
          row("Saat dilimi", info.browser.timezone),
          row("Yerel saat", info.browser.localeDate),
          row("Çevrimiçi", yesNo(info.browser.online, "BAĞLI", "ÇEVRİMDIŞI"), info.browser.online ? "ok" : "err"),
          row("Ekran", info.hardware.screen, "info"),
          row("Piksel oranı", val(info.hardware.pixelRatio, "×")),
          row("Mantıksal çekirdek", val(info.hardware.logicalCores)),
          row("GPU modeli", info.gpu.renderer),
        ],
      },
      sectionBridgeRequired(info),
    );
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
