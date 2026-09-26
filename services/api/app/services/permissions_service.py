"""
Erişim ve paylaşım servisi.

Kimlik doğrulama NocoDB `Users` tablosundan gelir. Bu modül onun üstüne:

  • **rol** (admin / user),
  • **izinler** (`Settings` tablosunda `perm:<kullanıcı>` anahtarıyla JSON),
  • **paylaşımlar** (`Settings` tablosunda `share:<alıcı>:<id>` anahtarıyla)

katmanlarını ekler.

Tüm izin/paylaşım verisi tek tabloda (Settings) tutulur; bu yüzden okurken
kayıtlar çekilip Python tarafında süzülür (NocoDB `where` sözdizimine bağımlı
kalmamak için).
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any

from app.core.config import settings
from app.integrations.nocodb import get_nocodb_client

logger = logging.getLogger("pixtool.access")

#: Tüm izinlere sahip rol.
ADMIN_ROLE = "admin"

#: Yönetici olmayan kullanıcıların varsayılan erişebileceği uygulamalar.
DEFAULT_APPS: list[str] = [
    "overview",
    "files",
    "notes",
    "backups",
    "tools",
    "games",
    "browser",
    "status",
    "about",
    "settings",
]

#: İzin verilebilecek tüm uygulama anahtarları (WindowApp ile eşleşir).
ALL_APPS: list[str] = [
    "overview",
    "scripts",
    "terminal",
    "files",
    "users",
    "database",
    "resources",
    "tools",
    "notes",
    "backups",
    "browser",
    "games",
    "status",
    "settings",
    "about",
]


def _settings_table() -> str:
    return settings.nocodb_table_settings


def _configured() -> bool:
    return bool(settings.nocodb_configured and _settings_table())


async def _all_settings() -> list[dict[str, Any]]:
    """Settings tablosundaki tüm kayıtlar (boşsa boş liste)."""
    if not _configured():
        return []
    client = get_nocodb_client()
    try:
        return await client.list_records(_settings_table(), limit=400)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Settings okunamadı: %s", exc)
        return []


async def _find_setting(key: str) -> dict[str, Any] | None:
    for record in await _all_settings():
        if record.get("Key") == key:
            return record
    return None


async def _put_setting(key: str, value: str) -> None:
    if not _configured():
        raise RuntimeError("NocoDB Settings tablosu yapılandırılmamış.")
    client = get_nocodb_client()
    existing = await _find_setting(key)
    if existing:
        record_id = existing.get("Id") or existing.get("id")
        await client.update_record(_settings_table(), record_id, {"Value": value})
    else:
        await client.insert_record(_settings_table(), {"Key": key, "Value": value})


async def _delete_setting(key: str) -> None:
    if not _configured():
        return
    existing = await _find_setting(key)
    if not existing:
        return
    record_id = existing.get("Id") or existing.get("id")
    client = get_nocodb_client()
    try:
        await client.delete_record(_settings_table(), record_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Settings silinemedi (%s): %s", key, exc)


# ----------------------------------------------------------------------
#  Kullanıcı / rol
# ----------------------------------------------------------------------
async def get_user(username: str) -> dict[str, Any] | None:
    """NocoDB `Users` tablosundan kullanıcı kaydı."""
    table = settings.nocodb_table_users
    if not (settings.nocodb_configured and table):
        return None
    client = get_nocodb_client()
    try:
        records = await client.list_records(table, limit=1, where=f"(Username,eq,{username})")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kullanıcı sorgulanamadı: %s", exc)
        return None
    return records[0] if records else None


async def get_role(username: str) -> str:
    record = await get_user(username)
    role = str(record.get("Role") or "").strip().lower() if record else ""
    return role or "user"


async def is_admin(username: str) -> bool:
    return await get_role(username) == ADMIN_ROLE


async def list_users() -> list[dict[str, Any]]:
    """Tüm uygulama kullanıcıları (parola özeti hariç)."""
    table = settings.nocodb_table_users
    if not (settings.nocodb_configured and table):
        return []
    client = get_nocodb_client()
    try:
        records = await client.list_records(table, limit=200)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kullanıcı listesi alınamadı: %s", exc)
        return []

    return [
        {
            "id": record.get("Id") or record.get("id"),
            "username": record.get("Username"),
            "role": str(record.get("Role") or "user").lower(),
            "active": bool(record.get("IsActive", True)),
            "expiration": record.get("ExpirationDate"),
            "lastLogin": record.get("LastLogin"),
        }
        for record in records
        if record.get("Username")
    ]


async def update_user(record_id: int | str, patch: dict[str, Any]) -> None:
    table = settings.nocodb_table_users
    client = get_nocodb_client()
    await client.update_record(table, record_id, patch)


# ----------------------------------------------------------------------
#  İzinler
# ----------------------------------------------------------------------
async def get_permissions(username: str) -> dict[str, Any]:
    """
    Kullanıcının etkin izinleri.

    Admin → tüm uygulamalar. Diğerleri → `perm:<kullanıcı>` anahtarındaki JSON
    (yoksa varsayılan küme).
    """
    role = await get_role(username)
    if role == ADMIN_ROLE:
        return {"role": role, "apps": ALL_APPS, "all": True}

    record = await _find_setting(f"perm:{username}")
    apps = DEFAULT_APPS
    if record and record.get("Value"):
        try:
            parsed = json.loads(str(record["Value"]))
            if isinstance(parsed, dict) and isinstance(parsed.get("apps"), list):
                apps = [str(item) for item in parsed["apps"] if item in ALL_APPS]
        except ValueError:
            pass
    return {"role": role, "apps": apps, "all": False}


async def set_permissions(username: str, apps: list[str]) -> dict[str, Any]:
    clean = [item for item in apps if item in ALL_APPS]
    await _put_setting(f"perm:{username}", json.dumps({"apps": clean}, ensure_ascii=False))
    return {"apps": clean}


# ----------------------------------------------------------------------
#  Paylaşımlar
# ----------------------------------------------------------------------
def _share_key(to: str, share_id: str) -> str:
    return f"share:{to}:{share_id}"


async def list_shares(to: str) -> list[dict[str, Any]]:
    """Bir kullanıcıya yapılan paylaşımlar."""
    prefix = f"share:{to}:"
    results: list[dict[str, Any]] = []
    for record in await _all_settings():
        key = str(record.get("Key") or "")
        if not key.startswith(prefix):
            continue
        raw = record.get("Value")
        if not raw:
            continue
        try:
            data = json.loads(str(raw))
        except ValueError:
            continue
        if isinstance(data, dict):
            data.setdefault("id", key[len(prefix):])
            results.append(data)
    results.sort(key=lambda item: item.get("createdAt") or 0, reverse=True)
    return results


async def create_share(
    sender: str,
    to: str,
    kind: str,
    name: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Bir kullanıcıya dosya/klasör/not paylaşır."""
    if not to or to == sender:
        raise ValueError("Geçersiz alıcı.")

    share_id = secrets.token_urlsafe(8)
    payload: dict[str, Any] = {
        "id": share_id,
        "from": sender,
        "to": to,
        "kind": kind,
        "name": name,
        "createdAt": int(time.time() * 1000),
    }
    if body:
        payload.update(body)

    await _put_setting(_share_key(to, share_id), json.dumps(payload, ensure_ascii=False))
    return payload


async def delete_share(to: str, share_id: str) -> None:
    await _delete_setting(_share_key(to, share_id))
