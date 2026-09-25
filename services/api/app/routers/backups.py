"""
Anlık görüntü (snapshot) uçları — kullanıcı verisinin yedekleri.

btrfs'teki snapshot mantığının uygulama karşılığı: o anki masaüstü durumunun
(öğeler, dosyalar, notlar, widget'lar) bir kopyası saklanır ve istenirse
saniyeler içinde geri yüklenir.

    GET    /api/v1/backups          → kendi yedeklerini listeler
    POST   /api/v1/backups          → yeni snapshot (etiket + içerik)
    GET    /api/v1/backups/{id}     → snapshot içeriği
    DELETE /api/v1/backups/{id}     → yedeği sil

Depo: NocoDB `Backups` tablosu.

    Filename  → etiket
    Note      → JSON (yedek içeriği)
    Size      → bayt
    CreatedBy → kullanıcı adı
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import require_user
from app.integrations.nocodb import get_nocodb_client

logger = logging.getLogger("pixtool.backups")

router = APIRouter(prefix="/api/v1/backups", tags=["yedek"])


class BackupCreatePayload(BaseModel):
    label: str
    payload: dict[str, Any]


def _configured() -> bool:
    return bool(settings.nocodb_configured and settings.nocodb_table_backups)


async def _all() -> list[dict[str, Any]]:
    if not _configured():
        return []
    client = get_nocodb_client()
    try:
        return await client.list_records(settings.nocodb_table_backups, limit=300)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Backups okunamadı: %s", exc)
        return []


@router.get("")
async def list_backups(username: str = Depends(require_user)) -> dict[str, Any]:
    """Kendi yedeklerini listeler (içerik hariç)."""
    records = await _all()
    items: list[dict[str, Any]] = []
    for record in records:
        if str(record.get("CreatedBy") or "") != username:
            continue
        items.append(
            {
                "id": record.get("Id") or record.get("id"),
                "label": record.get("Filename") or "Yedek",
                "size": record.get("Size") or 0,
                "createdAt": record.get("CreatedAt"),
            }
        )
    items.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
    return {"ok": True, "count": len(items), "backups": items}


@router.post("")
async def create_backup(
    payload: BackupCreatePayload,
    username: str = Depends(require_user),
) -> dict[str, Any]:
    """Yeni snapshot oluşturur."""
    if not _configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NocoDB Backups tablosu yapılandırılmamış.",
        )

    text = json.dumps(payload.payload, ensure_ascii=False)
    client = get_nocodb_client()
    try:
        record = await client.insert_record(
            settings.nocodb_table_backups,
            {
                "Filename": payload.label[:120] or "Yedek",
                "Note": text,
                "Size": len(text),
                "CreatedBy": username,
            },
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Yedek kaydedilemedi: {exc}",
        ) from exc

    return {"ok": True, "id": record.get("Id") or record.get("id")}


@router.get("/{backup_id}")
async def get_backup(backup_id: str, username: str = Depends(require_user)) -> dict[str, Any]:
    """Snapshot içeriğini döndürür (geri yükleme için)."""
    for record in await _all():
        record_id = str(record.get("Id") or record.get("id") or "")
        if record_id != str(backup_id):
            continue
        if str(record.get("CreatedBy") or "") != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu yedek sana ait değil.",
            )
        raw = record.get("Note") or "{}"
        try:
            data = json.loads(str(raw))
        except ValueError:
            data = {}
        return {"ok": True, "label": record.get("Filename") or "Yedek", "payload": data}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yedek bulunamadı.")


@router.delete("/{backup_id}")
async def delete_backup(backup_id: str, username: str = Depends(require_user)) -> dict[str, Any]:
    """Yedeği siler (yalnızca sahibi)."""
    for record in await _all():
        record_id = str(record.get("Id") or record.get("id") or "")
        if record_id != str(backup_id):
            continue
        if str(record.get("CreatedBy") or "") != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu yedek sana ait değil.",
            )
        client = get_nocodb_client()
        try:
            await client.delete_record(settings.nocodb_table_backups, record_id)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Yedek silinemedi: {exc}",
            ) from exc
        return {"ok": True}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yedek bulunamadı.")
