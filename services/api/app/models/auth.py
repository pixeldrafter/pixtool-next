"""
Kimlik doğrulama modelleri (Pydantic v2).

İstek / yanıt sözleşmeleri. Arayüzdeki TypeScript tipleri
(`apps/web/src/login/api.ts`) bunlarla birebir eşleşir.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Giriş isteği."""

    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


class LoginResponse(BaseModel):
    """Giriş yanıtı — OTP gerekiyorsa meydan okuma bilgileri döner."""

    ok: bool
    otp_required: bool
    challenge_id: str | None = None
    code_length: int | None = None
    attempts_left: int | None = None
    channel: str | None = None
    token: str | None = None
    message: str | None = None
    #: Yalnızca geliştirme kipinde doldurulur (Telegram/n8n yoksa)
    dev_otp: str | None = None


class VerifyOtpRequest(BaseModel):
    """OTP doğrulama isteği."""

    challenge_id: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=12)


class VerifyOtpResponse(BaseModel):
    """OTP doğrulama yanıtı."""

    ok: bool
    token: str | None = None
    attempts_left: int | None = None
    message: str | None = None


class ResendOtpRequest(BaseModel):
    """OTP yeniden gönderim isteği."""

    challenge_id: str = Field(min_length=1, max_length=120)


class ResendOtpResponse(BaseModel):
    """OTP yeniden gönderim yanıtı."""

    ok: bool
    challenge_id: str | None = None
    attempts_left: int | None = None
    message: str | None = None
    dev_otp: str | None = None


class SessionInfo(BaseModel):
    """Oturum doğrulama yanıtı."""

    ok: bool
    username: str | None = None
    message: str | None = None
