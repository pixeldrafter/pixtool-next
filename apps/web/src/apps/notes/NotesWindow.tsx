/**
 * Yapışkan Notlar — yönetici penceresi.
 *
 * Masaüstündeki notların tamamını tek yerde toplar: ara, düzenle, renk ve tema
 * seç, yazı boyutunu ayarla, sabitle, çoğalt, sil, dışa aktar.
 *
 * Renkler ve temalar `sticky/notesStore.ts` içindeki paletlerden gelir; masaüstü
 * katmanı (`StickyLayer`) aynı depoyu okuduğu için değişiklikler anında yansır.
 */

import { useCallback, useMemo, useState } from "react";

import { toast } from "../../notifications";
import {
  NOTE_COLORS,
  NOTE_THEMES,
  noteColor,
  useStickyStore,
  type NoteColorId,
  type NoteThemeId,
} from "../../sticky/notesStore";
import "../apps.css";
import "./notes-window.css";

/** Temaya göre arka plan katmanı. */
function themeBackground(theme: NoteThemeId, bg: string): string {
  switch (theme) {
    case "paper":
      return `repeating-linear-gradient(180deg, ${bg} 0 22px, rgba(0,0,0,0.07) 22px 23px)`;
    case "grid":
      return `linear-gradient(${bg}, ${bg}), repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(180deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 22px)`;
    case "neon":
      return `linear-gradient(160deg, ${bg}, #0c0f1a 118%)`;
    case "dark":
      return `linear-gradient(160deg, #1c1f26, #101319)`;
    default:
      return bg;
  }
}

export function NotesWindow() {
  const notes = useStickyStore((state) => state.notes);
  const add = useStickyStore((state) => state.add);
  const update = useStickyStore((state) => state.update);
  const remove = useStickyStore((state) => state.remove);
  const clearAll = useStickyStore((state) => state.clearAll);

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  /** Yeni notlar için varsayılan renk/tema. */
  const [defaultColor, setDefaultColor] = useState<NoteColorId>("yellow");
  const [defaultTheme, setDefaultTheme] = useState<NoteThemeId>("pastel");

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
    if (!needle) return sorted;
    return sorted.filter((note) => note.text.toLocaleLowerCase("tr").includes(needle));
  }, [notes, query]);

  const open = notes.find((note) => note.id === openId) ?? null;

  /** Yeni not ekler ve hemen düzenlemeye açar. */
  const create = useCallback(() => {
    const id = add({ color: defaultColor });
    update(id, { theme: defaultTheme });
    setOpenId(id);
    toast.ok("Not eklendi", "Masaüstünde de görünür", "Notlar");
  }, [add, defaultColor, defaultTheme, update]);

  /** Notu panoya kopyalar. */
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok("Kopyalandı", `${text.length} karakter`, "Notlar");
    } catch {
      toast.error("Kopyalanamadı", "Pano erişimi reddedildi", "Notlar");
    }
  }, []);

  /** Tüm notları JSON olarak indirir. */
  const exportAll = useCallback(() => {
    const payload = JSON.stringify(notes, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pixtool-notlar-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.ok("Dışa aktarıldı", `${notes.length} not`, "Notlar");
  }, [notes]);

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Yapışkan Notlar</h2>
        <span className="app__subtitle">{notes.length} not · masaüstüyle eşzamanlı</span>
        <span className="app__spacer" />
        <input
          className="app-input"
          type="search"
          placeholder="Notlarda ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="app-btn app-btn--primary" onClick={create}>
          ＋ Yeni not
        </button>
      </div>

      {/* --- Varsayılan görünüm --- */}
      <div className="notes__defaults">
        <span className="notes__defaults-label">Yeni not:</span>

        <div className="notes__swatches">
          {NOTE_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.label}
              aria-label={color.label}
              className={`notes__swatch${defaultColor === color.id ? " is-active" : ""}`}
              style={{ background: color.bg }}
              onClick={() => setDefaultColor(color.id)}
            />
          ))}
        </div>

        <div className="notes__themes">
          {NOTE_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              title={theme.label}
              className={`notes__theme${defaultTheme === theme.id ? " is-active" : ""}`}
              onClick={() => setDefaultTheme(theme.id)}
            >
              <span aria-hidden="true">{theme.icon}</span> {theme.label}
            </button>
          ))}
        </div>

        <span className="app__spacer" />
        <button className="app-btn" onClick={exportAll} disabled={!notes.length}>
          ⬇ Dışa aktar
        </button>
        <button
          className="app-btn"
          onClick={() => {
            if (!notes.length) return;
            if (window.confirm(`${notes.length} notun tamamı silinsin mi?`)) {
              clearAll();
              setOpenId(null);
              toast.ok("Tüm notlar silindi", "", "Notlar");
            }
          }}
          disabled={!notes.length}
        >
          🗑 Tümünü sil
        </button>
      </div>

      {/* --- Izgara --- */}
      {filtered.length === 0 ? (
        <div className="app-empty">
          <span aria-hidden="true">🗒️</span>
          {notes.length === 0 ? (
            <>
              <strong>Henüz not yok</strong>
              <p>&quot;Yeni not&quot; ile başla — masaüstünde de belirir.</p>
            </>
          ) : (
            "Aramaya uyan not yok"
          )}
        </div>
      ) : (
        <div className="notes__grid">
          {filtered.map((note) => {
            const color = noteColor(note.color);
            return (
              <button
                key={note.id}
                type="button"
                className={`notes__card notes__card--${note.theme}`}
                style={{ background: themeBackground(note.theme, color.bg), color: note.theme === "dark" || note.theme === "neon" ? "#e8edf5" : color.ink }}
                onClick={() => setOpenId(note.id)}
                title={note.text.slice(0, 90) || "(boş not)"}
              >
                <span className="notes__card-text">
                  {note.text.trim() || <em className="notes__card-empty">(boş)</em>}
                </span>
                <span className="notes__card-foot">
                  <span>{new Date(note.createdAt).toLocaleDateString("tr-TR")}</span>
                  {note.pinned && <span title="Sabitlenmiş">📌</span>}
                  {note.fontSize !== 12.5 && <span>{note.fontSize}px</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* --- Düzenleyici --- */}
      {open && (
        <div className="notes__editor-backdrop" onClick={() => setOpenId(null)}>
          <div
            className={`notes__editor notes__editor--${open.theme}`}
            style={{
              background: themeBackground(open.theme, noteColor(open.color).bg),
              color: open.theme === "dark" || open.theme === "neon" ? "#e8edf5" : noteColor(open.color).ink,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notes__editor-head">
              <span className="notes__editor-title">🗒️ Not</span>
              <span className="app__spacer" />
              <button
                className="notes__editor-btn"
                title={open.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                onClick={() => update(open.id, { pinned: !open.pinned })}
              >
                {open.pinned ? "📌" : "📍"}
              </button>
              <button
                className="notes__editor-btn"
                title="Çoğalt"
                onClick={() => {
                  const id = add({ color: open.color, text: open.text });
                  update(id, { theme: open.theme, fontSize: open.fontSize });
                  setOpenId(id);
                }}
              >
                ⧉
              </button>
              <button className="notes__editor-btn" title="Kopyala" onClick={() => void copy(open.text)}>
                ⧉⧉
              </button>
              <button
                className="notes__editor-btn is-danger"
                title="Sil"
                onClick={() => {
                  remove(open.id);
                  setOpenId(null);
                  toast.ok("Not silindi", "", "Notlar");
                }}
              >
                🗑
              </button>
              <button className="notes__editor-btn" onClick={() => setOpenId(null)}>
                ✕
              </button>
            </div>

            <textarea
              className="notes__editor-body"
              autoFocus
              style={{ fontSize: open.fontSize }}
              value={open.text}
              placeholder="Notunu yaz…"
              onChange={(event) => update(open.id, { text: event.target.value })}
            />

            <div className="notes__editor-controls">
              <div className="notes__swatches">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    title={color.label}
                    aria-label={color.label}
                    className={`notes__swatch notes__swatch--sm${open.color === color.id ? " is-active" : ""}`}
                    style={{ background: color.bg }}
                    onClick={() => update(open.id, { color: color.id })}
                  />
                ))}
              </div>

              <div className="notes__themes">
                {NOTE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    title={theme.label}
                    className={`notes__theme notes__theme--sm${open.theme === theme.id ? " is-active" : ""}`}
                    onClick={() => update(open.id, { theme: theme.id })}
                  >
                    <span aria-hidden="true">{theme.icon}</span>
                  </button>
                ))}
              </div>

              <span className="app__spacer" />

              <label className="notes__size">
                Yazı
                <input
                  type="range"
                  min={10}
                  max={22}
                  step={0.5}
                  value={open.fontSize}
                  onChange={(event) => update(open.id, { fontSize: Number(event.target.value) })}
                />
                <span className="notes__size-value">{open.fontSize}px</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
