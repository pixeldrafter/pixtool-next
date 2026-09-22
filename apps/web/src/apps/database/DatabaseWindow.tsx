/**
 * Veritabanı — NocoDB durumu ve base listesi.
 *
 * NocoDB yapılandırıldığında `/api/v1/status` üzerinden bağlantı durumu,
 * base kimliği ve tablo eşlemeleri gösterilir.
 *
 * Tablo içeriği görüntüleme (kayıt listeleme) NocoDB token'ı girildikten
 * sonra etkinleşecek.
 */

import { useCallback, useEffect, useState } from "react";

import { Card } from "../../desktop/ui/Card";
import { describeError, fetchStatus, type StatusResponse } from "../../lib/api";
import { useBackendConfig } from "../../lib/useBackendConfig";
import "../apps.css";

export function DatabaseWindow() {
  const backend = useBackendConfig();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await fetchStatus());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nocodb = status?.integrations.nocodb;

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Veritabanı</h2>
        <span className="app__subtitle">NocoDB — tüm veri katmanı</span>
        <span className="app__spacer" />
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "⟳ Yenile"}
        </button>
      </div>

      {error && <div className="app-msg app-msg--error">{error}</div>}

      <div className="cards">
        <Card
          label="Bağlantı"
          value={nocodb?.ok ? "Bağlı" : nocodb?.reachable ? "Token geçersiz" : "Bağlı değil"}
          tone={nocodb?.ok ? "ok" : "warn"}
          detail={nocodb?.detail ?? ""}
        />
        <Card
          label="Adaptör"
          value={backend.dbAdapter}
          tone="info"
          detail="Kişisel kullanımda NocoDB"
        />
        <Card
          label="Base URL"
          value={nocodb?.base_url ? "Tanımlı" : "Boş"}
          tone={nocodb?.base_url ? "ok" : "warn"}
          detail={nocodb?.base_url ?? "—"}
        />
        <Card
          label="Base ID"
          value={Object.values(backend.nocodbTables).some(Boolean) ? "Bağlı" : "Bekliyor"}
          tone={Object.values(backend.nocodbTables).some(Boolean) ? "ok" : "warn"}
          detail={
            nocodb?.placeholder
              ? "Şablon adres — gerçek değerler girilmeli"
              : "NocoDB panelinden kopyalanacak"
          }
        />
      </div>

      {/* --- Tablo eşlemeleri --- */}
      <div className="app-panel">
        <div className="app-panel__head">
          <div>
            <h3 className="app__title" style={{ fontSize: 13 }}>
              Tablo Eşlemeleri
            </h3>
            <p className="app__subtitle">
              Her alan <code>.env</code> içindeki karşılığıyla eşleşir
            </p>
          </div>
        </div>

        <table className="app-table">
          <thead>
            <tr>
              <th>Amaç</th>
              <th>Ortam değişkeni</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Kullanıcılar", "NOCODB_TABLE_USERS", backend.nocodbTables["users"]],
                ["Cihazlar", "NOCODB_TABLE_DEVICES", backend.nocodbTables["devices"]],
                ["Scriptler", "NOCODB_TABLE_SCRIPTS", backend.nocodbTables["scripts"]],
                ["Kaynaklar", "NOCODB_TABLE_RESOURCES", backend.nocodbTables["resources"]],
                ["Günlükler", "NOCODB_TABLE_LOGS", backend.nocodbTables["logs"]],
                ["Ayarlar", "NOCODB_TABLE_SETTINGS", backend.nocodbTables["settings"]],
              ] as const
            ).map(([label, envKey, value]) => (
              <tr key={envKey}>
                <td style={{ color: "var(--text-primary)" }}>{label}</td>
                <td className="app-table__mono">{envKey}</td>
                <td>
                  {value ? (
                    <span className="app-tag">{value}</span>
                  ) : (
                    <span className="app-tag app-tag--muted">boş</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Kurulum notu --- */}
      <div className="app-msg app-msg--info">
        <strong>NocoDB bağlantısı için</strong>
        <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            NocoDB panelinde bir <em>base</em> oluştur (kişisel kullanım için ayrı base önerilir)
          </li>
          <li>
            <code>NOCODB_BASE_URL</code> → örn. <code>https://nocodb.sunucun.com</code>
          </li>
          <li>
            <code>NOCODB_API_TOKEN</code> → NocoDB → Hesap Ayarları → API Token
          </li>
          <li>
            <code>NOCODB_BASE_ID</code> → base&apos;in kimliği
          </li>
          <li>
            Tablo adlarını oluşturdukça <code>.env</code> içine yaz
          </li>
        </ol>
      </div>
    </div>
  );
}
