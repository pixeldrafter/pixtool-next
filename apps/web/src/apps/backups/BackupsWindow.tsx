/**
 * Snapshot (anlık görüntü) penceresi.
 *
 * btrfs'teki snapshot mantığının uygulama karşılığı: masaüstünün o anki hâlini
 * (öğeler, dosyalar, notlar, widget'lar) tek tıkla kaydeder; istediğinde
 * saniyeler içinde o ana döndürür.
 *
 * Veri NocoDB `Backups` tablosunda kullanıcıya bağlı saklanır.
 */

import { useCallback, useEffect, useState } from "react";

import { useItemsStore } from "../../desktop/itemsStore";
import { useStickyStore } from "../../sticky/notesStore";
import { useWidgetsStore } from "../../widgets/widgetsStore";
import {
  createBackup,
  deleteBackup,
  fetchBackup,
  fetchBackups,
  type BackupMeta,
  type SnapshotPayload,
} from "../../lib/backupsApi";
import { toast } from "../../notifications";
import "../apps.css";
import "./backups-window.css";

/** Şu anki masaüstü durumunu toplar. */
function captureSnapshot(): SnapshotPayload {
  const items = useItemsStore.getState();
  const notes = useStickyStore.getState();
  const widgets = useWidgetsStore.getState();
  return {
    items: items.items,
    gridSnap: items.gridSnap,
    seeded: items.seeded,
    notes: notes.notes,
    topZ: notes.topZ,
    widgets: widgets.widgets,
    width: widgets.width,
  };
}

/** Bir snapshot'ı depolara uygular. */
function applySnapshot(payload: SnapshotPayload): void {
  if (Array.isArray(payload.items)) {
    useItemsStore.setState({
      items: payload.items as never,
      gridSnap: typeof payload.gridSnap === "boolean" ? payload.gridSnap : true,
      seeded: true,
    });
  }
  if (Array.isArray(payload.notes)) {
    useStickyStore.setState({
      notes: payload.notes as never,
      topZ: typeof payload.topZ === "number" ? payload.topZ : 1,
    });
  }
  if (Array.isArray(payload.widgets)) {
    useWidgetsStore.setState({ widgets: payload.widgets as never });
  }
}

export function BackupsWindow() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    setBackups(await fetchBackups());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = useCallback(async () => {
    setBusy(true);
    try {
      const name = label.trim() || new Date().toLocaleString("tr-TR");
      const ok = await createBackup(name, captureSnapshot());
      if (ok) {
        toast.ok("Snapshot alındı", name, "Yedek");
        setLabel("");
        await load();
      } else {
        toast.error("Snapshot alınamadı", "Sunucuya yazılamadı", "Yedek");
      }
    } finally {
      setBusy(false);
    }
  }, [label, load]);

  const restore = useCallback(async (backup: BackupMeta) => {
    const data = await fetchBackup(backup.id);
    if (!data) {
      toast.error("Geri yüklenemedi", "Yedek okunamadı", "Yedek");
      return;
    }
    applySnapshot(data.payload);
    toast.ok("Geri yüklendi", data.label, "Yedek");
  }, []);

  const remove = useCallback(
    async (backup: BackupMeta) => {
      const ok = await deleteBackup(backup.id);
      if (ok) {
        setBackups((prev) => prev.filter((item) => item.id !== backup.id));
        toast.info("Yedek silindi", backup.label, "Yedek");
      }
    },
    [],
  );

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Snapshot</h2>
        <span className="app__subtitle">Anlık görüntü al · geri dön</span>
        <span className="app__spacer" />
        <input
          className="app-input"
          type="text"
          placeholder="Yedek adı (isteğe bağlı)…"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <button className="app-btn" onClick={() => void snapshot()} disabled={busy}>
          {busy ? "…" : "📸 Snapshot al"}
        </button>
        <button className="app-btn" onClick={() => void load()} title="Yenile">
          ⟳
        </button>
      </div>

      <div className="app-panel" style={{ flex: 1, overflow: "auto" }}>
        {backups.length === 0 ? (
          <div className="app-empty">
            <span aria-hidden="true">🗃️</span>
            Henüz yedek yok — “Snapshot al” ile masaüstünün o anki hâlini kaydet.
          </div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>Yedek</th>
                <th style={{ width: 180 }}>Tarih</th>
                <th style={{ width: 90 }}>Boyut</th>
                <th style={{ width: 170 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={String(backup.id)}>
                  <td style={{ color: "var(--text-primary)" }}>{backup.label}</td>
                  <td className="app-table__mono">
                    {backup.createdAt ? String(backup.createdAt).slice(0, 19).replace("T", " ") : "—"}
                  </td>
                  <td className="app-table__mono">{(backup.size / 1024).toFixed(1)} KB</td>
                  <td className="db-table__actions">
                    <button className="app-btn" onClick={() => void restore(backup)}>
                      ↩ Geri dön
                    </button>
                    <button className="app-btn" onClick={() => void remove(backup)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
