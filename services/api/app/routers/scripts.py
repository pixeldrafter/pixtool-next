"""
Script kütüphanesi uç noktaları.

    GET  /api/v1/scripts              → kütüphaneyi listele
    GET  /api/v1/scripts/{id}         → script içeriği
    POST /api/v1/scripts/{id}/run     → çalıştır (politika uygulanır)

⚠️ Güvenlik: komut politikası `COMMAND_POLICY` ayarından gelir.
   `confirm` iken çalıştırma **onay bekler** (arayüz onay ister).
   Faz 3'te yerel köprü üzerinden gerçek çalıştırma yapılacak.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.models.scripts import (
    RunScriptRequest,
    RunScriptResponse,
    ScriptDetailResponse,
    ScriptListResponse,
)
from app.services import script_service

logger = logging.getLogger("pixtool.scripts")

router = APIRouter(prefix="/api/v1/scripts", tags=["scriptler"])


@router.get("", response_model=ScriptListResponse)
async def list_scripts() -> ScriptListResponse:
    """Kütüphanedeki tüm scriptleri listeler."""
    scripts, categories = script_service.list_scripts()
    return ScriptListResponse(
        ok=True,
        count=len(scripts),
        categories=categories,
        scripts=scripts,
    )


@router.get("/{script_id}", response_model=ScriptDetailResponse)
async def get_script(script_id: str) -> ScriptDetailResponse:
    """Tek bir scriptin içeriğini döndürür."""
    result = script_service.read_script(script_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script bulunamadı: {script_id}",
        )

    info, content = result
    return ScriptDetailResponse(ok=True, script=info, content=content)


@router.post("/{script_id}/run", response_model=RunScriptResponse)
async def run_script(script_id: str, payload: RunScriptRequest) -> RunScriptResponse:
    """
    Scripti çalıştırır.

    Faz 2 durumu: komut üretilir ve **politika uygulanır**. Gerçek çalıştırma
    yerel köprü (Faz 3) veya SSH üzerinden yapılır. Yerel çalıştırma henüz
    kurulmadığı için `status: "pending_bridge"` döner.
    """
    result = script_service.read_script(script_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script bulunamadı: {script_id}",
        )

    info, _content = result

    # Hedefe göre komut üret
    if info.extension == ".ps1":
        command = f'powershell -NoProfile -ExecutionPolicy Bypass -File "{info.id}"'
    elif info.extension in {".sh", ".bash"}:
        command = f'bash "{info.id}"'
    else:
        command = f'python "{info.id}"'

    # Politika uygula
    policy = payload.policy or settings.command_policy

    if policy == "confirm":
        return RunScriptResponse(
            ok=True,
            status="awaiting_confirmation",
            command=command,
            message="Komut politikası 'confirm' — kullanıcı onayı gerekiyor.",
        )

    if policy == "whitelist":
        allowed = {"PixNet_Ag_ve_Internet_Yoneticisi.ps1", "Guc_Raporu.ps1"}
        if info.id not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Komut politikası 'whitelist' — {info.id} izinli listede değil.",
            )

    if settings.is_production and payload.target == "local":
        return RunScriptResponse(
            ok=True,
            status="pending_bridge",
            command=command,
            message=(
                "Yerel çalıştırma yerel köprü (Faz 3) gerektirir. "
                "Köprü kurulduğunda bu komut orada çalıştırılacak."
            ),
        )

    return RunScriptResponse(
        ok=True,
        status="pending_bridge",
        command=command,
        message=(
            "Yerel çalıştırma yerel köprü (Faz 3) üzerinden yapılacak. "
            "SSH hedefi seçildiğinde uzak sunucuda çalıştırılır."
        ),
    )
