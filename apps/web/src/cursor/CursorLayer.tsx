/**
 * İmleç katmanı.
 *
 * Ayardaki `appearance.cursor.kind` değerine göre uygun imleci çizer ve
 * sistem imlecini gizler.
 *
 * Kullanım: `App` içinde bir kez, en üst katmanda.
 */

import { useSettingsStore } from "../settings/store";
import { ReptileCursor } from "./ReptileCursor";
import { SpiderCursor } from "./SpiderCursor";
import "./CursorLayer.css";

export function CursorLayer() {
  const cursor = useSettingsStore((state) => state.settings.appearance.cursor);

  // Sistem imleci → özel katman gerekmez
  if (cursor.kind === "default") {
    return null;
  }

  return (
    <div className={`cursor-layer cursor-layer--${cursor.kind}`} aria-hidden="true">
      {cursor.kind === "spider" && <SpiderCursor trail={cursor.trail} />}
      {cursor.kind === "reptile" && <ReptileCursor trail={cursor.trail} />}
    </div>
  );
}
