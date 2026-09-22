/**
 * Kaynaklar — sistem kaynakları ve cihaz bilgisi.
 *
 * İki kaynak birleştirilir:
 *   • Bu makine (tarayıcının gerçekten okuyabildikleri)
 *   • Uzak sunucu (SSH yapılandırılmışsa)
 *
 * Sahte veri gösterilmez; erişilemeyen alanlar açıkça işaretlenir.
 */

import { useCallback, useEffect, useState } from "react";

import { probeMachine, type MachineInfo } from "../../console/probe";
import {
  describeError,
  fetchRemoteInfo,
  fetchRemoteStatus,
  type RemoteInfoResponse,
  type RemoteStatus,
} from "../../lib/api";
import "../apps.css";

export function ResourcesWindow() {
  const [local, setLocal] = useState<MachineInfo | null>(null);
  const [remote, setRemote] = useState<RemoteInfoResponse | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const info = await probeMachine();
    setLocal(info);

    try {
      const status = await fetchRemoteStatus();
      setRemoteStatus(status);
      if (status.default_host_set) {
        try {
          setRemote(await fetchRemoteInfo());
          setRemoteError(null);
        } catch (caught) {
          setRemote(null);
          setRemoteError(describeError(caught));
        }
      }
    } catch {
      setRemoteStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Kaynaklar</h2>
        <span className="app__subtitle">Bu makine ve uzak sunucu kapasitesi</span>
        <span className="app__spacer" />
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "⟳ Yenile"}
        </button>
      </div>

      {/* --- Bu makine --- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              Bu Makine
            </h3>
            <p className="app__subtitle">
              Tarayıcının gerçekten okuyabildiği değerler — köprü gerekmez
            </p>
          </div>
        </div>

        {!local && (
          <div className="app-loading">
            <span className="app-spinner" /> Taranıyor…
          </div>
        )}

        {local && (
          <dl className="app-facts">
            <div>
              <dt>Platform</dt>
              <dd>{local.browser.platform || "—"}</dd>
            </div>
            <div>
              <dt>Mantıksal çekirdek</dt>
              <dd>{local.hardware.logicalCores ?? "—"}</dd>
            </div>
            <div>
              <dt>Cihaz belleği</dt>
              <dd>{local.hardware.deviceMemoryGb ? `${local.hardware.deviceMemoryGb} GB` : "—"}</dd>
            </div>
            <div>
              <dt>Ekran</dt>
              <dd>{local.hardware.screen}</dd>
            </div>
            <div>
              <dt>Piksel oranı</dt>
              <dd>{local.hardware.pixelRatio}×</dd>
            </div>
            <div>
              <dt>GPU</dt>
              <dd title={local.gpu.renderer}>{local.gpu.renderer.slice(0, 28)}</dd>
            </div>
            <div>
              <dt>Bağlantı</dt>
              <dd>{local.network.effectiveType ?? "—"}</dd>
            </div>
            <div>
              <dt>Tahmini hız</dt>
              <dd>{local.network.downlinkMbps ? `${local.network.downlinkMbps} Mbps` : "—"}</dd>
            </div>
            <div>
              <dt>Pil</dt>
              <dd>
                {local.battery.available
                  ? `${local.battery.level}% ${local.battery.charging ? "⚡" : ""}`
                  : "masaüstü"}
              </dd>
            </div>
            <div>
              <dt>Depolama kotası</dt>
              <dd>{local.storage.quotaMb ? `${local.storage.quotaMb} MB` : "—"}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* --- Uzak sunucu --- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              Uzak Sunucu
            </h3>
            <p className="app__subtitle">
              {remoteStatus?.default_host_set
                ? `${remoteStatus.default_user ?? "?"}@${remoteStatus.default_host ?? "?"}`
                : "SSH hedefi tanımlı değil"}
            </p>
          </div>
        </div>

        {!remoteStatus?.default_host_set && (
          <div className="app-msg app-msg--info">
            Uzak kaynakları görmek için <code>.env</code> içinde <code>SSH_DEFAULT_HOST</code> ve{" "}
            <code>SSH_DEFAULT_USER</code> doldurulmalı.
          </div>
        )}

        {remoteError && <div className="app-msg app-msg--warn">{remoteError}</div>}

        {remote && (
          <>
            <dl className="app-facts">
              <div>
                <dt>Ana makine</dt>
                <dd>{remote.hostname ?? "—"}</dd>
              </div>
              <div>
                <dt>İşletim sistemi</dt>
                <dd>{remote.os ?? "—"}</dd>
              </div>
              <div>
                <dt>Çekirdek</dt>
                <dd>{remote.kernel ?? "—"}</dd>
              </div>
              <div>
                <dt>Çalışma süresi</dt>
                <dd>{remote.uptime ?? "—"}</dd>
              </div>
              <div>
                <dt>CPU çekirdeği</dt>
                <dd>{remote.cpu_cores ?? "—"}</dd>
              </div>
              <div>
                <dt>Bellek toplam</dt>
                <dd>{remote.memory_total_mb ? `${remote.memory_total_mb} MB` : "—"}</dd>
              </div>
              <div>
                <dt>Bellek kullanım</dt>
                <dd>{remote.memory_used_mb ? `${remote.memory_used_mb} MB` : "—"}</dd>
              </div>
              <div>
                <dt>Disk</dt>
                <dd>
                  {remote.disk_used_gb && remote.disk_total_gb
                    ? `${remote.disk_used_gb} / ${remote.disk_total_gb} GB`
                    : "—"}
                </dd>
              </div>
            </dl>
          </>
        )}

        {remoteStatus?.default_host_set && !remote && !remoteError && (
          <div className="app-empty">
            <span aria-hidden="true">🖧</span>
            Uzak sistem bilgisi alınamadı
          </div>
        )}
      </div>
    </div>
  );
}
