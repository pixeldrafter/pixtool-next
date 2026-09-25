"""
Paylaşım uçları — kullanıcılar arası dosya/klasör/not.

    POST   /api/v1/shares           → bir kullanıcıya paylaş
    GET    /api/v1/shares           → bana yapılan paylaşımlar
    DELETE /api/v1/shares/{id}      → paylaşımı kaldır (alıcı)

Paylaşım kaydı NocoDB `Settings` tablosunda `share:<alıcı>:<id>` anahtarıyla
saklanır. İçerik (metin) doğrudan kayda gömülür; böylece alıcı, gönderenin
makinesine erişemese bile paylaşılan metni görebilir.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import require_user
from app.services import access_service

logger = logging.getLogger("pixtool.shares")

router = APIRouter(prefix="/api/v1/shares", tags=["paylaşım"])


class ShareCreatePayload(BaseModel):
    to: str
    kind: str = Field(default="file")
    name: str
    # Metin içeriği (küçük dosyalar için)
    content: str | None = None
    # Orijinal yol (bilgi amaçlı)
    path: str | None = None
    # Kısa not
    note: str | None = None


@router.get("")
async def list_shares(username: str = Depends(require_user)) -> dict[str, Any]:
    """Bana yapılan paylaşımlar."""
    shares = await access_service.list_shares(username)
    return {"ok": True, "count": len(shares), "shares": shares}


@router.get("/recipients")
async def list_recipients(username: str = Depends(require_user)) -> dict[str, Any]:
    """Paylaşım yapılabilecek kullanıcı adları (kendisi hariç)."""
    users = await access_service.list_users()
    names = [str(user["username"]) for user in users if str(user["username"]) != username]
    return {"ok": True, "count": len(names), "users": sorted(names)}


@router.post("")
async def create_share(
    payload: ShareCreatePayload,
    username: str = Depends(require_user),
) -> dict[str, Any]:
    """Bir kullanıcıya dosya/klasör/not paylaş."""
    target = payload.to.strip()
    if not target or target == username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz alıcı.")

    # Alıcı gerçekten var mı?
    if not await access_service.get_user(target):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{target}' kullanıcısı bulunamadı.",
        )

    body: dict[str, Any] = {}
    if payload.content is not None:
        body["content"] = payload.content
    if payload.path:
        body["path"] = payload.path
    if payload.note:
        body["note"] = payload.note

    try:
        share = await access_service.create_share(
            sender=username,
            to=target,
            kind=payload.kind,
            name=payload.name,
            body=body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Paylaşım kaydedilemedi: {exc}",
        ) from exc

    return {"ok": True, "share": share}


@router.delete("/{share_id}")
async def delete_share(share_id: str, username: str = Depends(require_user)) -> dict[str, Any]:
    """Paylaşımı kaldırır (yalnızca alıcı)."""
    try:
        await access_service.delete_share(username, share_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Paylaşım kaldırılamadı: {exc}",
        ) from exc
    return {"ok": True}
