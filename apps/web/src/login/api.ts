/**
 * Kimlik doğrulama API istemcisi.
 *
 * Geliştirmede Vite proxy'si `/api` isteklerini backend'e yönlendirir.
 *
 * Akış:
 *   1. POST /api/v1/auth/login        → şifre kontrolü + OTP gönderimi
 *   2. POST /api/v1/auth/verify-otp   → kod doğrulama
 *   3. POST /api/v1/auth/resend-otp   → kodu yeniden gönder
 *
 * Backend `demo_mode` açıkken (n8n/Telegram yapılandırılmamış) OTP yanıtta
 * `dev_otp` alanında döner ve arayüzde gösterilir.
 */

import type { LoginCredentials } from "./types";
import { API_BASE } from "../lib/apiBase";

// ----------------------------------------------------------------------
//  Tipler
// ----------------------------------------------------------------------
export interface LoginResponse {
  ok: boolean;
  /** İki adımlı doğrulama gerekiyor mu */
  otp_required: boolean;
  /** OTP meydan okuma kimliği */
  challenge_id?: string;
  /** Kod uzunluğu */
  code_length?: number;
  /** Kalan deneme hakkı */
  attempts_left?: number;
  /** Geliştirme kipi: kodu yanıtta döndürür */
  dev_otp?: string;
  /** Kodun gönderildiği kanal */
  channel?: string;
  /** OTP gerekmiyorsa doğrudan oturum anahtarı */
  token?: string;
  message?: string;
}

export interface VerifyOtpResponse {
  ok: boolean;
  token?: string;
  attempts_left?: number;
  message?: string;
}

export interface ResendOtpResponse {
  ok: boolean;
  challenge_id?: string;
  dev_otp?: string;
  attempts_left?: number;
  message?: string;
}

// ----------------------------------------------------------------------
//  Yardımcı
// ----------------------------------------------------------------------
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return parsed as T;
}

// ----------------------------------------------------------------------
//  Uç noktalar
// ----------------------------------------------------------------------
export function apiLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  return post<LoginResponse>("/api/v1/auth/login", credentials);
}

export function apiVerifyOtp(challengeId: string, code: string): Promise<VerifyOtpResponse> {
  return post<VerifyOtpResponse>("/api/v1/auth/verify-otp", {
    challenge_id: challengeId,
    code,
  });
}

export function apiResendOtp(challengeId: string): Promise<ResendOtpResponse> {
  return post<ResendOtpResponse>("/api/v1/auth/resend-otp", {
    challenge_id: challengeId,
  });
}

/** Hata nesnesini okunabilir metne çevirir. */
export function describeAuthError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Sunucuya ulaşılamadı. Backend çalışıyor mu? (pnpm dev:api)";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Beklenmeyen bir hata oluştu.";
}
