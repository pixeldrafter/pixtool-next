/**
 * Kayıt / parola paneli — giriş formunun üstünde açılan katman.
 *
 * Akış
 * ----
 *   form doldur → `POST /api/v1/access/*-request`
 *   → talep oluşur, Telegram'a butonlu mesaj gider
 *   → panel **yönetici onayını yoklar** (`GET /api/v1/access/request/{id}`)
 *   → onaylanırsa kullanıcı oluşur, panel "onaylandı" gösterir
 *   → reddedilirse "reddedildi"
 *
 * Yoklama 3 sn aralıkla, en fazla 10 dakika sürer (talebin ömrü 30 dakika).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE } from "../lib/apiBase";
import type { LoginTheme } from "./types";
import { LOGIN_TEXT } from "./text";
import "./AuthPanel.css";

/** Panel modu. */
export type AuthPanelMode = "register" | "forgot";

/** Talep durumu yanıtı. */
interface AccessRequest {
  id: string;
  kind: AuthPanelMode;
  status: "pending" | "approved" | "rejected" | "expired" | "failed";
  username: string;
  message: string;
  expired: boolean;
}

interface AuthPanelProps {
  mode: AuthPanelMode;
  theme: LoginTheme;
  /** "Parolamı unuttum" için formdan gelen kullanıcı adı */
  initialUsername?: string;
  onClose: () => void;
  /** Kayıt onaylandığında (isteğe bağlı) */
  onApproved?: (username: string) => void;
}

/** Yoklama aralığı (ms) */
const POLL_INTERVAL = 3000;

/** En fazla kaç yoklama yapılsın (~10 dakika) */
const MAX_POLLS = 200;

/** API'ye istek atar ve hatayı okunabilir hâle getirir. */
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
        : `Sunucu hatası (HTTP ${response.status})`;
    throw new Error(detail);
  }

  return parsed as T;
}

export function AuthPanel({
  mode,
  theme,
  initialUsername = "",
  onClose,
  onApproved,
}: AuthPanelProps) {
  const [username, setUsername] = useState(initialUsername);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [polls, setPolls] = useState(0);

  const timerRef = useRef<number | null>(null);
  const approvedRef = useRef(false);

  const isRegister = mode === "register";
  const waiting = request?.status === "pending";

  // --- Yoklama ---
  useEffect(() => {
    if (!waiting || !request) return undefined;

    if (polls >= MAX_POLLS) {
      setError(LOGIN_TEXT.timeout);
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      void fetch(`${API_BASE}/api/v1/access/request/${encodeURIComponent(request.id)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { request?: AccessRequest } | null) => {
          if (data?.request) setRequest(data.request);
          setPolls((value) => value + 1);
        })
        .catch(() => {
          // Ağ hatasında yoklamaya devam — kullanıcıya hata gösterme
          setPolls((value) => value + 1);
        });
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [waiting, request, polls]);

  // --- Onaylandığında haber ver ---
  useEffect(() => {
    if (request?.status === "approved" && !approvedRef.current) {
      approvedRef.current = true;
      onApproved?.(request.username);
    }
  }, [request, onApproved]);

  /** Talebi gönderir. */
  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (sending) return;

      const name = username.trim();
      if (name.length < 3) {
        setError("Kullanıcı adı en az 3 karakter olmalı.");
        return;
      }

      setSending(true);
      setError(null);

      try {
        const data = await post<{ ok: boolean; request: AccessRequest }>(
          isRegister ? "/api/v1/access/register-request" : "/api/v1/access/forgot-request",
          isRegister
            ? { username: name, full_name: fullName.trim(), email: email.trim(), note: note.trim() }
            : { username: name, note: note.trim() },
        );

        setRequest(data.request);
        setPolls(0);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setSending(false);
      }
    },
    [sending, username, isRegister, fullName, email, note],
  );

  const statusTone =
    request?.status === "approved"
      ? "ok"
      : request?.status === "rejected" || request?.status === "failed"
        ? "danger"
        : "pending";

  return (
    <div className="auth-panel-backdrop" onClick={onClose}>
      <div
        className="auth-panel"
        style={{
          ["--panel-accent" as string]: theme.colors.accent,
          ["--panel-text" as string]: theme.colors.text,
          ["--panel-muted" as string]: theme.colors.muted,
          ["--panel-border" as string]: theme.colors.border,
          ["--panel-surface" as string]: theme.colors.surface,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-panel__head">
          <h2 className="auth-panel__title">
            {isRegister ? LOGIN_TEXT.registerTitle : LOGIN_TEXT.forgotTitle}
          </h2>
          <button type="button" className="auth-panel__close" onClick={onClose} title="Kapat">
            ✕
          </button>
        </header>

        {/* --- Bekleme / sonuç ekranı --- */}
        {request ? (
          <div className={`auth-panel__status is-${statusTone}`}>
            {request.status === "pending" && (
              <>
                <div className="auth-panel__spinner" />
                <p className="auth-panel__status-title">{LOGIN_TEXT.waiting}</p>
                <p className="auth-panel__status-hint">{LOGIN_TEXT.waitingHint}</p>
                <div className="auth-panel__pulse">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            )}

            {request.status === "approved" && (
              <>
                <div className="auth-panel__icon">✅</div>
                <p className="auth-panel__status-title">{LOGIN_TEXT.approved}</p>
                <p className="auth-panel__status-hint">
                  <strong>{request.username}</strong> hesabı oluşturuldu. Geçici parola
                  Telegram üzerinden gönderildi — ilk girişte değiştirmeyi unutma.
                </p>
                <button type="button" className="auth-panel__button" onClick={onClose}>
                  Girişe dön
                </button>
              </>
            )}

            {request.status === "rejected" && (
              <>
                <div className="auth-panel__icon">🚫</div>
                <p className="auth-panel__status-title">{LOGIN_TEXT.rejected}</p>
                <p className="auth-panel__status-hint">
                  {request.message || "Yönetici talebi reddetti."}
                </p>
                <button type="button" className="auth-panel__button" onClick={() => setRequest(null)}>
                  {LOGIN_TEXT.back}
                </button>
              </>
            )}

            {(request.status === "expired" || request.status === "failed") && (
              <>
                <div className="auth-panel__icon">⏱</div>
                <p className="auth-panel__status-title">
                  {request.status === "expired" ? LOGIN_TEXT.timeout : "Talep iletilemedi"}
                </p>
                <p className="auth-panel__status-hint">{request.message}</p>
                <button type="button" className="auth-panel__button" onClick={() => setRequest(null)}>
                  {LOGIN_TEXT.back}
                </button>
              </>
            )}
          </div>
        ) : (
          /* --- Form --- */
          <form className="auth-panel__form" onSubmit={submit}>
            <p className="auth-panel__intro">
              {isRegister ? LOGIN_TEXT.registerIntro : LOGIN_TEXT.forgotIntro}
            </p>

            <label className="auth-panel__field">
              <span>{LOGIN_TEXT.username}</span>
              <input
                type="text"
                value={username}
                autoFocus
                autoComplete="username"
                placeholder={LOGIN_TEXT.usernamePlaceholder}
                onChange={(event) => setUsername(event.target.value)}
                disabled={sending}
              />
            </label>

            {isRegister && (
              <>
                <label className="auth-panel__field">
                  <span>{LOGIN_TEXT.fullName}</span>
                  <input
                    type="text"
                    value={fullName}
                    autoComplete="name"
                    placeholder="Adın Soyadın"
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={sending}
                  />
                </label>

                <label className="auth-panel__field">
                  <span>{LOGIN_TEXT.email}</span>
                  <input
                    type="email"
                    value={email}
                    autoComplete="email"
                    placeholder="ornek@eposta.com"
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={sending}
                  />
                </label>
              </>
            )}

            <label className="auth-panel__field">
              <span>{LOGIN_TEXT.note}</span>
              <textarea
                value={note}
                rows={2}
                maxLength={400}
                placeholder="Yöneticiye kısa bir not…"
                onChange={(event) => setNote(event.target.value)}
                disabled={sending}
              />
            </label>

            {error && <p className="auth-panel__error">{error}</p>}

            <div className="auth-panel__actions">
              <button
                type="button"
                className="auth-panel__button is-ghost"
                onClick={onClose}
                disabled={sending}
              >
                {LOGIN_TEXT.cancel}
              </button>
              <button type="submit" className="auth-panel__button is-primary" disabled={sending}>
                {sending ? LOGIN_TEXT.sending : LOGIN_TEXT.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
