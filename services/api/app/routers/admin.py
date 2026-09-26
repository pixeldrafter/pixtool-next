"""
Yönetici uçları — kullanıcı yönetimi ve yetkiler.

    GET   /api/v1/admin/me                          → kendi rol + izinler
    GET   /api/v1/admin/users                       → kullanıcılar (yönetici)
    PATCH /api/v1/admin/users/{record_id}           → rol/durum güncelle (yönetici)
    PUT   /api/v1/admin/users/{username}/permissions → uygulama izinleri (yönetici)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import require_admin, require_user
from app.services import permissions_service

logger = logging.getLogger("pixtool.admin")

router = APIRouter(prefix="/api/v1/admin", tags=["yönetim"])


class PermissionsPayload(BaseModel):
    apps: list[str] = Field(default_factory=list)


class UserUpdatePayload(BaseModel):
    role: str | None = None
    active: bool | None = None
    expiration: str | None = None


@router.get("/me")
async def me(username: str = Depends(require_user)) -> dict[str, Any]:
    """Kendi rolü ve etkin izinleri."""
    permissions = await permissions_service.get_permissions(username)
    return {"ok": True, "username": username, **permissions}


@router.get("/users")
async def users(_admin: str = Depends(require_admin)) -> dict[str, Any]:
    """Tüm uygulama kullanıcıları + izinleri."""
    listed = await permissions_service.list_users()
    enriched: list[dict[str, Any]] = []
    for user in listed:
        permissions = await permissions_service.get_permissions(str(user["username"]))
        enriched.append({**user, "permissions": permissions})
    return {
        "ok": True,
        "count": len(enriched),
        "users": enriched,
        "allApps": permissions_service.ALL_APPS,
    }


@router.patch("/users/{record_id}")
async def update_user(
    record_id: str,
    payload: UserUpdatePayload,
    _admin: str = Depends(require_admin),
) -> dict[str, Any]:
    """Kullanıcının rolünü / etkinlik durumunu günceller."""
    patch: dict[str, Any] = {}
    if payload.role is not None:
        role = payload.role.strip().lower()
        if role not in {"admin", "user"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz rol.")
        patch["Role"] = role
    if payload.active is not None:
        patch["IsActive"] = bool(payload.active)
    if payload.expiration is not None:
        patch["ExpirationDate"] = payload.expiration or None

    if not patch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Güncellenecek alan yok.",
        )

    try:
        await permissions_service.update_user(record_id, patch)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Kullanıcı güncellenemedi: {exc}",
        ) from exc

    return {"ok": True, "updated": list(patch.keys())}


@router.put("/users/{username}/permissions")
async def set_permissions(
    username: str,
    payload: PermissionsPayload,
    _admin: str = Depends(require_admin),
) -> dict[str, Any]:
    """Kullanıcının erişebileceği uygulamaları ayarlar."""
    if await permissions_service.is_admin(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yönetici kullanıcının izinleri kısıtlanamaz.",
        )
    try:
        result = await permissions_service.set_permissions(username, payload.apps)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"İzinler kaydedilemedi: {exc}",
        ) from exc
    return {"ok": True, "username": username, **result}
