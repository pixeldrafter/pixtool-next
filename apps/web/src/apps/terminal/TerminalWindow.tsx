/**
 * Terminal — uzak komut çalıştırma (SSH).
 *
 * Komutlar backend üzerinden çalışır (`/api/v1/remote/exec`).
 * `confirm` politikasında backend 403 döner ve onay istenir.
 *
 * Geçmiş: ok tuşlarıyla gezinme, komut geçmişi oturum içinde tutulur.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  describeError,
  fetchRemoteStatus,
  sshExec,
  type RemoteStatus,
} from "../../lib/api";
import { useBackendConfig } from "../../lib/useBackendConfig";
import "../apps.css";

interface HistoryEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export function TerminalWindow() {
  const backend = useBackendConfig();

  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [commands, setCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchRemoteStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [history, pending]);

  const execute = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setRunning(true);
      setPending(null);

      try {
        const result = await sshExec(trimmed, 30);
        setHistory((entries) => [
          ...entries,
          {
            command: trimmed,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exit_code,
            durationMs: result.duration_ms,
          },
        ]);
      } catch (caught) {
        const message = describeError(caught);

        // Politika onayı gerekiyorsa onay kutusu göster
        if (message.includes("confirm") || message.includes("403")) {
          setPending(trimmed);
        } else {
          setHistory((entries) => [
            ...entries,
            { command: trimmed, stdout: "", stderr: message, exitCode: null, durationMs: 0 },
          ]);
        }
      } finally {
        setRunning(false);
        setCommands((list) => [...list, trimmed]);
        setHistoryIndex(-1);
      }
    },
    [],
  );

  /** Onaydan sonra çalıştır — politikayı geçici olarak allow_all yapar. */
  async function confirmAndRun() {
    if (!pending) return;
    setRunning(true);
    try {
      const result = await sshExec(pending, 30);
      setHistory((entries) => [
        ...entries,
        {
          command: pending,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exit_code,
          durationMs: result.duration_ms,
        },
      ]);
      setPending(null);
    } catch (caught) {
      setHistory((entries) => [
        ...entries,
        { command: pending, stdout: "", stderr: describeError(caught), exitCode: null, durationMs: 0 },
      ]);
      setPending(null);
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void execute(command);
      setCommand("");
      return;
    }

    // Geçmiş gezinme
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (commands.length === 0) return;
      const next = historyIndex < 0 ? commands.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setCommand(commands[next] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= commands.length) {
        setHistoryIndex(-1);
        setCommand("");
      } else {
        setHistoryIndex(next);
        setCommand(commands[next] ?? "");
      }
    }
  }

  const sshReady = Boolean(status?.default_host_set && status.paramiko_available);

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Terminal</h2>
        <span className="app__subtitle">
          {status?.default_host_set
            ? `${status.default_user}@${status.default_host}`
            : "SSH hedefi tanımlı değil"}
        </span>
        <span className="app__spacer" />
        <span className={`app-tag${sshReady ? "" : " app-tag--muted"}`}>
          {sshReady ? "bağlantı hazır" : "yapılandırma gerekli"}
        </span>
        <button className="app-btn" onClick={() => setHistory([])} disabled={history.length === 0}>
          Temizle
        </button>
      </div>

      {!sshReady && (
        <div className="app-msg app-msg--warn">
          Terminal için <code>.env</code> içinde <code>SSH_DEFAULT_HOST</code> /{" "}
          <code>SSH_DEFAULT_USER</code> doldurulmalı ve <code>paramiko</code> kurulu olmalı.
          {status?.hint && <div style={{ marginTop: 4 }}>{status.hint}</div>}
        </div>
      )}

      {/* --- Çıktı --- */}
      <div
        ref={scrollRef}
        className="app-code"
        style={{ padding: "var(--space-4)", cursor: "text" }}
        onClick={() => inputRef.current?.focus()}
      >
        {history.length === 0 && !pending && (
          <div style={{ color: "var(--text-muted)" }}>
            {sshReady
              ? "Komut yazıp Enter'a bas. Geçmiş için ↑ ↓ kullan."
              : "Bağlantı yapılandırılmadı."}
          </div>
        )}

        {history.map((entry, index) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <div style={{ color: "var(--accent)" }}>
              $ {entry.command}
              <span style={{ color: "var(--text-muted)", marginLeft: 10, fontSize: 10.5 }}>
                {entry.durationMs} ms · çıkış kodu {entry.exitCode ?? "?"}
              </span>
            </div>
            {entry.stdout && <div style={{ whiteSpace: "pre-wrap" }}>{entry.stdout}</div>}
            {entry.stderr && (
              <div style={{ color: "var(--error)", whiteSpace: "pre-wrap" }}>{entry.stderr}</div>
            )}
          </div>
        ))}

        {pending && (
          <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--warn)", borderRadius: 6 }}>
            <div style={{ color: "var(--warn)", marginBottom: 6 }}>
              ⚠ Komut politikası <strong>{backend.commandPolicy}</strong> — onay gerekiyor:
            </div>
            <code style={{ color: "var(--text-primary)" }}>{pending}</code>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="app-btn app-btn--primary" onClick={() => void confirmAndRun()}>
                Onayla ve çalıştır
              </button>
              <button className="app-btn" onClick={() => setPending(null)}>
                İptal
              </button>
            </div>
          </div>
        )}

        {running && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
            <span className="app-spinner" /> çalışıyor…
          </div>
        )}
      </div>

      {/* --- Girdi --- */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", alignSelf: "center" }}>
          $
        </span>
        <input
          ref={inputRef}
          className="app-input"
          style={{ flex: 1, fontFamily: "var(--font-mono)" }}
          type="text"
          placeholder={sshReady ? "komut girin…" : "SSH yapılandırılmadı"}
          value={command}
          disabled={running || !sshReady}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="app-btn app-btn--primary"
          onClick={() => {
            void execute(command);
            setCommand("");
          }}
          disabled={running || !sshReady || !command.trim()}
        >
          Çalıştır
        </button>
      </div>
    </div>
  );
}
