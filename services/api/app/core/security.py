"""
Güvenlik yardımcıları.

Faz 1 kapsamı: HMAC ile imzalanmış **oturum tokenı** üretimi ve doğrulaması.
Tam JWT (kütüphane bağımlılığı) sonraki faza bırakıldı — mevcut ihtiyaç
"değiştirilemez, süreli token" olduğu için HMAC yeterli ve bağımlılıksızdır.

Token biçimi:  base64url(payload).base64url(hmac_sha256(payload, secret))
payload:       "username:issued_at_unix"
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

from app.core.config import settings

#: Varsayılan oturum süresi (saniye) — 12 saat
SESSION_TTL_SECONDS = 12 * 60 * 60


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _secret() -> bytes:
    """
    İmzalama anahtarı.

    `API_SECRET_KEY` boşsa (geliştirme) sabit bir yedek kullanılır ve
    uygulama başlangıçta kullanıcıyı uyarır — bkz. `main.lifespan`.
    """
    key = settings.api_secret_key or "pixtool-development-only-secret"
    return key.encode("utf-8")


def create_token(username: str, ttl_seconds: int = SESSION_TTL_SECONDS) -> str:
    """Kullanıcı için imzalı oturum tokenı üretir."""
    issued_at = int(time.time())
    payload = f"{username}:{issued_at}:{ttl_seconds}"
    signature = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).digest()
    return f"{_b64encode(payload.encode('utf-8'))}.{_b64encode(signature)}"


def verify_token(token: str) -> str | None:
    """
    Tokenı doğrular. Geçerliyse kullanıcı adını, aksi hâlde `None` döndürür.
    """
    try:
        payload_part, signature_part = token.split(".", 1)
        payload = _b64decode(payload_part).decode("utf-8")
        expected = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).digest()
        provided = _b64decode(signature_part)
    except (ValueError, UnicodeDecodeError):
        return None

    if not hmac.compare_digest(expected, provided):
        return None

    parts = payload.rsplit(":", 2)
    if len(parts) != 3:
        return None

    username, issued_at_raw, ttl_raw = parts
    try:
        issued_at = int(issued_at_raw)
        ttl = int(ttl_raw)
    except ValueError:
        return None

    if time.time() - issued_at > ttl:
        return None

    return username


def generate_otp(length: int = 6) -> str:
    """Kriptografik olarak güvenli, `length` haneli sayısal kod üretir."""
    upper = 10**length
    value = secrets.randbelow(upper)
    return str(value).zfill(length)


def generate_id(length: int = 24) -> str:
    """URL güvenli rastgele kimlik üretir (meydan okuma kimliği vb.)."""
    return secrets.token_urlsafe(length)


def constant_time_equals(left: str, right: str) -> bool:
    """Zamanlama saldırısına dirençli karşılaştırma."""
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))
