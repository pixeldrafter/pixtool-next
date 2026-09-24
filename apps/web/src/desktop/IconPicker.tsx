/**
 * İkon seçici.
 *
 * Kullanıcı masaüstü öğesinin ikonunu değiştirebilir:
 *   • **Dosya yükle** (png / svg / ico / jpg) → data URL olarak saklanır
 *   • **URL gir** (internetten bulduğu ikon)
 *   • **Yerleşik ikon** seç (uygulamanın çizdiği SVG'ler)
 *
 * ⚠️ Boyut sınırı 256 KB — `localStorage` kotasını korumak için.
 */

import { useRef, useState } from "react";

import { SystemIcon, type SystemIconName } from "../icons";
import "./IconPicker.css";

/** Yerleşik ikon adları. */
const SYSTEM_ICONS: SystemIconName[] = [
  "overview",
  "scripts",
  "terminal",
  "files",
  "folder",
  "users",
  "database",
  "resources",
  "status",
  "settings",
  "about",
  "note",
];

/** İzin verilen en büyük ikon boyutu. */
const MAX_ICON_BYTES = 256 * 1024;

export interface IconPickerProps {
  /** Mevcut ikon değeri */
  current?: string;
  /** Öğe etiketi (başlık için) */
  label: string;
  onApply: (icon: string | undefined) => void;
  onClose: () => void;
}

export function IconPicker({ current, label, onApply, onClose }: IconPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>(current ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);

    if (!/^image\//.test(file.type)) {
      setError("Yalnızca görsel dosyaları (png, svg, ico, jpg) yüklenebilir.");
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setError(`Dosya çok büyük (${Math.round(file.size / 1024)} KB). En fazla 256 KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setValue(String(reader.result ?? ""));
    };
    reader.onerror = () => setError("Dosya okunamadı.");
    reader.readAsDataURL(file);
  }

  /** Önizleme: data URL, http URL veya `icon:` adı. */
  function renderPreview(icon: string): React.ReactNode {
    if (!icon) return <span className="iconpick__none">—</span>;
    if (icon.startsWith("icon:")) {
      return <SystemIcon name={icon.slice(5) as SystemIconName} size={40} />;
    }
    return <img className="iconpick__img" src={icon} alt="" />;
  }

  return (
    <div className="iconpick" role="dialog" aria-modal="true" aria-label="İkon seç">
      <div className="iconpick__box">
        <header className="iconpick__head">
          <h3>İkonu değiştir</h3>
          <p className="iconpick__sub mono">{label}</p>
        </header>

        <div className="iconpick__preview">
          <div className="iconpick__preview-box">{renderPreview(value)}</div>
          <div className="iconpick__preview-info">
            <span className="iconpick__preview-label">Önizleme</span>
            <button type="button" className="app-btn" onClick={() => setValue("")}>
              Varsayılana dön
            </button>
          </div>
        </div>

        {error && <p className="iconpick__error">⚠ {error}</p>}

        <section className="iconpick__section">
          <h4>Dosyadan yükle</h4>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="iconpick__file"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => fileRef.current?.click()}
          >
            📁 Görsel seç (png · svg · ico)
          </button>
        </section>

        <section className="iconpick__section">
          <h4>İnternetten</h4>
          <input
            className="app-input"
            type="url"
            placeholder="https://ornek.com/ikon.png"
            value={value.startsWith("data:") ? "" : value}
            onChange={(event) => setValue(event.target.value)}
          />
        </section>

        <section className="iconpick__section">
          <h4>Yerleşik ikonlar</h4>
          <div className="iconpick__grid">
            {SYSTEM_ICONS.map((name) => (
              <button
                key={name}
                type="button"
                className={`iconpick__cell${value === `icon:${name}` ? " is-active" : ""}`}
                title={name}
                onClick={() => setValue(`icon:${name}`)}
              >
                <SystemIcon name={name} size={28} />
              </button>
            ))}
          </div>
        </section>

        <footer className="iconpick__actions">
          <button type="button" className="app-btn" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => {
              onApply(value || undefined);
              onClose();
            }}
          >
            ✔ Uygula
          </button>
        </footer>
      </div>
    </div>
  );
}
