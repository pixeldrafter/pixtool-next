/**
 * Script Kütüphanesi.
 *
 * `scripts_library/` klasöründeki scriptleri listeler, arar, kategorilere
 * ayırır ve içeriğini gösterir. Çalıştırma **komut politikasına** tabidir:
 *   confirm    → kullanıcıdan onay ister
 *   whitelist  → yalnızca izinli scriptler
 *   allow_all  → doğrudan çalıştırır
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  describeError,
  fetchScript,
  fetchScripts,
  runScript,
  type ScriptInfo,
} from "../../lib/api";
import { useBackendConfig } from "../../lib/useBackendConfig";
import "../apps.css";

export function ScriptsWindow() {
  const backend = useBackendConfig();

  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("hepsi");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // --- Kütüphaneyi yükle ---
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScripts();
      setScripts(data.scripts);
      setCategories(data.categories);
      setSelected((current) => current ?? data.scripts[0]?.id ?? null);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // --- Seçili scriptin içeriği ---
  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setRunResult(null);

    void fetchScript(selected)
      .then((data) => {
        if (!cancelled) setContent(data.content);
      })
      .catch((caught) => {
        if (!cancelled) setContent(`// Yüklenemedi: ${describeError(caught)}`);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // --- Süzme ---
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return scripts.filter((script) => {
      const matchCategory = category === "hepsi" || script.category === category;
      if (!matchCategory) return false;
      if (!normalized) return true;
      return (
        script.name.toLocaleLowerCase("tr").includes(normalized) ||
        script.id.toLocaleLowerCase("tr").includes(normalized) ||
        script.description.toLocaleLowerCase("tr").includes(normalized)
      );
    });
  }, [scripts, query, category]);

  const current = scripts.find((item) => item.id === selected) ?? null;

  // --- Çalıştırma ---
  async function handleRun() {
    if (!current) return;
    setRunning(true);
    setRunResult(null);

    try {
      const result = await runScript(current.id, {
        target: "local",
        policy: backend.commandPolicy,
      });
      setRunResult(
        `[${result.status}] ${result.message ?? ""}\n\nKomut:\n${result.command}`,
      );
    } catch (caught) {
      setRunResult(`Hata: ${describeError(caught)}`);
    } finally {
      setRunning(false);
    }
  }

  if (loading && scripts.length === 0) {
    return (
      <div className="app">
        <div className="app-loading">
          <span className="app-spinner" /> Kütüphane taranıyor…
        </div>
      </div>
    );
  }

  if (error && scripts.length === 0) {
    return (
      <div className="app">
        <div className="app-msg app-msg--error">
          Kütüphane yüklenemedi: {error}
          <div style={{ marginTop: 8 }}>
            <button className="app-btn" onClick={() => void load()}>
              Tekrar dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Script Kütüphanesi</h2>
        <span className="app__subtitle">
          {filtered.length} / {scripts.length} script · {categories.length} kategori
        </span>
        <span className="app__spacer" />
        <input
          className="app-input"
          type="search"
          placeholder="Ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="app-select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="hepsi">Tüm kategoriler</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          ⟳
        </button>
      </div>

      <div className="app__split">
        {/* --- Liste --- */}
        <div className="app-list">
          {filtered.length === 0 && <div className="app-empty">Sonuç yok</div>}

          {filtered.map((script) => (
            <button
              key={script.id}
              type="button"
              className={`app-list__item${script.id === selected ? " is-active" : ""}`}
              onClick={() => setSelected(script.id)}
            >
              <span className="app-list__name">{script.name}</span>
              <span className="app-list__meta">
                <span className="app-tag">{script.category}</span>
                <span>{script.lines} satır</span>
                <span>{Math.round(script.size_bytes / 1024)} KB</span>
              </span>
            </button>
          ))}
        </div>

        {/* --- Detay --- */}
        <div className="app-panel">
          {!current && <div className="app-empty">Soldan bir script seç</div>}

          {current && (
            <>
              <div className="app-panel__head">
                <div style={{ minWidth: 0 }}>
                  <h3 className="app__title" style={{ fontSize: 13.5 }}>
                    {current.name}
                  </h3>
                  <p className="app__subtitle">
                    {current.description || "Açıklama yok"}
                  </p>
                </div>
                <span className="app__spacer" />
                <button
                  className="app-btn app-btn--primary"
                  onClick={() => void handleRun()}
                  disabled={running}
                  title={`Komut politikası: ${backend.commandPolicy}`}
                >
                  {running ? "…" : "▶ Çalıştır"}
                </button>
              </div>

              <dl className="app-facts">
                <div>
                  <dt>Dosya</dt>
                  <dd>{current.id}</dd>
                </div>
                <div>
                  <dt>Kategori</dt>
                  <dd>{current.category}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{current.platform}</dd>
                </div>
                <div>
                  <dt>Satır</dt>
                  <dd>{current.lines}</dd>
                </div>
                {current.author && (
                  <div>
                    <dt>Yazar</dt>
                    <dd>{current.author}</dd>
                  </div>
                )}
                {current.version && (
                  <div>
                    <dt>Sürüm</dt>
                    <dd>{current.version}</dd>
                  </div>
                )}
              </dl>

              {runResult && <pre className="app-code" style={{ maxHeight: 140 }}>{runResult}</pre>}

              {detailLoading ? (
                <div className="app-loading">
                  <span className="app-spinner" /> İçerik yükleniyor…
                </div>
              ) : (
                <pre className="app-code">{content}</pre>
              )}

              <p className="app__subtitle">
                Komut politikası: <strong>{backend.commandPolicy}</strong>
                {backend.commandPolicy === "confirm" && " — çalıştırma onay bekler."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
