"""
Uzak erişim uç noktaları (SSH / SFTP).

    POST /api/v1/remote/exec          → uzak komut çalıştır
    POST /api/v1/remote/list          → uzak dizin listele
    POST /api/v1/remote/info          → uzak sistem bilgisi
    GET  /api/v1/remote/status        → SSH yapılandırma durumu

⚠️ GÜVENLİK: komut çalıştırma `COMMAND_POLICY` ayarına tabidir.
   `confirm` politikasında uç nokta **403** döner ve arayüz onay ister.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import require_admin
from app.models.remote import (
    RemoteInfoResponse,
    SftpListRequest,
    SftpListResponse,
    SshExecRequest,
    SshExecResponse,
    SshTarget,
)
from app.services import ssh_service

logger = logging.getLogger("pixtool.remote")

router = APIRouter(
    prefix="/api/v1/remote",
    tags=["uzak erişim"],
    dependencies=[Depends(require_admin)],
)


@router.get("/status")
async def remote_status() -> dict:
    """SSH yapılandırması ve bağımlılık durumu."""
    return {
        "ok": True,
        "paramiko_available": ssh_service.PARAMIKO_AVAILABLE,
        "default_host_set": bool(settings.ssh_default_host),
        "default_user_set": bool(settings.ssh_default_user),
        "default_host": settings.ssh_default_host or None,
        "default_user": settings.ssh_default_user or None,
        "command_policy": settings.command_policy,
        "hint": (
            None
            if ssh_service.PARAMIKO_AVAILABLE
            else "paramiko kurulu değil — SSH özellikleri çalışmaz."
        ),
    }


@router.post("/exec", response_model=SshExecResponse)
async def exec_command(payload: SshExecRequest) -> SshExecResponse:
    """
    Uzak sunucuda komut çalıştırır.

    Politika `confirm` ise **ilk istek 403** döner; arayüz kullanıcıdan onay
    ister ve onaydan sonra `confirmed: true` ile tekrar gönderir.

    Politika `allow_all` ise doğrudan çalışır.
    """
    if settings.command_policy == "confirm" and not payload.confirmed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Komut politikası 'confirm'. Çalıştırmak için arayüzden onay verin. "
                f"Komut: {payload.command[:120]}"
            ),
        )

    try:
        result = ssh_service.exec_command(payload)
    except ssh_service.SshError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return SshExecResponse(
        ok=True,
        stdout=result["stdout"],
        stderr=result["stderr"],
        exit_code=result["exit_code"],
        duration_ms=result["duration_ms"],
        message=f"{result['duration_ms']} ms",
    )


@router.post("/list", response_model=SftpListResponse)
async def list_directory(payload: SftpListRequest) -> SftpListResponse:
    """Uzak dizini listeler (salt okunur)."""
    try:
        entries = ssh_service.list_directory(payload.target, payload.path)
    except ssh_service.SshError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return SftpListResponse(ok=True, path=payload.path, entries=entries)


@router.post("/info", response_model=RemoteInfoResponse)
async def remote_info(target: SshTarget | None = None) -> RemoteInfoResponse:
    """Uzak sistem bilgisini toplar (salt okunur komutlar)."""
    try:
        info = ssh_service.system_info(target or SshTarget())
    except ssh_service.SshError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return RemoteInfoResponse(ok=True, **info)
