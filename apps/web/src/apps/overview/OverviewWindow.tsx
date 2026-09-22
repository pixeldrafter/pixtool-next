/**
 * Genel Bakış — gösterge paneli.
 *
 * Gerçek veriler: `/api/v1/status` (bağlantılar) ve mümkünse
 * `/api/v1/remote/info` (uzak sistem kaynakları).
 * Sahte veri gösterilmez; erişilemeyen alan açıkça işaretlenir.
 */

import { useCallback, useEffect, useState } from "react";

import { Card } from "../../desktop/ui/Card";
import {
  describeError,
  fetchRemoteInfo,
  fetchRemoteStatus,
  fetchStatus,
  type RemoteInfoResponse,
  type RemoteStatus,
  type StatusResponse,
} from "../../lib/api";
import "../apps.css";

export function OverviewWindow() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfoResponse | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [backend, sshStatus] = await Promise.all([
        fetchStatus(),
        fetchRemoteStatus().catch(() => null),
      ]);
      setStatus(backend);
      setRemoteStatus(sshStatus);

      // SSH yapılandırılmışsa uzak sistem bilgisini de çek
      if (sshStatus?.default_host_set) {
        try {
          const info = await fetchRemoteInfo();
          setRemoteInfo(info);
          setRemoteError(null);
        } catch (caught) {
          setRemoteInfo(null);
          setRemoteError(describeError(caught));
        }
      }
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !status) {
    return (
      <div className="app">
        <div className="app-loading">
          <span className="app-spinner" /> Veriler yükleniyor…
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="app">
        <div className="app-msg app-msg--error">
          Backend'e ulaşılamadı: {error}
          <div style={{ marginTop: 8 }}>
            <button className="app-btn" onClick={() => void load()}>
              Tekrar dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nocodb = status?.integrations.nocodb;
  const memPercent =
    remoteInfo?.memory_total_mb && remoteInfo.memory_used_mb
      ? Math.round((remoteInfo.memory_used_mb / remoteInfo.memory_total_mb) * 100)
      : null;
  const diskPercent =
    remoteInfo?.disk_total_gb && remoteInfo.disk_used_gb
      ? Math.round((remoteInfo.disk_used_gb / remoteInfo.disk_total_gb) * 100)
      : null;

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Genel Bakış</h2>
        <span className="app__subtitle">Sistem durumu ve entegrasyonlar</span>
        <span className="app__spacer" />
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "Yenileniyor…" : "⟳ Yenile"}
        </button>
      </div>

      {/* --- Entegrasyonlar --- */}
      <div className="cards">
        <Card
          label="Backend API"
          value={`v${status?.app.version ?? "—"}`}
          tone="ok"
          detail={`${status?.app.name ?? "—"} · ${status?.app.env ?? "—"}`}
        />
        <Card
          label="NocoDB (veri)"
          value={nocodb?.ok ? "Bağlı" : nocodb?.placeholder ? "Şablon adres" : "Bağlı değil"}
          tone={nocodb?.ok ? "ok" : "warn"}
          detail={nocodb?.detail ?? ""}
        />
        <Card
          label="n8n (otomasyon)"
          value={status?.integrations.n8n.configured ? "Yapılandırıldı" : "Boş"}
          tone={status?.integrations.n8n.configured ? "ok" : "warn"}
          detail="Login / OTP webhook"
        />
        <Card
          label="Telegram (OTP)"
          value={status?.integrations.telegram.configured ? "Yapılandırıldı" : "Boş"}
          tone={status?.integrations.telegram.configured ? "ok" : "warn"}
          detail="Bildirim ve OTP kanalı"
        />
      </div>

      {/* --- Uzak sistem --- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              Uzak Sistem (SSH)
            </h3>
            <p className="app__subtitle">
              {remoteStatus?.default_host_set
                ? `${remoteStatus.default_user ?? "?"}@${remoteStatus.default_host ?? "?"}`
                : "SSH hedefi tanımlı değil (.env → SSH_DEFAULT_HOST)"}
            </p>
          </div>
          <span className="app__spacer" />
          {remoteStatus && (
            <span className={`app-tag${remoteStatus.paramiko_available ? "" : " app-tag--muted"}`}>
              {remoteStatus.paramiko_available ? "paramiko hazır" : "paramiko yok"}
            </span>
          )}
        </div>

        {!remoteStatus?.default_host_set && (
          <div className="app-msg app-msg--info">
            Uzak sistem bilgisi için <code>.env</code> içinde <code>SSH_DEFAULT_HOST</code>,{" "}
            <code>SSH_DEFAULT_USER</code> ve <code>SSH_DEFAULT_PORT</code> doldurulmalı.
          </div>
        )}

        {remoteError && <div className="app-msg app-msg--warn">Uzak bilgi alınamadı: {remoteError}</div>}

        {remoteInfo && (
          <>
            <dl className="app-facts">
              <div>
                <dt>Ana makine</dt>
                <dd>{remoteInfo.hostname ?? "—"}</dd>
              </div>
              <div>
                <dt>İşletim sistemi</dt>
                <dd>{remoteInfo.os ?? "—"}</dd>
              </div>
              <div>
                <dt>Çekirdek</dt>
                <dd>{remoteInfo.kernel ?? "—"}</dd>
              </div>
              <div>
                <dt>Çalışma süresi</dt>
                <dd>{remoteInfo.uptime ?? "—"}</dd>
              </div>
              <div>
                <dt>CPU çekirdeği</dt>
                <dd>{remoteInfo.cpu_cores ?? "—"}</dd>
              </div>
              <div>
                <dt>Bellek</dt>
                <dd>
                  {remoteInfo.memory_used_mb && remoteInfo.memory_total_mb
                    ? `${remoteInfo.memory_used_mb} / ${remoteInfo.memory_total_mb} MB`
                    : "—"}
                </dd>
              </div>
            </dl>

            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
              {memPercent !== null && <Gauge label="Bellek" percent={memPercent} />}
              {diskPercent !== null && <Gauge label="Disk" percent={diskPercent} />}
            </div>
          </>
        )}
      </div>

      {/* --- Uyarılar --- */}
      {status && status.warnings.length > 0 && (
        <div className="app-msg app-msg--warn">
          <strong>{status.warnings.length} uyarı</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {status.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Basit yüzde göstergesi (SVG halka). */
function Gauge({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tone = clamped > 90 ? "var(--error)" : clamped > 70 ? "var(--warn)" : "var(--accent)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
        <circle cx="43" cy="43" r={radius} fill="none" stroke="var(--border-weak)" strokeWidth="7" />
        <circle
          cx="43"
          cy="43"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 43 43)"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <text
          x="43"
          y="47"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="15"
          fontFamily="var(--font-mono)"
        >
          {clamped}%
        </text>
      </svg>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}
