/**
 * Kullanıcılar — üç kaynak tek pencerede.
 *
 * | Sekme | Kaynak | Nerede |
 * |---|---|---|
 * | **Yerel makine** | yerel köprü `Get-LocalUser` / `getent passwd` | Arayüzün açık olduğu makine |
 * | **Uzak sunucu** | API → SSH `getent passwd` | Yapılandırılmış sunucu |
 * | **Uygulama** | NocoDB `Users` tablosu | Pano kullanıcıları |
 *
 * Oturum açmış kullanıcılar da listelenir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "../../desktop/ui/Card";
import { describeError } from "../../lib/api";
import { fetchTableRecords, formatCell } from "../../lib/databaseApi";
import { runCommand, type RunTarget } from "../../lib/runTarget";
import { useSettings } from "../../settings";
import "../apps.css";
import "./users-window.css";

/** Birleşik kullanıcı kaydı. */
interface SystemUser {
  username: string;
  uid: string;
  home: string;
  shell: string;
  /** Etkin mi (Windows) / var mı */
  enabled: boolean | null;
  /** Son oturum (varsa) */
  lastLogon: string | null;
}

type Source = "local" | "remote" | "app";

/** Kabuk erişimi olan hesaplar. */
function isInteractiveShell(shell: string): boolean {
  return /(bash|zsh|sh|fish|powershell|pwsh)$/i.test(shell);
}

/** Linux `getent passwd` çıktısını çözümler. */
function parsePasswd(stdout: string): SystemUser[] {
  const users: SystemUser[] = [];
  for (const line of stdout.split("\n")) {
    const parts = line.split(":");
    if (parts.length < 7) continue;
    users.push({
      username: parts[0] ?? "",
      uid: parts[2] ?? "",
      home: parts[5] ?? "",
      shell: parts[6] ?? "",
      enabled: null,
      lastLogon: null,
    });
  }
  return users;
}

/** Windows `Get-LocalUser` çıktısını çözümler (`Ad|Enabled|LastLogon`). */
function parseLocalUsers(stdout: string): SystemUser[] {
  const users: SystemUser[] = [];
  for (const line of stdout.split("\n")) {
    const text = line.trim();
    if (!text || text.startsWith("Name")) continue;
    const parts = text.split("|");
    if (!parts[0]) continue;
    users.push({
      username: parts[0].trim(),
      uid: "—",
      home: "—",
      shell: "Windows",
      enabled: parts[1] ? parts[1].trim().toLowerCase() === "true" : null,
      lastLogon: parts[2] && parts[2].trim() !== "" ? parts[2].trim().slice(0, 19) : null,
    });
  }
  return users;
}

export function UsersWindow() {
  const { settings } = useSettings();

  const [source, setSource] = useState<Source>("local");
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [appUsers, setAppUsers] = useState<Record<string, unknown>[]>([]);
  const [appColumns, setAppColumns] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyInteractive, setOnlyInteractive] = useState(true);

  /** Yerel/uzak sistem kullanıcılarını çeker. */
  const loadSystem = useCallback(
    async (target: RunTarget) => {
      setLoading(true);
      setError(null);
      setSessions([]);

      try {
        // Kullanıcı listesi (hedefe göre farklı komut)
        const isWindows = /Windows/i.test(navigator.userAgent);
        const listCommand =
          target === "remote"
            ? "getent passwd"
            : isWindows
              ? "Get-LocalUser | ForEach-Object { \"$($_.Name)|$($_.Enabled)|$($_.LastLogon)\" }"
              : "getent passwd";

        const listResult = await runCommand(listCommand, {
          target,
          executor: "auto",
          confirmed: true,
          bridgeUrl: settings.bridge.url,
          bridgeToken: settings.bridge.token || undefined,
          timeoutSeconds: 60,
        });

        if (!listResult.ok) {
          setError(listResult.message || "Kullanıcı listesi alınamadı.");
          setUsers([]);
          return;
        }

        setUsers(
          target === "remote" || !isWindows
            ? parsePasswd(listResult.stdout)
            : parseLocalUsers(listResult.stdout),
        );

        // Oturum açmış kullanıcılar
        const sessionCommand =
          target === "remote"
            ? "who"
            : isWindows
              ? "query user"
              : "who";

        const sessionResult = await runCommand(sessionCommand, {
          target,
          executor: "auto",
          confirmed: true,
          bridgeUrl: settings.bridge.url,
          bridgeToken: settings.bridge.token || undefined,
          timeoutSeconds: 30,
        });

        if (sessionResult.ok) {
          setSessions(
            sessionResult.stdout
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 20),
          );
        }
      } catch (caught) {
        setError(describeError(caught));
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [settings.bridge.url, settings.bridge.token],
  );

  /** NocoDB `Users` tablosunu çeker. */
  const loadAppUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Kullanıcılar tablosunun kimliği backend `.env`'inden gelir;
      // tablo listesinden "Users" başlığını buluruz.
      const { fetchDatabaseTables } = await import("../../lib/databaseApi");
      const tables = await fetchDatabaseTables();
      const target = tables.find((table) => /^users?$/i.test(table.title ?? "")) ?? tables[0];

      if (!target) {
        setError("NocoDB'de kullanıcı tablosu bulunamadı.");
        setAppUsers([]);
        return;
      }

      const data = await fetchTableRecords(target.id, { limit: 100 });
      setAppUsers(data.records);
      setAppColumns(data.columns);
    } catch (caught) {
      setError(describeError(caught));
      setAppUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Kaynak değişince yükle
  useEffect(() => {
    setQuery("");
    if (source === "app") {
      void loadAppUsers();
    } else {
      void loadSystem(source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    return users.filter((user) => {
      if (onlyInteractive && user.shell && !user.shell.includes("Windows") && !isInteractiveShell(user.shell)) {
        return false;
      }
      if (!needle) return true;
      return (
        user.username.toLocaleLowerCase("tr").includes(needle) ||
        user.home.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [users, query, onlyInteractive]);

  const interactiveCount = users.filter(
    (user) => user.shell.includes("Windows") || isInteractiveShell(user.shell),
  ).length;

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Kullanıcılar</h2>

        {/* Kaynak sekmeleri */}
        <div className="users__tabs" role="tablist" aria-label="Kullanıcı kaynağı">
          {(
            [
              ["local", "🖥 Yerel makine"],
              ["remote", "🌐 Uzak sunucu"],
              ["app", "🗄 Uygulama"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              className={`users__tab${source === id ? " is-active" : ""}`}
              onClick={() => setSource(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="app__spacer" />

        <input
          className="app-input"
          type="search"
          placeholder="Ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={source === "app" ? !appUsers.length : !users.length}
        />

        {source !== "app" && (
          <label className="users__check">
            <input
              type="checkbox"
              checked={onlyInteractive}
              onChange={(event) => setOnlyInteractive(event.target.checked)}
            />
            Kabuk erişimi
          </label>
        )}

        <button
          className="app-btn app-btn--primary"
          onClick={() => (source === "app" ? void loadAppUsers() : void loadSystem(source))}
          disabled={loading}
        >
          {loading ? "…" : "⟳ Çek"}
        </button>
      </div>

      {error && <div className="app-msg app-msg--error">{error}</div>}

      {source !== "app" && (
        <div className="cards">
          <Card
            label="Toplam hesap"
            value={loading ? "…" : String(users.length)}
            tone="info"
            detail={source === "local" ? "Bu makine" : "Uzak sunucu"}
          />
          <Card
            label="Kabuk erişimi"
            value={loading ? "…" : String(interactiveCount)}
            tone="ok"
            detail="Oturum açabilen hesaplar"
          />
          <Card
            label="Açık oturum"
            value={String(sessions.length)}
            tone={sessions.length ? "ok" : "warn"}
            detail={sessions[0]?.slice(0, 40) ?? "kimse bağlı değil"}
          />
          <Card
            label="Devre dışı"
            value={String(users.filter((user) => user.enabled === false).length)}
            tone="warn"
            detail="Yalnızca Windows'ta raporlanır"
          />
        </div>
      )}

      <div className="app-panel" style={{ flex: 1, overflow: "auto", padding: 0 }}>
        {loading && (
          <div className="app-loading">
            <span className="app-spinner" /> Kullanıcılar okunuyor…
          </div>
        )}

        {/* --- Uygulama kullanıcıları (NocoDB) --- */}
        {!loading && source === "app" && (
          appUsers.length === 0 ? (
            <div className="app-empty">NocoDB kullanıcı kaydı bulunamadı</div>
          ) : (
            <table className="app-table">
              <thead>
                <tr>
                  {appColumns.map((column) => (
                    <th key={column}>{column.replace(/^(nc_|CreatedAt|UpdatedAt)/, "").trim() || column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appUsers
                  .filter((record) => {
                    const needle = query.trim().toLocaleLowerCase("tr");
                    if (!needle) return true;
                    return Object.values(record).some((value) =>
                      formatCell(value).toLocaleLowerCase("tr").includes(needle),
                    );
                  })
                  .map((record, index) => (
                    <tr key={index}>
                      {appColumns.map((column) => (
                        <td key={column}>{formatCell(record[column])}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          )
        )}

        {/* --- Sistem kullanıcıları --- */}
        {!loading && source !== "app" && (
          filtered.length === 0 ? (
            <div className="app-empty">
              <span aria-hidden="true">👥</span>
              {users.length === 0 ? "Veri yok — “Çek” düğmesine bas" : "Aramaya uyan hesap yok"}
            </div>
          ) : (
            <table className="app-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th style={{ width: 90 }}>Durum</th>
                  <th style={{ width: 170 }}>Son oturum</th>
                  <th>Ev dizini</th>
                  <th style={{ width: 200 }}>Kabuk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={`${user.username}-${user.uid}`}>
                    <td style={{ color: "var(--text-primary)" }}>{user.username}</td>
                    <td>
                      {user.enabled === null ? (
                        <span className="app-tag app-tag--muted">—</span>
                      ) : user.enabled ? (
                        <span className="app-tag">etkin</span>
                      ) : (
                        <span className="app-tag" style={{ color: "#ff8b82" }}>
                          devre dışı
                        </span>
                      )}
                    </td>
                    <td className="app-table__mono">{user.lastLogon ?? "—"}</td>
                    <td className="app-table__mono">{user.home}</td>
                    <td className="app-table__mono">{user.shell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* --- Açık oturumlar --- */}
        {!loading && source !== "app" && sessions.length > 0 && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-weak)" }}>
            <h4 className="app__subtitle" style={{ marginBottom: 6 }}>
              Açık oturumlar
            </h4>
            <pre className="app-code" style={{ maxHeight: 130 }}>
              {sessions.join("\n")}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
