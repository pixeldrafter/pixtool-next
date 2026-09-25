/**
 * Paylaşım diyaloğu — bir masaüstü öğesini başka bir kullanıcıya paylaşır.
 *
 * Alıcı listesi `/api/v1/shares/recipients`'tan gelir. Dosyanın metin içeriği
 * paylaşıma gömülür; böylece alıcı, gönderenin makinesine erişemese bile
 * paylaşılan metni kendi masaüstünde görür.
 */

import { useCallback, useEffect, useState } from "react";

import { API_BASE } from "../lib/apiBase";
import { useAccessStore } from "../lib/accessStore";
import { createShare } from "../lib/shareApi";
import { toast } from "../notifications";

interface ShareDialogProps {
  item: { label: string; kind: string; content?: string; extension?: string };
  onClose: () => void;
}

export function ShareDialog({ item, onClose }: ShareDialogProps) {
  const token = useAccessStore((state) => state.token);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/shares/recipients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { users?: string[] };
        setRecipients(data.users ?? []);
        setSelected(data.users?.[0] ?? "");
      } catch {
        /* liste alınamadı */
      }
    })();
  }, [token]);

  const submit = useCallback(async () => {
    if (!selected) {
      setError("Alıcı seç.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createShare(token, {
        to: selected,
        kind: item.kind,
        name: item.label,
        content: item.content,
        note: note.trim() || undefined,
      });
      toast.ok("Paylaşıldı", `${item.label} → ${selected}`, "Paylaşım");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Paylaşım başarısız.");
    } finally {
      setBusy(false);
    }
  }, [selected, token, item, note, onClose]);

  return (
    <div className="txtedit" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="txtedit__box share" onClick={(event) => event.stopPropagation()}>
        <header className="txtedit__head">
          <span className="txtedit__icon">🔗</span>
          <strong>Paylaş — {item.label}</strong>
        </header>

        <div className="share__body">
          <label className="share__label">
            Alıcı
            <select
              className="share__select"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {recipients.length === 0 && <option value="">Kullanıcı yok</option>}
              {recipients.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="share__label">
            Not (isteğe bağlı)
            <input
              className="share__select"
              type="text"
              value={note}
              placeholder="Kısa bir açıklama…"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error && <div className="share__error">{error}</div>}
        </div>

        <footer className="txtedit__actions">
          <span className="txtedit__count" />
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "Paylaşılıyor…" : "Paylaş"}
          </button>
        </footer>
      </div>
    </div>
  );
}
