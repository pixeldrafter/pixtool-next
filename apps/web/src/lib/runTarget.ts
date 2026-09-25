/**
 * Birleşik komut/script çalıştırma katmanı.
 *
 * İki hedef vardır ve arayüz bunu seçebilir:
 *
 * | Hedef | Yol | Nerede çalışır |
 * |---|---|---|
 * | `local`  | Yerel köprü `POST /run` | **Arayüzün açık olduğu makine** |
 * | `remote` | API `POST /api/v1/remote/exec` (SSH) | Yapılandırılmış uzak sunucu |
 *
 * ## Onay akışı
 *
 * `COMMAND_POLICY=confirm` iken uzak çalıştırma **403** döner. Arayüz
 * kullanıcıya sorar ve onaydan sonra `confirmed: true` ile tekrar gönderir.
 * Yerel köprüde token zaten yetkilendirme sağlar.
 */

import { API_BASE } from "./apiBase";
import { bridgeFromTauri, DEFAULT_BRIDGE_URL } from "../console/bridge";

/** Çalıştırma hedefi. */
export type RunTarget = "local" | "remote";

/** Script/komut tipi. */
export type Executor = "powershell" | "cmd" | "bash" | "python" | "auto";

export interface RunOptions {
  /** Nerede çalışsın */
  target: RunTarget;
  /** Yorumlayıcı (yerel köprü için) */
  executor?: Executor;
  /** Uzak hedefte kullanıcı onayı verildi mi */
  confirmed?: boolean;
  /** Zaman aşımı (saniye) */
  timeoutSeconds?: number;
  /** Köprü adresi (ayarlardan) */
  bridgeUrl?: string;
  /** Köprü tokenı (ayarlardan) */
  bridgeToken?: string;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  /** Politika onayı gerekiyor mu */
  needsConfirmation: boolean;
  /** Kullanıcıya gösterilecek mesaj */
  message: string;
  /** Hangi hedefte çalıştı */
  target: RunTarget;
}

/** İşletim sistemine göre varsayılan yorumlayıcı. */
function autoExecutor(): Executor {
  if (typeof navigator === "undefined") return "bash";
  return /Windows/i.test(navigator.userAgent) ? "powershell" : "bash";
}

/**
 * Uzak sunucuda komut çalıştırır (API üzerinden SSH).
 */
async function runRemote(command: string, options: RunOptions): Promise<RunResult> {
  const response = await fetch(`${API_BASE}/api/v1/remote/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      command,
      confirmed: options.confirmed ?? false,
      timeout_seconds: options.timeoutSeconds ?? 60,
    }),
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  // Politik onayı gerekiyor
  if (response.status === 403) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: null,
      durationMs: 0,
      needsConfirmation: true,
      message: String(data["detail"] ?? "Komut politikası onay gerektiriyor."),
      target: "remote",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      stdout: "",
      stderr: String(data["detail"] ?? `HTTP ${response.status}`),
      exitCode: null,
      durationMs: 0,
      needsConfirmation: false,
      message: `Uzak çalıştırma başarısız (HTTP ${response.status}).`,
      target: "remote",
    };
  }

  return {
    ok: Boolean(data["ok"]),
    stdout: String(data["stdout"] ?? ""),
    stderr: String(data["stderr"] ?? ""),
    exitCode: (data["exit_code"] as number | null) ?? null,
    durationMs: Number(data["duration_ms"] ?? 0),
    needsConfirmation: false,
    message: String(data["message"] ?? "Tamamlandı."),
    target: "remote",
  };
}

/**
 * Yerel makinede (köprü üzerinden) komut çalıştırır.
 */
async function runLocal(command: string, options: RunOptions): Promise<RunResult> {
  // Köprü adresi + token: Tauri kabuğundan veya ayarlardan
  let url = (options.bridgeUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, "");
  let token = options.bridgeToken ?? "";

  if (!token) {
    const shell = await bridgeFromTauri();
    if (shell?.running && shell.token) {
      url = shell.url.replace(/\/+$/, "");
      token = shell.token;
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Pixtool-Client": "web" };
  if (token) headers["X-Pixtool-Token"] = token;

  try {
    const response = await fetch(`${url}/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        script: command,
        executor: options.executor && options.executor !== "auto" ? options.executor : autoExecutor(),
        timeout: options.timeoutSeconds ?? 120,
      }),
      signal: AbortSignal.timeout((options.timeoutSeconds ?? 120) * 1000 + 5000),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        stdout: "",
        stderr: String(data["error"] ?? `HTTP ${response.status}`),
        exitCode: null,
        durationMs: 0,
        needsConfirmation: false,
        message:
          response.status === 401
            ? "Köprü tokenı geçersiz. Ayarlar > Köprü bölümünden güncelleyin."
            : `Yerel çalıştırma başarısız (HTTP ${response.status}).`,
        target: "local",
      };
    }

    return {
      ok: Boolean(data["ok"]),
      stdout: String(data["stdout"] ?? ""),
      stderr: String(data["stderr"] ?? ""),
      exitCode: (data["exit_code"] as number | null) ?? null,
      durationMs: Number(data["duration_ms"] ?? 0),
      needsConfirmation: false,
      message: data["error"] ? String(data["error"]) : "Tamamlandı.",
      target: "local",
    };
  } catch (caught) {
    const isTimeout = caught instanceof DOMException && caught.name === "TimeoutError";
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: null,
      durationMs: 0,
      needsConfirmation: false,
      message: isTimeout
        ? "Komut zaman aşımına uğradı."
        : "Yerel köprüye ulaşılamadı. Köprü çalışıyor mu? (services/bridge)",
      target: "local",
    };
  }
}

/**
 * Komutu seçilen hedefte çalıştırır.
 *
 * @example
 *   const r = await runCommand("hostname", { target: "local" });
 */
export async function runCommand(command: string, options: RunOptions): Promise<RunResult> {
  if (!command.trim()) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: null,
      durationMs: 0,
      needsConfirmation: false,
      message: "Boş komut.",
      target: options.target,
    };
  }

  return options.target === "local"
    ? runLocal(command, options)
    : runRemote(command, options);
}
