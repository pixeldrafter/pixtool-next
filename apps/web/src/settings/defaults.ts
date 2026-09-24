/**
 * Varsayılan ayarlar.
 *
 * Kullanıcının hiçbir şey yapmadığı durumda uygulamanın davranışı.
 * Onaylanan kararlar burada kodlanmıştır (bkz. docs/KARARLAR.md).
 */

import type { PixSettings } from "./types";

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: PixSettings = {
  version: SETTINGS_VERSION,

  general: {
    lang: "tr",
    devMode: false,
    // Sahip bilgileri — görev çubuğu ve altbilgide görünür
    ownerName: "omercataloglu",
    productName: "Pixtool Global",
    siteUrl: "https://omercataloglu.com",
    copyright: "Ömer Çataloğlu © 2026 — All right reserved!",
  },

  flow: {
    // Onaylanan akış: Giriş → Konsol → Boot → Masaüstü
    order: ["login", "console", "boot", "desktop"],
    // "her şeyi ekrana bas" — varsayılan açık
    consoleVerbosity: "everything",
    askSaveReport: true,
    reportTarget: "nocodb",
  },

  appearance: {
    theme: "windows",
    wallpaper: {
      kind: "spider-clock",
      source: "",
      dim: 0.35,
      speed: 1,
    },
    cursor: {
      kind: "default",
      trail: 12,
      image: "",
    },
    motion: "full",
    scale: 1,
    iconSize: "medium",
    soundEnabled: true,
  },

  login: {
    form: "lamp", // varsayılan: Login Form Lamp
    // Lamba KAPALI başlar — kullanıcı ipi çekince ışık yanar ve form görünür.
    lampStartLit: false,
    usernameLabel: "Kullanıcı adı",
    passwordLabel: "Parola",
    jokes: {
      enabled: true,
      rotateSeconds: 12,
      style: "theme",
    },
    otp: {
      enabled: true,
      length: 6,
      maxAttempts: 3,
      channel: "telegram",
      style: "classic", // Login formunun temasına uyar (lamba → sıcak amber OTP)
    },
    punishment: {
      enabled: true,
      countdownSeconds: 120, // 2 dakika
      sound: true,
      lockInput: true,
    },
  },

  idle: {
    enabled: true,
    minutes: 5,
    screen: "pixel-bat",
    requirePassword: false,
    sound: false,
  },

  power: {
    animatedShutdown: true,
    confirmShutdown: false,
  },

  loading: {
    progressBarStyle: "deadline",
    waitingCurtain: true,
    curtainDim: 0.7,
  },

  // Yerel köprü (Faz 3) — konsol gerçek makine bilgisini buradan alır.
  bridge: {
    enabled: true,
    url: "http://127.0.0.1:8765",
    token: "",
    autoProbe: true,
    allowRun: false,
  },
};
