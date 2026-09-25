"""
Veritabanı uç noktaları — NocoDB tarayıcısı.

    GET /api/v1/database/tables                    → base içindeki tablolar
    GET /api/v1/database/tables/{table_id}/records → tablo kayıtları

Salt okunurdur (kişisel kullanım panosu). Kayıt ekleme/silme NocoDB panelinden
yapılır; buradaki amaç hızlıca **bakmak** ve **aramak**.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status

from app.core.config import settings
from app.integrations.nocodb import NocoDBClient, get_nocodb_client

logger = logging.getLogger("pixtool.database")

router = APIRouter(prefix="/api/v1/database", tags=["veritabanı"])


@router.get("/tables")
async def list_tables() -> dict[str, object]:
    """Yapılandırılmış NocoDB base'indeki tabloları listeler."""
    if not settings.nocodb_configured or not settings.nocodb_base_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NocoDB yapılandırılmamış (BASE_URL, API_TOKEN veya BASE_ID eksik).",
        )

    client: NocoDBClient = get_nocodb_client()
    try:
        tables = await client.list_tables()
    except Exception as exc:  # noqa: BLE001 — istemci çeşitli hatalar atabilir
        logger.warning("Tablo listesi alınamadı: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NocoDB'ye ulaşılamadı: {exc}",
        ) from exc

    return {"ok": True, "count": len(tables), "tables": tables}


@router.get("/tables/{table_id}/records")
async def list_records(
    table_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    where: str | None = Query(default=None),
) -> dict[str, object]:
    """Bir tablonun kayıtlarını listeler (isteğe bağlı filtre)."""
    if not settings.nocodb_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NocoDB yapılandırılmamış.",
        )

    client: NocoDBClient = get_nocodb_client()
    try:
        records = await client.list_records(table_id, limit=limit, where=where)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kayıtlar alınamadı (%s): %s", table_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Kayıtlar alınamadı: {exc}",
        ) from exc

    # Sütun adlarını ilk kayıttan çıkar (tablo başlığı için)
    columns: list[str] = []
    if records:
        columns = [key for key in records[0] if key not in {"nc_order"}]

    return {
        "ok": True,
        "table_id": table_id,
        "count": len(records),
        "columns": columns,
        "records": records,
    }
