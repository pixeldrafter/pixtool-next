/**
 * Script Kütüphanesi — tam yönetim.
 *
 * Yetenekler:
 *   • Listeleme, arama, kategori ve **tip** süzme
 *   • **Yeni script oluşturma** (PowerShell / CMD / Bash / Python)
 *   • **Düzenleme** — ad, tip, kategori, açıklama, içerik
 *   • **Silme** (onaylı)
 *   • İçeriği görüntüleme ve çalıştırma (komut politikasına tabi)
 *
 * Kategori ve tip dosya adından otomatik çıkarılır; kullanıcı elle
 * belirlediğinde sunucuda `scripts_library/.meta.json` içinde saklanır.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createScript,
  deleteScript,
  describeError,
  fetchScript,
  fetchScripts,
  runScript,
  updateScript,
  SCRIPT_KIND_LABELS,
  SCRIPT_KIND_SHORT,
  type ScriptInfo,
  type ScriptKind,
} from "../../lib/api";
import { useBackendConfig } from "../../lib/useBackendConfig";
import "../apps.css";
import "./scripts-window.css";

const KIND_OPTIONS: ScriptKind[] = ["powershell", "cmd", "bash", "python"];

/** Boş form durumu. */
interface FormState {
  id: string | null;
  name: string;
  type: ScriptKind;
  category: string;
  description: string;
  content: string;
  folder: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  type: "powershell",
  category: "Genel",
  description: "",
  content: "",
  folder: "",
};

export function ScriptsWindow() {
  const backend = useBackendConfig();

  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("hepsi");
  const [kindFilter, setKindFilter] = useState<string>("hepsi");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  /** Açık olan form (null → kapalı). */
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /** Silme onayı bekleyen script kimliği. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // --- Kütüphaneyi yükle ---
  const load = useCallback(async (keepSelection = true) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScripts();
      setScripts(data.scripts);
      setCategories(data.categories);
      if (!keepSelection) {
        setSelected(data.scripts[0]?.id ?? null);
      } else {
        setSelected((current) =>
          current && data.scripts.some((item) => item.id === current)
            ? current
            : (data.scripts[0]?.id ?? null),
        );
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

  // --- Seçili scriptin içeriği ---
  useEffect(() => {
    if (!selected) {
      setContent("");
      return undefined;
    }
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

  /** Başarı bildirimi göster (kendiliğinden kaybolur). */
  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  // --- Süzme ---
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return scripts.filter((script) => {
      if (category !== "hepsi" && script.category !== category) return false;
      if (kindFilter !== "hepsi" && script.type !== kindFilter) return false;
      if (!normalized) return true;
      return (
        script.name.toLocaleLowerCase("tr").includes(normalized) ||
        script.id.toLocaleLowerCase("tr").includes(normalized) ||
        script.description.toLocaleLowerCase("tr").includes(normalized)
      );
    });
  }, [scripts, query, category, kindFilter]);

  const current = scripts.find((item) => item.id === selected) ?? null;

  // ------------------------------------------------------------------
  //  İşlemler
  // ------------------------------------------------------------------
  function openCreate(): void {
    setForm({ ...EMPTY_FORM, category: categories[0] ?? "Genel" });
    setFormError(null);
  }

  function openEdit(): void {
    if (!current) return;
    setForm({
      id: current.id,
      name: current.name,
      type: current.type,
      category: current.category,
      description: current.description,
      content,
      folder: "",
    });
    setFormError(null);
  }

  async function handleSubmit(): Promise<void> {
    if (!form) return;
    if (!form.name.trim()) {
      setFormError("Ad zorunlu.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (form.id) {
        const result = await updateScript(form.id, {
          name: form.name.trim(),
          type: form.type,
          category: form.category.trim() || "Genel",
          description: form.description,
          content: form.content,
        });
        setForm(null);
        await load();
        if (result.script) setSelected(result.script.id);
        flash(result.message);
      } else {
        const result = await createScript({
          name: form.name.trim(),
          type: form.type,
          category: form.category.trim() || "Genel",
          description: form.description,
          content: form.content,
          folder: form.folder.trim(),
        });
        setForm(null);
        await load();
        if (result.script) setSelected(result.script.id);
        flash(result.message);
      }
    } catch (caught) {
      setFormError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setBusy(true);
    try {
      const result = await deleteScript(id);
      setConfirmDelete(null);
      if (selected === id) setSelected(null);
      await load();
      flash(result.message);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleRun(): Promise<void> {
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

  // ------------------------------------------------------------------
  //  Yükleniyor / hata ekranları
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  //  Form (oluştur / düzenle)
  // ------------------------------------------------------------------
  if (form) {
    return (
      <div className="app">
        <div className="app__toolbar">
          <h2 className="app__title">
            {form.id ? "Scripti Düzenle" : "Yeni Script"}
          </h2>
          <span className="app__subtitle">
            {form.id ? form.id : "Kütüphaneye yeni bir betik ekle"}
          </span>
          <span className="app__spacer" />
          <button
            className="app-btn"
            onClick={() => setForm(null)}
            disabled={busy}
          >
            ✕ Vazgeç
          </button>
          <button
            className="app-btn app-btn--primary"
            onClick={() => void handleSubmit()}
            disabled={busy}
          >
            {busy ? "…" : form.id ? "💾 Kaydet" : "＋ Oluştur"}
          </button>
        </div>

        {formError && <div className="app-msg app-msg--error">{formError}</div>}

        <div className="sw-form">
          <div className="sw-form__row">
            <label className="sw-field">
              <span>Ad *</span>
              <input
                className="app-input"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Örn: Ağ Yöneticisi"
                autoFocus
              />
            </label>

            <label className="sw-field">
              <span>Script tipi *</span>
              <select
                className="app-select"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as ScriptKind })
                }
              >
                {KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SCRIPT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sw-form__row">
            <label className="sw-field">
              <span>Kategori</span>
              <input
                className="app-input"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                placeholder="Genel"
                list="sw-categories"
              />
              <datalist id="sw-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            {!form.id && (
              <label className="sw-field">
                <span>Alt klasör (isteğe bağlı)</span>
                <input
                  className="app-input"
                  value={form.folder}
                  onChange={(event) =>
                    setForm({ ...form, folder: event.target.value })
                  }
                  placeholder="windows · linux"
                />
              </label>
            )}
          </div>

          <label className="sw-field">
            <span>Açıklama</span>
            <textarea
              className="app-input sw-textarea"
              rows={2}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Bu script ne yapar?"
            />
          </label>

          <label className="sw-field sw-field--grow">
            <span>
              İçerik
              <em className="sw-hint">
                {" "}
                — boş bırakırsan tipe uygun şablon oluşturulur
              </em>
            </span>
            <textarea
              className="app-code sw-editor"
              value={form.content}
              spellCheck={false}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              placeholder=""
            />
          </label>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  //  Ana görünüm
  // ------------------------------------------------------------------
  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Script Kütüphanesi</h2>
        <span className="app__subtitle">
          {filtered.length} / {scripts.length} script · {categories.length}{" "}
          kategori
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
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value)}
          title="Script tipi"
        >
          <option value="hepsi">Tüm tipler</option>
          {KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {SCRIPT_KIND_SHORT[kind]}
            </option>
          ))}
        </select>
        <select
          className="app-select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          title="Kategori"
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
        <button className="app-btn app-btn--primary" onClick={openCreate}>
          ＋ Yeni script
        </button>
      </div>

      {notice && <div className="app-msg app-msg--ok">{notice}</div>}
      {error && <div className="app-msg app-msg--error">{error}</div>}

      <div className="app__split">
        {/* --- Liste --- */}
        <div className="app-list">
          {filtered.length === 0 && <div className="app-empty">Sonuç yok</div>}

          {filtered.map((script) => (
            <button
              key={script.id}
              type="button"
              className={`app-list__item${
                script.id === selected ? " is-active" : ""
              }`}
              onClick={() => setSelected(script.id)}
            >
              <span className="app-list__name">
                <span className={`sw-kind sw-kind--${script.type}`}>
                  {SCRIPT_KIND_SHORT[script.type]}
                </span>
                {script.name}
              </span>
              <span className="app-list__meta">
                <span className="app-tag">{script.category}</span>
                {script.customized && (
                  <span className="app-tag app-tag--muted" title="Elle belirlendi">
                    ✎
                  </span>
                )}
                <span>{script.lines} satır</span>
                <span>{Math.round(script.size_bytes / 1024)} KB</span>
              </span>
            </button>
          ))}
        </div>

        {/* --- Detay --- */}
        <div className="app-panel">
          {!current && (
            <div className="app-empty">
              Soldan bir script seç, ya da <strong>＋ Yeni script</strong> ile
              kütüphaneye ekle.
            </div>
          )}

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
                <button className="app-btn" onClick={openEdit} disabled={busy}>
                  ✎ Düzenle
                </button>
                <button
                  className="app-btn app-btn--danger"
                  onClick={() => setConfirmDelete(current.id)}
                  disabled={busy}
                >
                  🗑 Sil
                </button>
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
                  <dt>Tip</dt>
                  <dd>
                    <span className={`sw-kind sw-kind--${current.type}`}>
                      {SCRIPT_KIND_SHORT[current.type]}
                    </span>{" "}
                    {SCRIPT_KIND_LABELS[current.type]}
                  </dd>
                </div>
                <div>
                  <dt>Dosya</dt>
                  <dd className="mono">{current.id}</dd>
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

              {runResult && (
                <pre className="app-code" style={{ maxHeight: 140 }}>
                  {runResult}
                </pre>
              )}

              {detailLoading ? (
                <div className="app-loading">
                  <span className="app-spinner" /> İçerik yükleniyor…
                </div>
              ) : (
                <pre className="app-code">{content}</pre>
              )}

              <p className="app__subtitle">
                Komut politikası: <strong>{backend.commandPolicy}</strong>
                {backend.commandPolicy === "confirm" &&
                  " — çalıştırma onay bekler."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* --- Silme onayı --- */}
      {confirmDelete && (
        <div className="sw-confirm" role="dialog" aria-modal="true">
          <div className="sw-confirm__box">
            <h3>Script silinsin mi?</h3>
            <p className="mono">{confirmDelete}</p>
            <p className="app__subtitle">
              Bu işlem geri alınamaz — dosya ve üst verisi silinecek.
            </p>
            <div className="sw-confirm__actions">
              <button
                className="app-btn"
                onClick={() => setConfirmDelete(null)}
                disabled={busy}
              >
                Vazgeç
              </button>
              <button
                className="app-btn app-btn--danger"
                onClick={() => void handleDelete(confirmDelete)}
                disabled={busy}
              >
                {busy ? "…" : "🗑 Kalıcı olarak sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
