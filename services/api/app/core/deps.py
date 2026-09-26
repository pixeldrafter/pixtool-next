"""
FastAPI bağımlılıkları — kimlik ve yetki.

`Authorization: Bearer <token>` başlığından kullanıcıyı çözer; yönetici
gerektiren uçlarda rolü doğrular.
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.core.security import verify_token
from app.services import permissions_service


async def require_user(authorization: str | None = Header(default=None)) -> str:
    """Oturum açmış kullanıcı adını döndürür."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kimlik doğrulanmadı (Bearer token gerekli).",
        )
    username = verify_token(authorization.split(" ", 1)[1].strip())
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum geçersiz veya süresi dolmuş.",
        )
    return username


async def require_admin(username: str = Depends(require_user)) -> str:
    """Yalnızca yönetici rolündeki kullanıcıya izin verir."""
    if not await permissions_service.is_admin(username):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yönetici yetkisi gerekli.",
        )
    return username
