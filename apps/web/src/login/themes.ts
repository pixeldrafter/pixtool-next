/**
 * Login formu temaları.
 *
 * Her form kendi renk paletini, animasyon karakterini ve OTP/şaka biçimini
 * taşır. `LoginScreen` bu temayı forma, OTP adımına ve şaka balonuna geçirir.
 *
 * Renkler v5 `login_window.py` içindeki tema sözlüklerinden ve referans
 * demoların kendi stillerinden uyarlanmıştır.
 */

import type { LoginFormId } from "../settings/types";
import type { LoginTheme } from "./types";

export const LOGIN_THEMES: Record<LoginFormId, LoginTheme> = {
  // ------------------------------------------------------------------
  //  Lamp — sıcak amber, lamba aydınlatmalı (VARSAYILAN)
  // ------------------------------------------------------------------
  lamp: {
    id: "lamp",
    name: "Login Form Lamp",
    hint: "Lamba aydınlatmalı, sıcak tonlar",
    colors: {
      bg: "#1a1208",
      surface: "rgba(38, 26, 12, 0.82)",
      border: "rgba(255, 196, 92, 0.28)",
      accent: "#ffc45c",
      text: "#fdf3e3",
      muted: "#b79b74",
      error: "#ff6b6b",
      success: "#8be28b",
    },
    font: "'Inter', system-ui, -apple-system, sans-serif",
    motion: "minimal",
    jokeStyle: "card",
    otpStyle: "boxes",
    tone: "professional",
  },

  // ------------------------------------------------------------------
  //  Animated — mor gradyan, kayan etiketler
  // ------------------------------------------------------------------
  animated: {
    id: "animated",
    name: "Animated Login Form",
    hint: "Mor gradyan, kayan etiketler",
    colors: {
      bg: "#0b0620",
      surface: "rgba(30, 18, 66, 0.72)",
      border: "rgba(160, 120, 255, 0.3)",
      accent: "#a855f7",
      text: "#f2ecff",
      muted: "#9a8cc4",
      error: "#ff5c8a",
      success: "#5ce1a0",
    },
    font: "'Poppins', system-ui, sans-serif",
    motion: "playful",
    jokeStyle: "ticker",
    otpStyle: "underline",
    tone: "friendly",
  },

  // ------------------------------------------------------------------
  //  Animated Border — neon kenarlık, koyu terminal
  // ------------------------------------------------------------------
  animatedBorder: {
    id: "animatedBorder",
    name: "Animated Border Login Form",
    hint: "Dönen neon kenarlık, terminal havası",
    colors: {
      bg: "#04060a",
      surface: "rgba(8, 14, 20, 0.9)",
      border: "rgba(0, 229, 255, 0.32)",
      accent: "#00e5ff",
      text: "#dff6ff",
      muted: "#5f7d8c",
      error: "#ff3b4e",
      success: "#00ff9c",
    },
    font: "'Cascadia Mono', 'Consolas', monospace",
    motion: "glow",
    jokeStyle: "terminal",
    otpStyle: "glow",
    tone: "professional",
  },

  // ------------------------------------------------------------------
  //  Panda — referans tasarım AÇIK temalıdır (sarı zemin, beyaz kart)
  // ------------------------------------------------------------------
  panda: {
    id: "panda",
    name: "Panda Login Form",
    hint: "Sevimli panda, sarı zemin",
    colors: {
      bg: "#f4c531",
      surface: "#ffffff",
      border: "rgba(0, 0, 0, 0.12)",
      accent: "#f4c531",
      text: "#2f2f2f",
      muted: "#7a7a7a",
      error: "#d94343",
      success: "#3f9d4a",
    },
    font: "'Poppins', system-ui, sans-serif",
    motion: "playful",
    jokeStyle: "speech",
    otpStyle: "paws",
    tone: "playful",
  },

  // ------------------------------------------------------------------
  //  Panda (tam sayfa) — aynı görsel dil
  // ------------------------------------------------------------------
  pandaPage: {
    id: "pandaPage",
    name: "Panda Login Page",
    hint: "Panda — tam sayfa, sarı zemin",
    colors: {
      bg: "#f4c531",
      surface: "#ffffff",
      border: "rgba(0, 0, 0, 0.12)",
      accent: "#f4c531",
      text: "#2f2f2f",
      muted: "#7a7a7a",
      error: "#d94343",
      success: "#3f9d4a",
    },
    font: "'Poppins', system-ui, sans-serif",
    motion: "playful",
    jokeStyle: "speech",
    otpStyle: "paws",
    tone: "playful",
  },

  // ------------------------------------------------------------------
  //  Yeti — referans tasarım AÇIK temalıdır (buz mavisi, beyaz kart)
  // ------------------------------------------------------------------
  yeti: {
    id: "yeti",
    name: "Yeti Login Form Animation",
    hint: "Kar temalı, açık zemin, en zengin animasyon",
    colors: {
      bg: "#eff3f4",
      surface: "#ffffff",
      border: "rgba(58, 94, 119, 0.25)",
      accent: "#66c6e4",
      text: "#2d4a56",
      muted: "#7f9aa8",
      error: "#d94343",
      success: "#3f9d4a",
    },
    font: "'Source Sans Pro', system-ui, sans-serif",
    motion: "frost",
    jokeStyle: "frost",
    otpStyle: "snow",
    tone: "friendly",
  },
};

/** Tema listesi (Ayarlar ekranında gösterim sırası). */
export const LOGIN_THEME_LIST: LoginTheme[] = Object.values(LOGIN_THEMES);

export function getLoginTheme(id: LoginFormId): LoginTheme {
  return LOGIN_THEMES[id];
}
