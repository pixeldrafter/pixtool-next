/**
 * Dosya Yöneticisi — uzak dosya sistemi (SFTP, salt okunur).
 *
 * Backend `/api/v1/remote/list` uç noktasını kullanır.
 * Faz 3'te indirme/yükleme ve yerel köprü desteği eklenecek.
 */

import { useCallback, useEffect, useState } from "react";

import { describeError, fetchRemoteStatus, sftpList, type RemoteFile } from "../../lib/api";
import "../apps.css";

export function FilesWindow() {
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sshReady, setSshReady] = useState(false);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await sftpList(target);
      setEntries(data.entries);
      setPath(data.path);
    } catch (caught) {
      setError(describeError(caught));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRemoteStatus()
      .then((status) => {
        setSshReady(Boolean(status.default_host_set && status.paramiko_available));
        if (status.default_host_set) void load(".");
      })
      .catch(() => setSshReady(false));
  }, [load]);

  /** Üst dizine çık. */
  function goUp() {
    const parent = path.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
    void load(parent);
  }

  function formatSize(bytes: number, isDir: boolean): string {
    if (isDir) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Dosya Yöneticisi</h2>
        <button className="app-btn" onClick={() => void load("/")} disabled={!sshReady || loading}>
          /
        </button>
        <button className="app-btn" onClick={goUp} disabled={!sshReady || loading || path === "/"}>
          ↑ Üst dizin
        </button>
        <input
          className="app-input"
          style={{ flex: 1, minWidth: 200, fontFamily: "var(--font-mono)" }}
          type="text"
          value={path}
          disabled={!sshReady}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void load(path);
          }}
        />
        <button className="app-btn" onClick={() => void load(path)} disabled={!sshReady || loading}>
          ⟳
        </button>
      </div>

      {!sshReady && (
        <div className="app-msg app-msg--warn">
          Dosya yöneticisi SSH gerektirir. <code>.env</code> içinde{" "}
          <code>SSH_DEFAULT_HOST</code> / <code>SSH_DEFAULT_USER</code> doldurulmalı ve{" "}
          <code>paramiko</code> kurulu olmalı.
        </div>
      )}

      {error && <div className="app-msg app-msg--error">{error}</div>}

      <div className="app-panel" style={{ flex: 1, overflow: "auto", padding: 0 }}>
        {loading && entries.length === 0 && (
          <div className="app-loading">
            <span className="app-spinner" /> Dizin listeleniyor…
          </div>
        )}

        {!loading && entries.length === 0 && !error && sshReady && (
          <div className="app-empty">
            <span aria-hidden="true">📁</span>
            Dizin boş veya okunamadı
          </div>
        )}

        {entries.length > 0 && (
          <table className="app-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Ad</th>
                <th style={{ width: 110 }}>Boyut</th>
                <th style={{ width: 90 }}>İzin</th>
                <th style={{ width: 170 }}>Değişim</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  style={{ cursor: entry.is_dir ? "pointer" : "default" }}
                  onClick={() => {
                    if (entry.is_dir) void load(entry.path);
                  }}
                >
                  <td>{entry.is_dir ? "📁" : "📄"}</td>
                  <td className="app-table__mono">{entry.name}</td>
                  <td className="app-table__mono">{formatSize(entry.size_bytes, entry.is_dir)}</td>
                  <td className="app-table__mono">{entry.permissions ?? "—"}</td>
                  <td className="app-table__mono">
                    {entry.modified ? new Date(entry.modified).toLocaleString("tr-TR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
