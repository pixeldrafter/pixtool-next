"""
Kullanıcıya özel kalıcılık (senkron).

Notlar, masaüstü öğeleri/dosyaları gibi küçük JSON blokları **kullanıcı başına**
saklanır. Böylece veri; tarayıcı ↔ masaüstü kabuğu ↔ farklı cihaz arasında
taşınır ve her kullanıcı yalnızca **kendi** verisini görür.

Depo: NocoDB `Settings` tablosu (`Key` / `Value`).

    Key   →  u:<kullanıcı>:<anahtar>      (örn. u:omercataloglu:stickies)
    Value →  JSON metni

Uçlar (hepsi `Authorization: Bearer <oturum tokenı>` ister):

    GET /api/v1/sync/{key}   →  kayıtlı değeri döndürür (yoksa null)
    PUT /api/v1/sync/{key}   →  değeri kaydeder (upsert)
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import verify_token
from app.integrations.nocodb import get_nocodb_client

logger = logging.getLogger("pixtool.sync")

router = APIRouter(prefix="/api/v1/sync", tags=["senkron"])

#: Anahtar güvenliği — yalnızca harf, rakam, `-`, `_`, `.` kabul edilir.
_ALLOWED_KEY = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._")


def _require_user(authorization: str | None) -> str:
    """`Authorization: Bearer <token>` başlığından kullanıcıyı çözer."""
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


def _safe_key(key: str) -> str:
    """Anahtarı doğrular (enjeksiyon / bozuk sorgu önlenir)."""
    if not key or len(key) > 64 or any(char not in _ALLOWED_KEY for char in key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz anahtar.",
        )
    return key


def _full_key(username: str, key: str) -> str:
    return f"u:{username}:{key}"


def _configured() -> bool:
    return bool(settings.nocodb_configured and settings.nocodb_table_settings)


class SyncValue(BaseModel):
    """Kaydedilecek değer (herhangi bir JSON)."""

    value: object | None = None


@router.get("/{key}")
async def get_value(
    key: str,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Kayıtlı değeri döndürür; yoksa `null`."""
    username = _require_user(authorization)
    full = _full_key(username, _safe_key(key))

    if not _configured():
        return {"ok": True, "value": None}

    client = get_nocodb_client()
    try:
        records = await client.list_records(
            settings.nocodb_table_settings,
            limit=1,
            where=f"(Key,eq,{full})",
        )
    except Exception as exc:  # noqa: BLE001 — NocoDB çeşitli hatalar atabilir
        logger.warning("Senkron okunamadı (%s): %s", full, exc)
        return {"ok": False, "value": None, "error": "Depo okunamadı."}

    if not records:
        return {"ok": True, "value": None}

    raw = records[0].get("Value")
    if raw in (None, ""):
        return {"ok": True, "value": None}

    if isinstance(raw, (dict, list)):
        return {"ok": True, "value": raw}

    try:
        return {"ok": True, "value": json.loads(str(raw))}
    except ValueError:
        return {"ok": True, "value": raw}


@router.put("/{key}")
async def put_value(
    key: str,
    payload: SyncValue,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Değeri kaydeder (yoksa ekler, varsa günceller)."""
    username = _require_user(authorization)
    full = _full_key(username, _safe_key(key))

    if not _configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NocoDB yapılandırılmamış (Settings tablosu yok).",
        )

    text = json.dumps(payload.value, ensure_ascii=False)
    client = get_nocodb_client()

    try:
        records = await client.list_records(
            settings.nocodb_table_settings,
            limit=1,
            where=f"(Key,eq,{full})",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Depo sorgulanamadı: {exc}",
        ) from exc

    try:
        if records:
            record_id = records[0].get("Id") or records[0].get("id")
            if record_id is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Kayıt kimliği bulunamadı.",
                )
            await client.update_record(
                settings.nocodb_table_settings,
                record_id,
                {"Value": text},
            )
        else:
            await client.insert_record(
                settings.nocodb_table_settings,
                {"Key": full, "Value": text},
            )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Senkron yazılamadı (%s): %s", full, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Depoya yazılamadı: {exc}",
        ) from exc

    return {"ok": True, "saved": True, "bytes": len(text)}
