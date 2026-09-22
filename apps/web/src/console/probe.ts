/**
 * Makine bilgisi toplayıcı (tarayıcı tarafı).
 *
 * Kullanıcı isteği: konsolda "açılan bilgisayarın her şeyi ama her şeyi"
 * görünsün. Tarayıcı sandbox'ı donanımın tamamına erişemez, ancak
 * **gerçek** olarak erişebildiği çok şey var. Bunları toplarız ve
 * erişilemeyenleri **açıkça "köprü gerekli" diye işaretleriz** — sahte
 * veri göstermeyiz.
 *
 * Gerçek veri kaynakları:
 *   navigator.hardwareConcurrency, navigator.deviceMemory, screen.*,
 *   WebGL (GPU), navigator.connection, getBattery, storage.estimate,
 *   navigator.mediaDevices, Intl, WebGPU, Performance API
 */

// ----------------------------------------------------------------------
//  Tarayıcıda tanımlı olmayan API'ler için minimal tipler
// ----------------------------------------------------------------------
interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface BatteryLike {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

interface NavigatorWithExtras extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformationLike;
  getBattery?: () => Promise<BatteryLike>;
}

// ----------------------------------------------------------------------
//  Ana bilgi yapısı
// ----------------------------------------------------------------------
export interface MachineInfo {
  /** Tarayıcının görebildiği gerçek veriler */
  browser: {
    userAgent: string;
    platform: string;
    language: string;
    languages: string[];
    cookiesEnabled: boolean;
    doNotTrack: string | null;
    online: boolean;
    timezone: string;
    timezoneOffsetMinutes: number;
    localeDate: string;
  };
  hardware: {
    logicalCores: number | null;
    deviceMemoryGb: number | null;
    screen: string;
    availableScreen: string;
    colorDepth: number;
    pixelRatio: number;
    touchPoints: number;
    maxTouchPoints: number;
  };
  gpu: {
    vendor: string;
    renderer: string;
    webglVersion: string;
    maxTextureSize: number | null;
    webgpu: boolean;
  };
  network: {
    effectiveType: string | null;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean | null;
  };
  battery: {
    available: boolean;
    level: number | null;
    charging: boolean | null;
    chargingTimeSeconds: number | null;
  };
  storage: {
    quotaMb: number | null;
    usageMb: number | null;
    usagePercent: number | null;
    localStorageItems: number;
  };
  media: {
    audioInputs: number;
    audioOutputs: number;
    videoInputs: number;
  };
  performance: {
    pageLoadMs: number | null;
    domInteractiveMs: number | null;
    jsHeapMb: number | null;
  };
}

/** GPU bilgisini WebGL üzerinden okur. */
function readGpu(): MachineInfo["gpu"] {
  const fallback: MachineInfo["gpu"] = {
    vendor: "bilinmiyor",
    renderer: "bilinmiyor",
    webglVersion: "desteklenmiyor",
    maxTextureSize: null,
    webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
  };

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return fallback;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));

    return {
      vendor,
      renderer,
      webglVersion: String(gl.getParameter(gl.VERSION)),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      webgpu: fallback.webgpu,
    };
  } catch {
    return fallback;
  }
}

/** Depolama kotasını okur. */
async function readStorage(): Promise<MachineInfo["storage"]> {
  const base: MachineInfo["storage"] = {
    quotaMb: null,
    usageMb: null,
    usagePercent: null,
    localStorageItems: 0,
  };

  try {
    base.localStorageItems = Object.keys(window.localStorage).length;
  } catch {
    /* erişim yok */
  }

  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? null;
      const usage = estimate.usage ?? null;
      base.quotaMb = quota === null ? null : Math.round((quota / 1048576) * 10) / 10;
      base.usageMb = usage === null ? null : Math.round((usage / 1048576) * 10) / 10;
      base.usagePercent =
        quota && usage !== null ? Math.round((usage / quota) * 1000) / 10 : null;
    }
  } catch {
    /* desteklenmiyor */
  }

  return base;
}

/** Pil bilgisini okur. */
async function readBattery(): Promise<MachineInfo["battery"]> {
  const nav = navigator as NavigatorWithExtras;
  if (typeof nav.getBattery !== "function") {
    return { available: false, level: null, charging: null, chargingTimeSeconds: null };
  }

  try {
    const battery = await nav.getBattery();
    return {
      available: true,
      level: Math.round(battery.level * 100),
      charging: battery.charging,
      chargingTimeSeconds:
        Number.isFinite(battery.chargingTime) && battery.chargingTime > 0
          ? Math.round(battery.chargingTime)
          : null,
    };
  } catch {
    return { available: false, level: null, charging: null, chargingTimeSeconds: null };
  }
}

/** Ortam bilgilerini okur. */
function readMedia(): MachineInfo["media"] {
  const devices = navigator.mediaDevices;
  if (!devices?.enumerateDevices) {
    return { audioInputs: 0, audioOutputs: 0, videoInputs: 0 };
  }
  return { audioInputs: -1, audioOutputs: -1, videoInputs: -1 };
}

/** Cihazları sayar (izin gerektirmeden yalnızca sayı ve tür okunur). */
async function countMediaDevices(): Promise<MachineInfo["media"]> {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    return {
      audioInputs: list.filter((device) => device.kind === "audioinput").length,
      audioOutputs: list.filter((device) => device.kind === "audiooutput").length,
      videoInputs: list.filter((device) => device.kind === "videoinput").length,
    };
  } catch {
    return { audioInputs: 0, audioOutputs: 0, videoInputs: 0 };
  }
}

/** Tarayıcının erişebildiği tüm gerçek bilgileri toplar. */
export async function probeMachine(): Promise<MachineInfo> {
  const nav = navigator as NavigatorWithExtras;
  const connection = nav.connection;

  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } })
    .memory;

  const [storage, battery, media] = await Promise.all([
    readStorage(),
    readBattery(),
    countMediaDevices(),
  ]);

  const gpu = readGpu();

  return {
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "bilinmiyor",
      language: navigator.language,
      languages: [...(navigator.languages ?? [])],
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      online: navigator.onLine,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      localeDate: new Date().toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "long" }),
    },
    hardware: {
      logicalCores: nav.hardwareConcurrency ?? null,
      deviceMemoryGb: nav.deviceMemory ?? null,
      screen: `${window.screen.width}×${window.screen.height}`,
      availableScreen: `${window.screen.availWidth}×${window.screen.availHeight}`,
      colorDepth: window.screen.colorDepth,
      pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      touchPoints: navigator.maxTouchPoints ?? 0,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
    },
    gpu,
    network: {
      effectiveType: connection?.effectiveType ?? null,
      downlinkMbps: connection?.downlink ?? null,
      rttMs: connection?.rtt ?? null,
      saveData: connection?.saveData ?? null,
    },
    battery,
    storage,
    media: media.audioInputs === -1 ? readMedia() : media,
    performance: {
      pageLoadMs: navigationEntry
        ? Math.round(navigationEntry.loadEventEnd - navigationEntry.startTime)
        : null,
      domInteractiveMs: navigationEntry
        ? Math.round(navigationEntry.domInteractive - navigationEntry.startTime)
        : null,
      jsHeapMb: memory ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10 : null,
    },
  };
}

// ----------------------------------------------------------------------
//  Köprü gerektiren alanlar — sahte veri üretmiyoruz, açıkça işaretliyoruz
// ----------------------------------------------------------------------
export const BRIDGE_REQUIRED_FIELDS: { label: string; description: string }[] = [
  { label: "İşletim sistemi sürümü", description: "Windows build numarası / dağıtım sürümü" },
  { label: "Anakart & BIOS", description: "Üretici, model, BIOS sürümü" },
  { label: "Fiziksel diskler", description: "Model, kapasite, SMART sağlığı" },
  { label: "Gerçek RAM miktarı", description: "Toplam / kullanılan / boş" },
  { label: "İç IP adresi", description: "Ağ arayüzü adresleri" },
  { label: "Dış IP adresi", description: "İnternet çıkış adresi" },
  { label: "MAC adresleri", description: "Ağ arayüzü donanım adresleri" },
  { label: "Kurulu programlar", description: "Kayıt defteri / dpkg listesi ve sürümleri" },
  { label: "Çalışan servisler", description: "systemd / Windows servis durumu" },
  { label: "Yüklü güncellemeler", description: "Bekleyen ve yapılmış güncellemeler" },
  { label: "Zaafiyet taraması", description: "Açık portlar, temel güvenlik kontrolleri" },
  { label: "Başlangıç programları", description: "Otomatik başlayan uygulamalar" },
];
