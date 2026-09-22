/**
 * Varsayılan ayarlar.
 *
 * Kullanıcının hiçbir şey yapmadığı durumda uygulamanın davranışı.
 * Onaylanan kararlar burada kodlanmıştır (bkz. docs/KARARLAR.md).
 */

import type { PixSettings } from "./types";

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: PixSettings = {
  version: SETTINGS_VERSION,

  general: {
    lang: "tr",
    devMode: false,
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
    soundEnabled: true,
  },

  login: {
    form: "lamp", // varsayılan: Login Form Lamp
    lampStartLit: true, // form görünür başlasın (ipi çekmeye gerek kalmasın)
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
      style: "yeti", // Yeti tasarımlı OTP (kullanıcı isteği)
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
};
