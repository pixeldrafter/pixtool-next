/**
 * Login formu yardımcıları.
 *
 * Not: `themeVars` artık kullanılmıyor — formlar kendi referans CSS'lerini
 * kullanıyor. Geriye dönük uyumluluk için tutuluyor.
 */

import { useState } from "react";

import type { LoginCredentials, LoginTheme } from "../types";

/**
 * Tema renklerini CSS değişkeni olarak forma geçirir.
 * (Referans CSS kullanan formlar bunu kullanmaz.)
 */
export function themeVars(theme: LoginTheme): React.CSSProperties {
  return {
    ["--lf-bg" as string]: theme.colors.bg,
    ["--lf-surface" as string]: theme.colors.surface,
    ["--lf-border" as string]: theme.colors.border,
    ["--lf-accent" as string]: theme.colors.accent,
    ["--lf-text" as string]: theme.colors.text,
    ["--lf-muted" as string]: theme.colors.muted,
    ["--lf-error" as string]: theme.colors.error,
    ["--lf-success" as string]: theme.colors.success,
    ["--lf-font" as string]: theme.font,
  };
}

export interface CredentialState {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  submit: (event: React.FormEvent) => void;
  passwordFocused: boolean;
  setPasswordFocused: (value: boolean) => void;
}

/** Formlarda tekrar eden kimlik bilgisi durumunu yönetir. */
export function useCredentials(
  onSubmit: (credentials: LoginCredentials) => void,
): CredentialState {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit({ username: username.trim(), password });
  }

  return {
    username,
    password,
    setUsername,
    setPassword,
    submit,
    passwordFocused,
    setPasswordFocused,
  };
}
