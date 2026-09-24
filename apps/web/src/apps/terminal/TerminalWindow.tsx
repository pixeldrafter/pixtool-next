/**
 * Terminal.
 *
 * Komutları **iki hedefte** çalıştırır:
 *   • **Yerel** — arayüzün açık olduğu makine (yerel köprü üzerinden)
 *   • **Uzak** — yapılandırılmış sunucu (API → SSH)
 *
 * Geçmiş, kısayol komutlar, çıkış kodu ve süre gösterilir. Komut politikası
 * `confirm` ise kullanıcıdan onay istenir.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useSettings } from "../../settings";
import { runCommand, type RunTarget } from "../../lib/runTarget";
import "../apps.css";
import "./terminal-window.css";

interface HistoryEntry {
  id: number;
  command: string;
  target: RunTarget;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  ok: boolean;
}

/** Hedef başına hazır komutlar. */
const QUICK: Record<RunTarget, { label: string; command: string }[]> = {
  local: [
    { label: "Makine adı", command: "hostname" },
    { label: "IP adresleri", command: "ipconfig" },
    { label: "Disk", command: "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n='GB';e={[math]::Round($_.Used/1GB,1)}},@{n='Free';e={[math]::Round($_.Free/1GB,1)}}" },
    { label: "İşlemler", command: "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 Name,Id,@{n='MB';e={[math]::Round($_.WorkingSet64/1MB,1)}}" },
    { label: "Kurulu program", command: "Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object DisplayName | Select-Object -First 12 -ExpandProperty DisplayName" },
    { label: "Servisler", command: "Get-Service | Where-Object Status -eq 'Running' | Select-Object -First 12 Name" },
    { label: "Sistem bilgisi", command: "systeminfo | Select-String 'OS Name','OS Version','System Model','Total Physical Memory'" },
    { label: "Ağ bağlantıları", command: "netstat -ano | findstr LISTENING" },
  ],
  remote: [
    { label: "Makine adı", command: "hostname" },
    { label: "Disk", command: "df -h" },
    { label: "Bellek", command: "free -h" },
    { label: "İşlemler", command: "ps aux --sort=-%mem | head -12" },
    { label: "Servisler", command: "systemctl list-units --type=service --state=running --no-legend --no-pager | head -12" },
    { label: "Açık portlar", command: "ss -ltnp" },
    { label: "Kullanıcılar", command: "who; echo '---'; getent passwd | tail -10" },
    { label: "Günlük", command: "journalctl -n 20 --no-pager" },
  ],
};

export function TerminalWindow() {
  const { settings } = useSettings();

  const [target, setTarget] = useState<RunTarget>("local");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<{ command: string; message: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  // Çıktı geldikçe en alta kaydır
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [history, pending]);

  const execute = useCallback(
    async (raw: string, confirmed = false, targetOverride?: RunTarget) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const useTarget = targetOverride ?? target;
      setRunning(true);
      setPending(null);
      if (!commands.includes(trimmed)) setCommands((list) => [...list, trimmed]);

      try {
        const result = await runCommand(trimmed, {
          target: useTarget,
          confirmed,
          executor: "auto",
          bridgeUrl: settings.bridge.url,
          bridgeToken: settings.bridge.token || undefined,
          timeoutSeconds: 120,
        });

        // Komut politikası onay istiyor
        if (result.needsConfirmation) {
          setPending({ command: trimmed, message: result.message });
          return;
        }

        counter.current += 1;
        setHistory((list) => [
          ...list,
          {
            id: counter.current,
            command: trimmed,
            target: useTarget,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            ok: result.ok,
          },
        ]);
      } finally {
        setRunning(false);
        inputRef.current?.focus();
      }
    },
    [target, commands, settings.bridge.url, settings.bridge.token],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      void execute(command);
      setCommand("");
      setHistoryIndex(-1);
      return;
    }
    // Geçmişte gezinme
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!commands.length) return;
      const next = historyIndex < 0 ? commands.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setCommand(commands[next] ?? "");
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
    if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      setHistory([]);
    }
  }

  return (
    <div className="app term">
      {/* --- Araç çubuğu --- */}
      <div className="app__toolbar">
        <h2 className="app__title">Terminal</h2>

        <div className="term__targets" role="group" aria-label="Çalıştırma hedefi">
          <button
            type="button"
            className={`term__target${target === "local" ? " is-active" : ""}`}
            onClick={() => setTarget("local")}
            title="Bu bilgisayarda çalıştır (yerel köprü)"
          >
            🖥 Yerel
          </button>
          <button
            type="button"
            className={`term__target${target === "remote" ? " is-active" : ""}`}
            onClick={() => setTarget("remote")}
            title="Uzak sunucuda çalıştır (SSH)"
          >
            🌐 Uzak
          </button>
        </div>

        <span className="app__spacer" />
        <span className="app__subtitle mono">{history.length} komut</span>
        <button className="app-btn" onClick={() => setHistory([])} disabled={!history.length}>
          🗑 Temizle
        </button>
      </div>

      {/* --- Kısayol komutlar --- */}
      <div className="term__quick">
        {QUICK[target].map((item) => (
          <button
            key={item.label}
            type="button"
            className="term__chip"
            title={item.command}
            onClick={() => void execute(item.command, false)}
            disabled={running}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* --- Çıktı --- */}
      <div
        className="term__out mono"
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        role="log"
        aria-live="polite"
      >
        {history.length === 0 && !pending && (
          <div className="term__welcome">
            <p>
              <strong>Pixtool Terminal</strong> — {target === "local" ? "yerel makine" : "uzak sunucu"}
            </p>
            <p className="term__dim">
              {target === "local"
                ? "Komutlar bu bilgisayarda çalışır (yerel köprü gerekir)."
                : "Komutlar yapılandırılmış uzak sunucuda SSH ile çalışır."}
            </p>
            <p className="term__dim">↑/↓ geçmiş · Ctrl+L temizle · Enter çalıştır</p>
          </div>
        )}

        {history.map((entry) => (
          <div key={entry.id} className="term__entry">
            <div className="term__cmd">
              <span className="term__prompt">{entry.target === "local" ? "🖥" : "🌐"} $</span>
              {entry.command}
            </div>
            {entry.stdout && <pre className="term__stdout">{entry.stdout}</pre>}
            {entry.stderr && <pre className="term__stderr">{entry.stderr}</pre>}
            <div className={`term__meta${entry.ok ? "" : " is-bad"}`}>
              çıkış: {entry.exitCode ?? "—"} · {entry.durationMs} ms
              {entry.ok ? "" : " · komut başarısız"}
            </div>
          </div>
        ))}

        {/* Onay bekleyen komut */}
        {pending && (
          <div className="term__confirm">
            <p className="term__confirm-text">
              ⚠ Komut politikası <strong>onay</strong> gerektiriyor:
            </p>
            <pre className="term__confirm-cmd">{pending.command}</pre>
            <p className="term__dim">{pending.message}</p>
            <div className="term__confirm-actions">
              <button className="app-btn" onClick={() => setPending(null)}>
                Vazgeç
              </button>
              <button
                className="app-btn app-btn--primary"
                onClick={() => void execute(pending.command, true)}
                disabled={running}
              >
                {running ? "…" : "✔ Onayla ve çalıştır"}
              </button>
            </div>
          </div>
        )}

        {running && (
          <div className="term__running">
            <span className="app-spinner" /> çalışıyor…
          </div>
        )}
      </div>

      {/* --- Girdi --- */}
      <div className="term__inputrow">
        <span className="term__prompt-label mono">{target === "local" ? "yerel" : "uzak"} $</span>
        <input
          ref={inputRef}
          className="app-input term__input"
          value={command}
          autoFocus
          spellCheck={false}
          placeholder={target === "local" ? "hostname" : "uptime -p"}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={running}
        />
        <button
          className="app-btn app-btn--primary"
          onClick={() => {
            void execute(command);
            setCommand("");
          }}
          disabled={running || !command.trim()}
        >
          ▶ Çalıştır
        </button>
      </div>
    </div>
  );
}
