/**
 * Önyükleme (boot) dizisi.
 *
 * Kaynak: v5 `core/console_ui.py` → `start_system_boot` ve `_faz_*` fonksiyonları.
 * Karar #10: mevcut konsol boot'u **harfiyen** korunur; üzerine §11.1'deki yeni
 * taramalar eklenir (iç/dış IP, zaafiyet taraması, kurulu programlar).
 *
 * ⚠️ Faz 0 notu:
 *   Gerçek donanım/ağ bilgisi **tarayıcıdan okunamaz**. Bu bilgiler yerel
 *   köprüden (Faz 3) veya backend'den gelecek. Şu an:
 *     • backend'den gelen gerçek bilgiler gösterilir (sürüm, ortam, entegrasyon durumu)
 *     • cihaza özel alanlar "KÖPRÜ BEKLENİYOR (FAZ 3)" olarak işaretlenir
 *   Böylece ekran yanıltıcı sahte veri göstermez.
 */

import type { StatusResponse } from "../lib/api";

export type LineTone = "default" | "ok" | "warn" | "err" | "info" | "dim" | "accent";

export interface BootLine {
  text: string;
  tone?: LineTone;
}

export interface BootPhase {
  title: string;
  lines: BootLine[];
}

/** Cihaz bilgisi köprüden gelene kadar gösterilen işaret. */
const PENDING = "KÖPRÜ BEKLENİYOR (FAZ 3)";

/**
 * Boot fazlarını üretir.
 *
 * @param status  Backend durum yanıtı (yoksa bağlantı kurulamadı)
 * @param error   Bağlantı hatası mesajı
 */
export function buildBootPhases(
  status: StatusResponse | null,
  error: string | null,
): BootPhase[] {
  const app = status?.app;
  const nocodb = status?.integrations.nocodb;
  const features = status?.features;

  const nocodbTone: LineTone = nocodb?.ok
    ? "ok"
    : nocodb?.reachable
      ? "warn"
      : nocodb?.placeholder
        ? "warn"
        : "err";

  const nocodbValue = !status
    ? "BAĞLANTI YOK"
    : nocodb?.ok
      ? "BAĞLI"
      : nocodb?.placeholder
        ? "ŞABLON ADRES (yapılandırılacak)"
        : nocodb?.reachable
          ? "TOKEN GEÇERSİZ"
          : "ULAŞILAMIYOR";

  return [
    {
      title: "FAZ 1: DONANIM KİMLİK & SİSTEM ÖZELLİKLERİ",
      lines: [
        { text: "İŞLEMCİ (CPU)      : " + PENDING, tone: "dim" },
        { text: "MİMARİ             : " + PENDING, tone: "dim" },
        { text: "ÖNBELLEK (L2/L3)   : " + PENDING, tone: "dim" },
        { text: "PLATFORM HEDEFİ    : Windows " + (features?.platforms.windows ?? "10,11") + "  ·  Linux " + (features?.platforms.linux ?? "ubuntu,debian"), tone: "info" },
      ],
    },
    {
      title: "FAZ 2: ÇEKİRDEK SERVİSLER & YAPILANDIRMA",
      lines: [
        { text: "UYGULAMA           : " + (app?.name ?? "—"), tone: "accent" },
        { text: "SÜRÜM              : " + (app?.version ?? "—"), tone: "ok" },
        { text: "ORTAM              : " + (app?.env ?? "—"), tone: app?.env === "production" ? "ok" : "warn" },
        { text: "DİL                : " + (app?.lang ?? "tr"), tone: "default" },
        { text: "VERİ ADAPTÖRÜ      : " + (features?.db_adapter ?? "—"), tone: "info" },
      ],
    },
    {
      title: "FAZ 3: DOSYA SİSTEMİ & BÜTÜNLÜK",
      lines: [
        { text: "YAPILANDIRMA       : .env okundu", tone: status ? "ok" : "err" },
        { text: "PROJE KÖKÜ         : pnpm-workspace.yaml bulundu", tone: status ? "ok" : "dim" },
        { text: "SIR SAKLAMA        : .env (git dışı) · ŞİFRE %USERPROFILE%\\.ssh altında", tone: "ok" },
        { text: "BÜTÜNLÜK KONTROLÜ  : " + (status ? "OK" : "ATLANDI"), tone: status ? "ok" : "warn" },
      ],
    },
    {
      title: "FAZ 4: SİBER GÜVENLİK & KRİPTO PROTOKOLLERİ",
      lines: [
        { text: "KOMUT POLİTİKASI   : " + (features?.command_policy?.toUpperCase() ?? "—"), tone: features?.command_policy === "allow_all" ? "err" : "ok" },
        { text: "API ANAHTARI       : " + (status?.warnings.some((w) => w.includes("API_SECRET_KEY")) ? "BOŞ — üretimde doldurulmalı" : "TANIMLI"), tone: status?.warnings.some((w) => w.includes("API_SECRET_KEY")) ? "warn" : "ok" },
        { text: "KÖPRÜ TOKENI       : " + (status?.integrations.bridge.configured ? "TANIMLI" : "BOŞ (Faz 3'te gerekli)"), tone: status?.integrations.bridge.configured ? "ok" : "warn" },
        { text: "GÜVENLİK DUVARI    : " + PENDING, tone: "dim" },
      ],
    },
    {
      title: "FAZ 5: AĞ KATMANI & UPLINK BAĞLANTISI",
      lines: [
        { text: "BACKEND /health     : " + (status ? "YANIT VERDİ" : error ? "ULAŞILAMADI" : "BEKLENİYOR"), tone: status ? "ok" : "err" },
        { text: "NOCODB (VERİ)      : " + nocodbValue, tone: nocodbTone },
        { text: "N8N (OTOMASYON)    : " + (status?.integrations.n8n.configured ? "YAPILANDIRILDI" : "ŞABLON / BOŞ"), tone: status?.integrations.n8n.configured ? "ok" : "warn" },
        { text: "TELEGRAM (OTP)     : " + (status?.integrations.telegram.configured ? "YAPILANDIRILDI" : "ŞABLON / BOŞ"), tone: status?.integrations.telegram.configured ? "ok" : "warn" },
        { text: "YEREL IP / DIŞ IP  : " + PENDING, tone: "dim" },
        { text: "ZAAFİYET TARAMASI  : " + PENDING, tone: "dim" },
        { text: "KURULU PROGRAMLAR  : " + PENDING, tone: "dim" },
      ],
    },
  ];
}

/** Kapanış — §11.1: tarih/saat + PC adı + IP'ler → "veritabanına kaydet?" */
export function buildClosingLines(status: StatusResponse | null): BootLine[] {
  const now = new Date();
  const stamp = now.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const lines: BootLine[] = [
    { text: "", tone: "default" },
    { text: "  TARİH / SAAT       : " + stamp, tone: "info" },
    { text: "  BİLGİSAYAR ADI     : " + PENDING, tone: "dim" },
    { text: "  İÇ IP / DIŞ IP     : " + PENDING, tone: "dim" },
    { text: "", tone: "default" },
    { text: "  → Bu bilgileri veritabanına kaydetmek ister misin?", tone: "accent" },
    { text: "     (cihaz kaydı, Faz 3'te köprü ile etkinleşecek)", tone: "dim" },
  ];

  if (status && status.warnings.length > 0) {
    lines.push({ text: "", tone: "default" });
    lines.push({ text: "  ⚠ UYARILAR:", tone: "warn" });
    for (const warning of status.warnings) {
      lines.push({ text: "     • " + warning, tone: "warn" });
    }
  }

  return lines;
}
