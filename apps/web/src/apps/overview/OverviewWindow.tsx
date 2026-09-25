/**
 * Genel Bakış — gösterge paneli.
 *
 * Üç veri kaynağı tek ekranda:
 *
 * | Bölüm | Kaynak | Ne gösterir |
 * |---|---|---|
 * | Entegrasyonlar | `/api/v1/status` | Backend, NocoDB, n8n, Telegram |
 * | Bu makine | yerel köprü `/info` | CPU, RAM, disk, ağ, GPU, süreçler |
 * | Uzak sunucu | API → SSH | OS, çekirdek, yük, RAM, disk, süreçler, oturumlar |
 *
 * Sahte veri gösterilmez; erişilemeyen alan açıkça "erişilemedi" olarak işaretlenir.
 */

import { useCallback, useEffect, useState } from "react";

import { Card } from "../../desktop/ui/Card";
import {
  describeError,
  fetchRemoteInfo,
  fetchRemoteStatus,
  fetchScripts,
  fetchStatus,
  type RemoteInfoResponse,
  type RemoteStatus,
  type StatusResponse,
} from "../../lib/api";
import {
  fetchBridgeInfo,
  humanBytes,
  humanDuration,
  type BridgeInfo,
} from "../../lib/bridgeInfo";
import { runCommand } from "../../lib/runTarget";
import { useSettings } from "../../settings";
import "../apps.css";
import "./overview-window.css";

/** Yüzdeyi 0-100 aralığına kilitler. */
function clampPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function OverviewWindow() {
  const { settings } = useSettings();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfoResponse | null>(null);
  const [remoteExtra, setRemoteExtra] = useState<{ processes: string[]; ports: string[] }>({
    processes: [],
    ports: [],
  });
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [bridge, setBridge] = useState<BridgeInfo | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const [scriptCount, setScriptCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // --- Backend durumu ---
    try {
      setStatus(await fetchStatus());
    } catch (caught) {
      setError(describeError(caught));
    }

    // --- Script kütüphanesi ---
    void fetchScripts()
      .then((data) => setScriptCount(data.count))
      .catch(() => setScriptCount(null));

    // --- Yerel köprü (paralel, kritik degil) ---
    const bridgePromise = fetchBridgeInfo(["system", "cpu", "memory", "disks", "network", "gpu", "processes", "services"], {
      baseUrl: settings.bridge.url,
      token: settings.bridge.token || undefined,
    })
      .then((info) => {
        setBridge(info);
        setBridgeError(null);
      })
      .catch((caught) => {
        setBridge(null);
        setBridgeError(describeError(caught));
      });

    // --- Uzak sunucu ---
    const remotePromise = (async () => {
      try {
        const sshStatus = await fetchRemoteStatus();
        setRemoteStatus(sshStatus);
        if (!sshStatus.default_host_set || !sshStatus.paramiko_available) return;

        try {
          setRemoteInfo(await fetchRemoteInfo());
          setRemoteError(null);
        } catch (caught) {
          setRemoteInfo(null);
          setRemoteError(describeError(caught));
          return;
        }

        // Ek komutlar — top süreçler ve dinlenen portlar
        const options = { target: "remote" as const, executor: "auto" as const, confirmed: true, timeoutSeconds: 25 };

        const [procResult, portResult] = await Promise.all([
          runCommand("ps -eo pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -6", options).catch(() => null),
          runCommand("ss -tulnH 2>/dev/null | wc -l", options).catch(() => null),
        ]);

        setRemoteExtra({
          processes: procResult?.ok
            ? procResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5)
            : [],
          ports: portResult?.ok
            ? portResult.stdout
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 8)
            : [],
        });
      } catch (caught) {
        setRemoteStatus(null);
        setRemoteError(describeError(caught));
      }
    })();

    await Promise.all([bridgePromise, remotePromise]);
    setLoading(false);
  }, [settings.bridge.url, settings.bridge.token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !status && !bridge) {
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
          Backend&apos;e ulaşılamadı: {error}
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
  const n8n = status?.integrations.n8n;
  const telegram = status?.integrations.telegram;

  const localCpu = clampPercent(bridge?.cpu?.percent);
  const localMem = clampPercent(bridge?.memory?.percent);
  const localPrimaryDisk = bridge?.disks?.find((disk) => disk.mountpoint && disk.percent !== undefined);
  const localDisk = clampPercent(localPrimaryDisk?.percent);

  const remoteMem = clampPercent(
    remoteInfo?.memory_total_mb && remoteInfo.memory_used_mb
      ? (remoteInfo.memory_used_mb / remoteInfo.memory_total_mb) * 100
      : null,
  );
  const remoteDisk = clampPercent(
    remoteInfo?.disk_total_gb && remoteInfo.disk_used_gb
      ? (remoteInfo.disk_used_gb / remoteInfo.disk_total_gb) * 100
      : null,
  );

  const sshReady = Boolean(remoteStatus?.default_host_set && remoteStatus.paramiko_available);

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Genel Bakış</h2>
        <span className="app__subtitle">Sistem durumu, entegrasyonlar, kaynaklar</span>
        <span className="app__spacer" />
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "Yenileniyor…" : "⟳ Yenile"}
        </button>
      </div>

      {/* ---------- Entegrasyonlar ---------- */}
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
          detail={nocodb?.base_url ?? "yapılandırılmamış"}
        />
        <Card
          label="n8n (otomasyon)"
          value={n8n?.configured ? "Yapılandırıldı" : "Eksik"}
          tone={n8n?.configured ? "ok" : "warn"}
          detail={n8n?.configured ? "Webhook hazır" : "N8N_BASE_URL / webhook"}
        />
        <Card
          label="Telegram (OTP)"
          value={telegram?.configured ? "Hazır" : "Eksik"}
          tone={telegram?.configured ? "ok" : "warn"}
          detail={telegram?.configured ? "Bot token + chat id" : "TELEGRAM_BOT_TOKEN / CHAT_ID"}
        />
      </div>

      {/* ---------- Bu makine ---------- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              🖥 Bu Makine
            </h3>
            <p className="app__subtitle">
              {bridge
                ? `${bridge.system?.hostname ?? "—"} · ${bridge.system?.os ?? "—"}${
                    bridge.duration_ms ? ` · ${bridge.duration_ms} ms` : ""
                  }`
                : "yerel köprü"}
            </p>
          </div>
          <span className="app__spacer" />
          {bridge && (
            <span className="app-tag">
              köprü v{bridge.bridge_version ?? "?"}
              {bridge.psutil === false ? " · psutil yok" : ""}
            </span>
          )}
        </div>

        {bridgeError ? (
          <div className="app-msg app-msg--warn" style={{ margin: 0 }}>
            {bridgeError}
          </div>
        ) : (
          <>
            {/* Ölçerler */}
            <div className="ov__gauges">
              <Gauge label="İşlemci" percent={localCpu} detail={bridge?.cpu?.model?.slice(0, 34)} />
              <Gauge
                label="Bellek"
                percent={localMem}
                detail={
                  bridge?.memory
                    ? `${humanBytes(bridge.memory.used_bytes)} / ${humanBytes(bridge.memory.total_bytes)}`
                    : undefined
                }
              />
              <Gauge
                label="Disk"
                percent={localDisk}
                detail={
                  localPrimaryDisk
                    ? `${localPrimaryDisk.mountpoint} · ${humanBytes(localPrimaryDisk.free_bytes)} boş`
                    : undefined
                }
              />
            </div>

            {/* Künye */}
            <div className="ov__facts">
              <Fact label="Çalışma süresi" value={humanDuration(bridge?.system?.uptime_seconds)} />
              <Fact label="Çekirdek" value={String(bridge?.cpu?.cores_logical ?? "—")} />
              <Fact label="Mimari" value={bridge?.system?.arch ?? "—"} />
              <Fact label="Kullanıcı" value={bridge?.system?.user ?? "—"} />
              <Fact label="Yerel IP" value={bridge?.network?.primary_ip ?? "—"} />
              <Fact label="Dış IP" value={bridge?.network?.external_ip ?? "kapalı"} />
              <Fact
                label="Gönderilen"
                value={bridge?.network ? humanBytes(bridge.network.bytes_sent) : "—"}
              />
              <Fact
                label="Alınan"
                value={bridge?.network ? humanBytes(bridge.network.bytes_recv) : "—"}
              />
              <Fact
                label="Servis"
                value={
                  bridge?.services
                    ? `${bridge.services.running ?? 0} çalışıyor / ${bridge.services.total ?? 0}`
                    : "—"
                }
              />
              <Fact label="Süreç" value={String(bridge?.processes?.total ?? "—")} />
            </div>

            {/* GPU */}
            {bridge?.gpu && bridge.gpu.length > 0 && (
              <div className="ov__chips">
                {bridge.gpu.map((gpu, index) => (
                  <span key={index} className="ov__chip">
                    🎮 {gpu.name}
                    {gpu.memory_total_mb ? ` · ${gpu.memory_total_mb} MB` : ""}
                    {gpu.temperature_c ? ` · ${gpu.temperature_c}°C` : ""}
                  </span>
                ))}
              </div>
            )}

            {/* Disks */}
            {bridge?.disks && bridge.disks.length > 0 && (
              <div className="ov__bars">
                {bridge.disks
                  .filter((disk) => (disk.total_bytes ?? 0) > 0)
                  .slice(0, 5)
                  .map((disk, index) => (
                    <DiskBar
                      key={index}
                      label={disk.mountpoint ?? disk.device ?? "?"}
                      percent={clampPercent(disk.percent) ?? 0}
                      detail={`${humanBytes(disk.used_bytes)} / ${humanBytes(disk.total_bytes)}`}
                    />
                  ))}
              </div>
            )}

            {/* Top süreçler */}
            {bridge?.processes?.by_cpu && bridge.processes.by_cpu.length > 0 && (
              <table className="app-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>En çok CPU kullanan süreçler</th>
                    <th style={{ width: 80 }}>CPU</th>
                    <th style={{ width: 80 }}>RAM</th>
                  </tr>
                </thead>
                <tbody>
                  {bridge.processes.by_cpu.slice(0, 5).map((process, index) => (
                    <tr key={index}>
                      <td className="app-table__mono">
                        {process.name} <span style={{ opacity: 0.5 }}>#{process.pid}</span>
                      </td>
                      <td className="app-table__mono">
                        {(process.cpu_percent ?? 0).toFixed(1)}%
                      </td>
                      <td className="app-table__mono">
                        {(process.memory_percent ?? 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* ---------- Uzak sunucu ---------- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              🌐 Uzak Sunucu
            </h3>
            <p className="app__subtitle">
              {sshReady
                ? `${remoteStatus?.default_host ?? "—"} · ${remoteStatus?.default_user ?? "—"}`
                : "SSH yapılandırılmamış"}
            </p>
          </div>
          <span className="app__spacer" />
          {remoteInfo?.hostname && <span className="app-tag">{remoteInfo.hostname}</span>}
        </div>

        {!sshReady && (
          <div className="app-msg app-msg--warn" style={{ margin: 0 }}>
            Uzak bilgi için <code>.env</code> içinde <code>SSH_DEFAULT_HOST</code> /{" "}
            <code>SSH_DEFAULT_USER</code> doldurulmalı ve <code>paramiko</code> kurulu olmalı.
          </div>
        )}

        {sshReady && remoteError && (
          <div className="app-msg app-msg--error" style={{ margin: 0 }}>
            {remoteError}
          </div>
        )}

        {sshReady && remoteInfo && (
          <>
            <div className="ov__gauges">
              <Gauge
                label="Bellek"
                percent={remoteMem}
                detail={`${remoteInfo.memory_used_mb ?? "—"} / ${remoteInfo.memory_total_mb ?? "—"} MB`}
              />
              <Gauge
                label="Disk"
                percent={remoteDisk}
                detail={`${remoteInfo.disk_used_gb ?? "—"} / ${remoteInfo.disk_total_gb ?? "—"} GB`}
              />
              <Gauge label="Çekirdek" percent={null} detail={`${remoteInfo.cpu_cores ?? "—"} çekirdek`} />
            </div>

            <div className="ov__facts">
              <Fact label="İşletim sistemi" value={remoteInfo.os ?? "—"} />
              <Fact label="Çekirdek" value={remoteInfo.kernel ?? "—"} />
              <Fact label="Çalışma süresi" value={remoteInfo.uptime ?? "—"} />
              <Fact label="Hostname" value={remoteInfo.hostname ?? "—"} />
              <Fact
                label="Bellek (toplam)"
                value={remoteInfo.memory_total_mb ? `${remoteInfo.memory_total_mb} MB` : "—"}
              />
              <Fact
                label="Disk (toplam)"
                value={remoteInfo.disk_total_gb ? `${remoteInfo.disk_total_gb} GB` : "—"}
              />
            </div>

            {remoteExtra.ports.length > 0 && (
              <div className="ov__chips">
                <span className="ov__chip">🔌 Açık port sayısı: {remoteExtra.ports[0]}</span>
              </div>
            )}

            {remoteExtra.processes.length > 0 && (
              <table className="app-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Uzak sunucuda en çok CPU kullanan süreçler</th>
                  </tr>
                </thead>
                <tbody>
                  {remoteExtra.processes.slice(1).map((line, index) => (
                    <tr key={index}>
                      <td className="app-table__mono">{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* ---------- Kütüphane ---------- */}
      <div className="cards">
        <Card
          label="Script kütüphanesi"
          value={scriptCount === null ? "—" : String(scriptCount)}
          tone={scriptCount ? "ok" : "warn"}
          detail="Hazır araçlar"
        />
        <Card
          label="Veri adaptörü"
          value={status?.features.db_adapter ?? "—"}
          tone="info"
          detail="Kişisel kullanımda NocoDB"
        />
        <Card
          label="Komut politikası"
          value={status?.features.command_policy ?? "—"}
          tone={status?.features.command_policy === "confirm" ? "warn" : "ok"}
          detail={
            status?.features.command_policy === "confirm"
              ? "Çalıştırma öncesi onay ister"
              : "Doğrudan çalıştırır"
          }
        />
        <Card
          label="Yerel köprü"
          value={bridge ? "Bağlı" : "Yok"}
          tone={bridge ? "ok" : "warn"}
          detail={settings.bridge.url}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Yardımcı bileşenler                                                */
/* ------------------------------------------------------------------ */

function Gauge({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number | null;
  detail?: string;
}) {
  const tone = percent === null ? "muted" : percent >= 90 ? "danger" : percent >= 70 ? "warn" : "ok";

  return (
    <div className={`ov__gauge is-${tone}`}>
      <div className="ov__gauge-head">
        <span className="ov__gauge-label">{label}</span>
        <span className="ov__gauge-value">{percent === null ? "—" : `${percent}%`}</span>
      </div>
      <div className="ov__gauge-track">
        <div className="ov__gauge-fill" style={{ width: `${percent ?? 0}%` }} />
      </div>
      {detail && <div className="ov__gauge-detail">{detail}</div>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="ov__fact">
      <span className="ov__fact-label">{label}</span>
      <span className="ov__fact-value" title={value}>
        {value}
      </span>
    </div>
  );
}

function DiskBar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const tone = percent >= 90 ? "danger" : percent >= 75 ? "warn" : "ok";
  return (
    <div className={`ov__disk is-${tone}`}>
      <span className="ov__disk-label" title={label}>
        💾 {label}
      </span>
      <div className="ov__disk-track">
        <div className="ov__disk-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="ov__disk-value">{percent}%</span>
      <span className="ov__disk-detail">{detail}</span>
    </div>
  );
}
