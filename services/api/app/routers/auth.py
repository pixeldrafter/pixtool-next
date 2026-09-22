"""
Kimlik doğrulama uç noktaları.

    POST /api/v1/auth/login       → şifre + OTP gönderimi
    POST /api/v1/auth/verify-otp  → kod doğrulama
    POST /api/v1/auth/resend-otp  → kodu yeniden gönder
    GET  /api/v1/auth/session     → token doğrulama
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status

from app.core.security import verify_token
from app.models.auth import (
    LoginRequest,
    LoginResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    SessionInfo,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["kimlik"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    """
    Kullanıcı adı ve parolayı doğrular, ardından OTP meydan okuması üretir.

    Demo kipinde `dev_otp` alanında kodu da döndürür (arayüzde gösterilir).
    """
    ok, message = auth_service.authenticate(payload.username, payload.password)

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
        )

    challenge = auth_service.create_challenge(payload.username)

    return LoginResponse(
        ok=True,
        otp_required=True,
        challenge_id=challenge.challenge_id,
        code_length=len(challenge.code),
        attempts_left=challenge.attempts_left,
        channel=auth_service.otp_channel,
        message="Doğrulama kodu gönderildi.",
        dev_otp=challenge.code if auth_service.demo_mode else None,
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(payload: VerifyOtpRequest) -> VerifyOtpResponse:
    """OTP kodunu doğrular; başarılıysa oturum tokenı döndürür."""
    ok, message, attempts_left, username = auth_service.verify_otp(
        payload.challenge_id, payload.code
    )

    if not ok or username is None:
        return VerifyOtpResponse(
            ok=False,
            attempts_left=attempts_left,
            message=message,
        )

    token = auth_service.issue_token(username)

    return VerifyOtpResponse(ok=True, token=token, message=message)


@router.post("/resend-otp", response_model=ResendOtpResponse)
async def resend_otp(payload: ResendOtpRequest) -> ResendOtpResponse:
    """Aynı oturum için yeni bir kod üretir."""
    challenge = auth_service.resend_otp(payload.challenge_id)

    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doğrulama oturumu bulunamadı veya süresi doldu.",
        )

    return ResendOtpResponse(
        ok=True,
        challenge_id=challenge.challenge_id,
        attempts_left=challenge.attempts_left,
        message="Yeni kod gönderildi.",
        dev_otp=challenge.code if auth_service.demo_mode else None,
    )


@router.get("/session", response_model=SessionInfo)
async def session(authorization: str | None = Header(default=None)) -> SessionInfo:
    """`Authorization: Bearer <token>` başlığını doğrular."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return SessionInfo(ok=False, message="Token bulunamadı.")

    token = authorization.split(" ", 1)[1].strip()
    username = verify_token(token)

    if username is None:
        return SessionInfo(ok=False, message="Token geçersiz veya süresi dolmuş.")

    return SessionInfo(ok=True, username=username)
