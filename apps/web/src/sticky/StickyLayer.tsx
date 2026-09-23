/**
 * Masaüstü yapışkan not katmanı.
 *
 * Tüm notları çizer; boş masaüstüne **çift tıklayınca** yeni not açar.
 * Notlar kendi konumlarını sürükleyerek değiştirir.
 */

import { useCallback, useRef } from "react";

import { StickyNoteCard } from "./StickyNoteCard";
import { useStickyStore } from "./notesStore";
import "./StickyLayer.css";

export function StickyLayer() {
  const notes = useStickyStore((state) => state.notes);
  const add = useStickyStore((state) => state.add);
  const layerRef = useRef<HTMLDivElement>(null);

  /** Boş alana çift tıklama → yeni not (tıklanan noktada). */
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Yalnızca katmanın kendisine tıklandıysa (not üstünde değilse)
      if (event.target !== layerRef.current) return;
      add({ x: event.clientX - 100, y: Math.max(16, event.clientY - 20) });
    },
    [add],
  );

  return (
    <div
      className="stickies"
      ref={layerRef}
      onDoubleClick={handleDoubleClick}
      aria-label="Masaüstü notları"
    >
      {notes.map((note) => (
        <StickyNoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
