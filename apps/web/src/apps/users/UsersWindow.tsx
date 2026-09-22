/**
 * Kullanıcılar — uzak sistemdeki kullanıcı hesapları.
 *
 * Veri kaynağı: `/api/v1/remote/exec` ile `getent passwd`.
 * NocoDB `users` tablosu bağlandığında (Faz 2 sonu) oradan da okunacak.
 */

import { useCallback, useEffect, useState } from "react";

import { describeError, fetchRemoteStatus, sshExec } from "../../lib/api";
import "../apps.css";

interface SystemUser {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
}

/** Kabuk erişimi olan kullanıcılar (sistem hesapları hariç). */
function isInteractiveShell(shell: string): boolean {
  return /(bash|zsh|sh|fish|powershell|pwsh)$/i.test(shell);
}

export function UsersWindow() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sshReady, setSshReady] = useState(false);
  const [onlyInteractive, setOnlyInteractive] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sshExec("getent passwd", 20);
      const parsed: SystemUser[] = [];

      for (const line of result.stdout.split("\n")) {
        const parts = line.split(":");
        if (parts.length < 7) continue;
        const uid = Number(parts[2]);
        parsed.push({
          username: parts[0] ?? "",
          uid,
          gid: Number(parts[3]),
          home: parts[5] ?? "",
          shell: parts[6] ?? "",
        });
      }

      setUsers(parsed);
    } catch (caught) {
      setError(describeError(caught));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRemoteStatus()
      .then((status) => {
        const ready = Boolean(status.default_host_set && status.paramiko_available);
        setSshReady(ready);
      })
      .catch(() => setSshReady(false));
  }, []);

  const filtered = users.filter((user) => {
    if (onlyInteractive && !isInteractiveShell(user.shell)) return false;
    if (!query.trim()) return true;
    const normalized = query.trim().toLocaleLowerCase("tr");
    return (
      user.username.toLocaleLowerCase("tr").includes(normalized) ||
      user.home.toLocaleLowerCase("tr").includes(normalized)
    );
  });

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Kullanıcılar</h2>
        <span className="app__subtitle">
          {users.length > 0 ? `${filtered.length} / ${users.length} hesap` : "uzak sistem"}
        </span>
        <span className="app__spacer" />
        <input
          className="app-input"
          type="search"
          placeholder="Kullanıcı ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={users.length === 0}
        />
        <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyInteractive}
            onChange={(event) => setOnlyInteractive(event.target.checked)}
          />
          Yalnızca kabuk erişimi
        </label>
        <button
          className="app-btn app-btn--primary"
          onClick={() => void load()}
          disabled={!sshReady || loading}
        >
          {loading ? "…" : "Kullanıcıları çek"}
        </button>
      </div>

      {!sshReady && (
        <div className="app-msg app-msg--warn">
          Bu ekran SSH üzerinden çalışır. <code>.env</code> içinde{" "}
          <code>SSH_DEFAULT_HOST</code> / <code>SSH_DEFAULT_USER</code> doldurulmalı.
        </div>
      )}

      {error && <div className="app-msg app-msg--error">{error}</div>}

      <div className="app-panel" style={{ flex: 1, overflow: "auto", padding: 0 }}>
        {users.length === 0 && !loading && !error && (
          <div className="app-empty">
            <span aria-hidden="true">👥</span>
            {sshReady ? (
              <>
                <strong>Henüz veri yok</strong>
                <p>&quot;Kullanıcıları çek&quot; düğmesine basarak uzak sistemden okuyun.</p>
              </>
            ) : (
              "SSH yapılandırılmadı."
            )}
          </div>
        )}

        {loading && (
          <div className="app-loading">
            <span className="app-spinner" /> Kullanıcılar okunuyor…
          </div>
        )}

        {filtered.length > 0 && (
          <table className="app-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th style={{ width: 80 }}>UID</th>
                <th style={{ width: 80 }}>GID</th>
                <th>Ev dizini</th>
                <th style={{ width: 180 }}>Kabuk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={`${user.uid}-${user.username}`}>
                  <td style={{ color: "var(--text-primary)" }}>{user.username}</td>
                  <td className="app-table__mono">{user.uid}</td>
                  <td className="app-table__mono">{user.gid}</td>
                  <td className="app-table__mono">{user.home}</td>
                  <td className="app-table__mono">{user.shell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
