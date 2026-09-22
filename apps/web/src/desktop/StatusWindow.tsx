/**
 * Bağlantı durumu penceresi.
 *
 * Faz 0'ın çıkış kriterini görünür kılar: arayüz ↔ backend ↔ NocoDB zinciri.
 */

import type { StatusResponse } from "../lib/api";
import { Card, Window } from "./Window";

export interface StatusWindowProps {
  status: StatusResponse | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  onClose?: () => void;
}

function nocodbValue(nocodb: StatusResponse["integrations"]["nocodb"] | undefined): string {
  if (!nocodb) return "—";
  if (nocodb.ok) return "Bağlı";
  if (nocodb.placeholder) return "Şablon adres";
  if (nocodb.reachable) return "Token geçersiz";
  if (nocodb.configured) return "Ulaşılamıyor";
  return "Yapılandırılmadı";
}

export function StatusWindow({ status, error, loading, onRefresh, onClose }: StatusWindowProps) {
  const nocodb = status?.integrations.nocodb;

  return (
    <Window title="Bağlantı Durumu" icon="🖥️" width={880} onClose={onClose}>
      {loading && !status && <div className="dim">Backend'e bağlanılıyor…</div>}

      {error && !status && (
        <div className="notice notice--error">
          <strong>Backend'e ulaşılamadı.</strong>
          <div style={{ marginTop: 6 }}>{error}</div>
          <div style={{ marginTop: 6 }}>
            <code>pnpm dev:api</code> komutunu çalıştırdın mı?
          </div>
        </div>
      )}

      {status && (
        <>
          <div className="cards">
            <Card
              label="Backend API"
              value={`v${status.app.version}`}
              tone="ok"
              detail={`${status.app.name} · ${status.app.env}`}
            />
            <Card
              label="NocoDB (veri)"
              value={nocodbValue(nocodb)}
              tone={nocodb?.ok ? "ok" : nocodb?.reachable ? "warn" : "err"}
              detail={nocodb?.detail ?? ""}
            />
            <Card
              label="n8n (otomasyon)"
              value={status.integrations.n8n.configured ? "Yapılandırıldı" : "Boş"}
              tone={status.integrations.n8n.configured ? "ok" : "warn"}
              detail="Login / OTP webhook"
            />
            <Card
              label="Telegram (OTP)"
              value={status.integrations.telegram.configured ? "Yapılandırıldı" : "Boş"}
              tone={status.integrations.telegram.configured ? "ok" : "warn"}
              detail="Bildirim ve OTP kanalı"
            />
            <Card
              label="Yerel Köprü"
              value={status.integrations.bridge.configured ? "Hazır" : "Yok"}
              tone={status.integrations.bridge.configured ? "ok" : "warn"}
              detail="Faz 3"
            />
            <Card
              label="Komut Politikası"
              value={status.features.command_policy}
              tone={status.features.command_policy === "allow_all" ? "err" : "ok"}
              detail={`Veri adaptörü: ${status.features.db_adapter}`}
            />
          </div>

          {status.warnings.length > 0 && (
            <div className="notice notice--warn">
              <strong>{status.warnings.length} uyarı</strong>
              <ul>
                {status.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="next-steps">
            <div className="next-steps__title">Sonraki adımlar</div>
            <ol>
              <li>
                Gerçek sunucu adresleri <code>.env</code> içine (NocoDB / n8n / Telegram hâlâ şablon)
              </li>
              <li>
                NocoDB API token + base id → <code>NOCODB_API_TOKEN</code>,{" "}
                <code>NOCODB_BASE_ID</code>
              </li>
              <li>Tema / cursor / duvar kağıdı sistemleri (Ayarlar sekmesinden dene)</li>
              <li>Login formları + OTP + şaka sistemi</li>
            </ol>
          </div>
        </>
      )}

      <div style={{ marginTop: "var(--space-4)" }}>
        <button className="ui-button" onClick={onRefresh} disabled={loading}>
          {loading ? "Yenileniyor…" : "Durumu Yenile"}
        </button>
      </div>
    </Window>
  );
}
