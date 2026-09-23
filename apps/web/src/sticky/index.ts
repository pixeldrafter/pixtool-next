/**
 * Masaüstü yapışkan notları.
 *
 *   • `StickyLayer` — katman (boş alana çift tık → yeni not)
 *   • `StickyNoteCard` — tek not (sürükle, yaz, renk seç, katla, sil)
 *   • `useStickyStore` — kalıcı depo (localStorage)
 */

export { StickyLayer } from "./StickyLayer";
export { StickyNoteCard } from "./StickyNoteCard";
export {
  NOTE_COLORS,
  noteColor,
  useStickyStore,
  type NoteColorId,
  type StickyNote,
} from "./notesStore";
