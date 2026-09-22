/**
 * Masaüstü kabuğu — Faz 0 sürümü.
 *
 * Bu iskelet, işletim sistemi görünümünün (karar #11) temelidir:
 *   • masaüstü alanı (duvar kağıdı + yıldız alanı)
 *   • pencere çerçevesi (başlık çubuğu, denetim noktaları)
 *   • görev çubuğu (başlat düğmesi + saat)
 *
 * Faz 0'da gösterilen pencere: **bağlantı durumu** — Faz 0'ın çıkış kriterini
 * doğrular (arayüz ↔ backend ↔ NocoDB zinciri).
 *
 * Sonraki fazlar:
 *   Faz 1 → sürüklenebilir pencereler, pencere yöneticisi, başlat menüsü,
 *           temalar (Windows / KDE), Command Palette
 *   Faz 2 → Overview, Scripts, Files, Terminal, Users, Settings ekranları
 */

import { useEffect, useState } from "react";
import type { StatusResponse } from "../lib/api";
import "./Desktop.css";

interface DesktopProps {
  status: StatusResponse | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}

export function Desktop({ status, error, loading, onRefresh }: DesktopProps) {
  return (
    <div className="desktop">
      <div className="desktop__stars" />

      <div className="desktop__area">
        <StatusWindow status={status} error={error} loading={loading} onRefresh={onRefresh} />
      </div>

      <Taskbar />
    </div>
  );
}

// ----------------------------------------------------------------------
//  Durum penceresi
// ----------------------------------------------------------------------
function StatusWindow({ status, error, loading, onRefresh }: DesktopProps) {
  const nocodb = status?.integrations.nocodb;

  return (
    <section className="window" aria-label="Bağlantı durumu">
      <header className="window__titlebar">
        <span aria-hidden="true">🖥️</span>
        <span className="window__title">Bağlantı Durumu — Faz 0</span>
        <div className="window__dots">
          <span className="window__dot window__dot--min" />
          <span className="window__dot window__dot--max" />
          <span className="window__dot window__dot--close" />
        </div>
      </header>

      <div className="window__body">
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
              <div className="next-steps__title">Faz 0 — kalan adımlar</div>
              <ol>
                <li>
                  Gerçek sunucu adresleri <code>.env</code> içine girilecek (NocoDB / n8n / Telegram
                  şu an <em>şablon</em> değerde)
                </li>
                <li>
                  NocoDB API token + base id alınacak → <code>NOCODB_API_TOKEN</code>,{" "}
                  <code>NOCODB_BASE_ID</code>
                </li>
                <li>
                  <code>tools/bootstrap_nocodb.py</code> ile tablo şeması kurulacak (v6'dan hasat)
                </li>
                <li>Köprü ↔ tarayıcı kısıtı doğrulanacak (ACIK-KONULAR #1)</li>
              </ol>
            </div>
          </>
        )}

        <div style={{ marginTop: "var(--space-4)" }}>
          <button className="taskbar__start" onClick={onRefresh} disabled={loading}>
            {loading ? "Yenileniyor…" : "Durumu Yenile"}
          </button>
        </div>
      </div>
    </section>
  );
}

function nocodbValue(nocodb: StatusResponse["integrations"]["nocodb"] | undefined): string {
  if (!nocodb) return "—";
  if (nocodb.ok) return "Bağlı";
  if (nocodb.placeholder) return "Şablon adres";
  if (nocodb.reachable) return "Token geçersiz";
  if (nocodb.configured) return "Ulaşılamıyor";
  return "Yapılandırılmadı";
}

type Tone = "ok" | "warn" | "err" | "info";

function Card({
  label,
  value,
  detail,
  tone = "info",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className={`card__value ${tone}`}>{value}</div>
      {detail && <div className="card__detail">{detail}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
//  Görev çubuğu
// ----------------------------------------------------------------------
function Taskbar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="taskbar">
      <button className="taskbar__start" type="button">
        <span aria-hidden="true">◈</span> Başlat
      </button>
      <span className="dim mono" style={{ fontSize: 11 }}>
        Faz 0 · iskelet
      </span>
      <span className="taskbar__spacer" />
      <span className="taskbar__clock">
        {now.toLocaleDateString("tr-TR")} · {now.toLocaleTimeString("tr-TR")}
      </span>
    </footer>
  );
}
