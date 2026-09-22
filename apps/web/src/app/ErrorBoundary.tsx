/**
 * Hata sınırı (ErrorBoundary).
 *
 * Arayüzde bir çalışma zamanı hatası oluştuğunda beyaz/boş ekran yerine
 * **okunabilir bir hata ekranı** gösterir. Geliştirme kipinde yığın izini
 * (stack trace) de gösterir.
 *
 * Neden gerekli: React'te bir render hatası tüm ağacı çökertir ve kullanıcı
 * boş bir sayfa görür — sorunun ne olduğu anlaşılmaz.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    // Geliştirme sırasında konsola da yaz
    console.error("[Pixtool] Yakalanan hata:", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="error-screen">
        <div className="error-screen__card">
          <div className="error-screen__icon" aria-hidden="true">
            ⚠️
          </div>
          <h1 className="error-screen__title">Bir şeyler ters gitti</h1>
          <p className="error-screen__text">
            Arayüz beklenmedik bir hatayla karşılaştı. Sorun devam ederse sayfayı
            yenilemeyi deneyin.
          </p>

          <div className="error-screen__message mono">{error.message}</div>

          {isDev && info?.componentStack && (
            <details className="error-screen__details" open>
              <summary>Bileşen yığını (geliştirme)</summary>
              <pre className="mono">{info.componentStack}</pre>
            </details>
          )}

          {isDev && error.stack && (
            <details className="error-screen__details">
              <summary>Yığın izi (geliştirme)</summary>
              <pre className="mono">{error.stack}</pre>
            </details>
          )}

          <div className="error-screen__actions">
            <button
              type="button"
              className="error-screen__button error-screen__button--primary"
              onClick={() => window.location.reload()}
            >
              Sayfayı yenile
            </button>
            <button
              type="button"
              className="error-screen__button"
              onClick={() => {
                // Yerel ayarları koru, yalnızca çalışma zamanı durumunu sıfırla
                window.location.href = window.location.pathname;
              }}
            >
              Baştan başlat
            </button>
          </div>
        </div>
      </div>
    );
  }
}
