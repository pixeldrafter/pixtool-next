"""
Erişim talebi modelleri — yeni kullanıcı kaydı ve parola yenileme.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class RegisterRequestBody(BaseModel):
    """Yeni kullanıcı kaydı isteği."""

    username: str = Field(min_length=3, max_length=40)
    full_name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=160)
    note: str = Field(default="", max_length=400)


class ForgotRequestBody(BaseModel):
    """Parola yenileme isteği."""

    username: str = Field(min_length=3, max_length=40)
    note: str = Field(default="", max_length=400)


class AccessCallbackRequest(BaseModel):
    """n8n / Telegram karar bildirimi."""

    request_id: str = Field(min_length=4, max_length=120)
    approve: bool
    decided_by: str = Field(default="telegram", max_length=80)


class AccessRequestResponse(BaseModel):
    """Talep oluşturma / durum yanıtı."""

    ok: bool
    request: dict[str, Any]
    #: Bildirimin hangi kanaldan gittiği (n8n, telegram)
    channel: str | None = None


class AccessDecisionResponse(BaseModel):
    """Karar uygulama sonucu."""

    ok: bool
    status: Literal["pending", "approved", "rejected", "expired", "failed"]
    message: str


class AccessListResponse(BaseModel):
    """Talep listesi."""

    ok: bool
    count: int
    requests: list[dict[str, Any]]
