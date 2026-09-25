"""
Script kütüphanesi uç noktaları.

    GET    /api/v1/scripts              → kütüphaneyi listele
    POST   /api/v1/scripts              → yeni script oluştur
    GET    /api/v1/scripts/stats        → kütüphane özeti
    GET    /api/v1/scripts/{id}         → script içeriği
    PUT    /api/v1/scripts/{id}         → güncelle (ad / tip / kategori / içerik)
    DELETE /api/v1/scripts/{id}         → sil
    POST   /api/v1/scripts/{id}/run     → çalıştır (politika uygulanır)

⚠️ Güvenlik: komut politikası `COMMAND_POLICY` ayarından gelir.
   `confirm` iken çalıştırma **onay bekler** (arayüz onay ister).
   Faz 3'te yerel köprü üzerinden gerçek çalıştırma yapılacak.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import require_admin
from app.models.scripts import (
    RunScriptRequest,
    RunScriptResponse,
    ScriptCreateRequest,
    ScriptDetailResponse,
    ScriptListResponse,
    ScriptMutationResponse,
    ScriptUpdateRequest,
)
from app.services import script_service

logger = logging.getLogger("pixtool.scripts")

router = APIRouter(
    prefix="/api/v1/scripts",
    tags=["scriptler"],
    dependencies=[Depends(require_admin)],
)


def _command_for(script_id: str, extension: str, script_type: str) -> str:
    """Tipe uygun çalıştırma komutunu üretir."""
    if script_type == "powershell" or extension in {".ps1", ".psm1"}:
        return f'powershell -NoProfile -ExecutionPolicy Bypass -File "{script_id}"'
    if script_type == "cmd" or extension in {".cmd", ".bat"}:
        return f'cmd /c "{script_id}"'
    if script_type == "bash" or extension in {".sh", ".bash"}:
        return f'bash "{script_id}"'
    return f'python "{script_id}"'


@router.get("", response_model=ScriptListResponse)
async def list_scripts() -> ScriptListResponse:
    """Kütüphanedeki tüm scriptleri listeler."""
    scripts, categories, kinds = script_service.list_scripts()
    return ScriptListResponse(
        ok=True,
        count=len(scripts),
        categories=categories,
        kinds=kinds,
        scripts=scripts,
    )


@router.get("/stats")
async def library_stats() -> dict[str, object]:
    """Kütüphane özeti (kök, sayı, boyut, özelleştirilmiş adet)."""
    return {"ok": True, **script_service.library_stats()}


@router.post("", response_model=ScriptMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_script(payload: ScriptCreateRequest) -> ScriptMutationResponse:
    """
    Yeni script oluşturur.

    Dosya adı görünen addan üretilir; **kategori ve tip** `.meta.json`'a yazılır.
    Boş içerik verilirse tipe uygun iskelet (şablon) oluşturulur.
    """
    info = script_service.create_script(
        name=payload.name,
        kind=payload.type,
        category=payload.category,
        description=payload.description,
        content=payload.content,
        folder=payload.folder,
    )
    logger.info("Script oluşturuldu: %s (%s)", info.id, info.type)
    return ScriptMutationResponse(
        ok=True,
        message=f"'{info.name}' oluşturuldu.",
        script=info,
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


@router.put("/{script_id}", response_model=ScriptMutationResponse)
async def update_script(
    script_id: str,
    payload: ScriptUpdateRequest,
) -> ScriptMutationResponse:
    """
    Scripti günceller.

    Ad veya tip değişirse dosya **yeniden adlandırılır** (uzantı dahil) ve
    üst veri yeni ada taşınır.
    """
    info = script_service.update_script(
        script_id,
        name=payload.name,
        kind=payload.type,
        category=payload.category,
        description=payload.description,
        content=payload.content,
    )
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script bulunamadı: {script_id}",
        )

    return ScriptMutationResponse(
        ok=True,
        message=f"'{info.name}' güncellendi.",
        script=info,
    )


@router.delete("/{script_id}", response_model=ScriptMutationResponse)
async def delete_script(script_id: str) -> ScriptMutationResponse:
    """Scripti ve üst verisini siler."""
    if not script_service.delete_script(script_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script bulunamadı: {script_id}",
        )

    return ScriptMutationResponse(
        ok=True,
        message=f"'{script_id}' silindi.",
        script=None,
    )


@router.post("/{script_id}/run", response_model=RunScriptResponse)
async def run_script(script_id: str, payload: RunScriptRequest) -> RunScriptResponse:
    """
    Scripti çalıştırır.

    Faz 2 durumu: komut üretilir ve **politika uygulanır**. Gerçek çalıştırma
    yerel köprü (Faz 3) veya SSH üzerinden yapılır.
    """
    result = script_service.read_script(script_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script bulunamadı: {script_id}",
        )

    info, _content = result
    command = _command_for(info.id, info.extension, info.type)

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
