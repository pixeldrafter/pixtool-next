/**
 * Tek bir yapışkan not kartı.
 *
 * • Başlıktan sürüklenerek taşınır
 * • İçerik doğrudan yazılabilir (textarea)
 * • Renk paletinden renk seçilir
 * • Katlanır (yalnızca başlık görünür)
 * • Silinir
 *
 * Not: Sürükleme kendi pointer olaylarıyla yapılır; hiçbir pencere
 * yöneticisine bağlı değildir.
 */

import { useCallback, useEffect, useState } from "react";

import { NOTE_COLORS, noteColor, useStickyStore, type StickyNote } from "./notesStore";

interface StickyNoteCardProps {
  note: StickyNote;
}

export function StickyNoteCard({ note }: StickyNoteCardProps) {
  const update = useStickyStore((state) => state.update);
  const remove = useStickyStore((state) => state.remove);
  const bringToFront = useStickyStore((state) => state.bringToFront);

  const [paletteOpen, setPaletteOpen] = useState(false);

  const palette = noteColor(note.color);

  // --- Sürükleme ---
  // Pointer capture'a güvenmek yerine pencere seviyesinde dinliyoruz:
  // fare başlık çubuğunun dışına çıktığında da takip devam eder.
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Başlıktaki butonlara basıldıysa sürükleme başlamasın
      if ((event.target as HTMLElement).closest("button")) return;
      // Yalnızca sol tuş
      if (event.button !== 0) return;

      event.preventDefault();
      bringToFront(note.id);

      const offsetX = event.clientX - note.x;
      const offsetY = event.clientY - note.y;
      const width = note.width;
      let lastX = note.x;
      let lastY = note.y;

      const onMove = (moveEvent: PointerEvent): void => {
        const maxX = Math.max(4, window.innerWidth - width - 8);
        const maxY = Math.max(4, window.innerHeight - 60);
        lastX = Math.max(4, Math.min(moveEvent.clientX - offsetX, maxX));
        lastY = Math.max(4, Math.min(moveEvent.clientY - offsetY, maxY));
        update(note.id, { x: Math.round(lastX), y: Math.round(lastY) });
      };

      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [bringToFront, note.id, note.width, note.x, note.y, update],
  );

  // --- Paleti dışarı tıklayınca kapat ---
  useEffect(() => {
    if (!paletteOpen) return undefined;
    const close = (): void => setPaletteOpen(false);
    window.addEventListener("pointerdown", close, { once: true });
    return () => window.removeEventListener("pointerdown", close);
  }, [paletteOpen]);

  return (
    <article
      className={`sticky${note.collapsed ? " is-collapsed" : ""}`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.collapsed ? 34 : note.height,
        zIndex: 100 + note.z,
        background: palette.bg,
        color: palette.ink,
      }}
      onPointerDown={() => bringToFront(note.id)}
    >
      {/* --- Başlık (sürükleme tutamacı) --- */}
      <div
        className="sticky__bar"
        onPointerDown={handlePointerDown}
        title="Sürükleyerek taşı"
      >
        <span className="sticky__grip" aria-hidden="true">
          ⠿
        </span>

        <span className="sticky__spacer" />

        {/* Renk seçici */}
        <div className="sticky__colors">
          <button
            type="button"
            className="sticky__btn"
            aria-label="Renk seç"
            title="Renk"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setPaletteOpen((value) => !value)}
          >
            🎨
          </button>

          {paletteOpen && (
            <div
              className="sticky__palette"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {NOTE_COLORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sticky__swatch${
                    item.id === note.color ? " is-active" : ""
                  }`}
                  style={{ background: item.bg }}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => {
                    update(note.id, { color: item.id });
                    setPaletteOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="sticky__btn"
          aria-label={note.collapsed ? "Genişlet" : "Katla"}
          title={note.collapsed ? "Genişlet" : "Katla"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => update(note.id, { collapsed: !note.collapsed })}
        >
          {note.collapsed ? "▸" : "▾"}
        </button>

        <button
          type="button"
          className="sticky__btn sticky__btn--close"
          aria-label="Notu sil"
          title="Sil"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => remove(note.id)}
        >
          ✕
        </button>
      </div>

      {/* --- İçerik --- */}
      {!note.collapsed && (
        <textarea
          className="sticky__text"
          value={note.text}
          placeholder="Notunu yaz…"
          spellCheck={false}
          onChange={(event) => update(note.id, { text: event.target.value })}
          onPointerDown={(event) => event.stopPropagation()}
        />
      )}
    </article>
  );
}
