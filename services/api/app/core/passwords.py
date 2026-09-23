"""
Parola saklama ve doğrulama.

## Neden stdlib?

`bcrypt`/`argon2` ek bağımlılık gerektirir. Yerleşik `hashlib.pbkdf2_hmac`
güvenli ve yeterlidir (NIST onaylı KDF).

## Saklama biçimi

    pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>

## Geriye dönük uyumluluk

NocoDB `Users` tablosundaki eski kayıtlar **düz metin** parola içerebilir
(`PasswordHash: "pixtool123"` gibi). Bunlar da doğrulanır — ama
`needs_rehash()` ile tespit edilip yükseltilebilir.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

#: PBKDF2 yineleme sayısı (2024+ önerisi)
DEFAULT_ITERATIONS = 260_000

#: Üretilen hash öneki
PREFIX = "pbkdf2_sha256"

#: Desteklenen eski biçimler (yalnızca doğrulama için)
_LEGACY_PREFIXES = ("$2a$", "$2b$", "$2y$", "pbkdf2:")


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.b64decode(value + padding)


def hash_password(password: str, iterations: int = DEFAULT_ITERATIONS) -> str:
    """
    Parolayı PBKDF2-SHA256 ile hash'ler.

    Dönen biçim: `pbkdf2_sha256$<iter>$<salt>$<hash>`
    """
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=32,
    )
    return f"{PREFIX}${iterations}${_b64(salt)}${_b64(digest)}"


def _verify_pbkdf2(password: str, stored: str) -> bool:
    """Kendi biçimimizi doğrular."""
    try:
        _prefix, iterations_raw, salt_raw, hash_raw = stored.split("$", 3)
        iterations = int(iterations_raw)
        salt = _unb64(salt_raw)
        expected = _unb64(hash_raw)
    except (ValueError, TypeError):
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=len(expected),
    )
    return hmac.compare_digest(digest, expected)


def _verify_sha256_hex(password: str, stored: str) -> bool:
    """Düz SHA-256 (64 hex) — eski kayıtlar için."""
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, stored.lower())


def verify_password(password: str, stored: str | None) -> bool:
    """
    Parolayı saklanan değerle karşılaştırır.

    Desteklenen biçimler:
      • `pbkdf2_sha256$…`  (önerilen)
      • 64 karakter hex    (SHA-256)
      • düz metin          (eski NocoDB kayıtları — sabit zamanlı)

    ⚠️ Boş parola hiçbir zaman kabul edilmez.
    """
    if not stored or not password:
        return False

    stored = stored.strip()

    if stored.startswith(PREFIX + "$"):
        return _verify_pbkdf2(password, stored)

    # bcrypt — kütüphane yoksa doğrulanamaz (güvenli taraf: reddet)
    if stored.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt  # type: ignore[import-not-found]
        except ImportError:
            return False
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
        except (ValueError, TypeError):
            return False

    # Düz SHA-256 hex
    if len(stored) == 64 and all(c in "0123456789abcdefABCDEF" for c in stored):
        return _verify_sha256_hex(password, stored)

    # Düz metin (eski kayıtlar) — sabit zamanlı karşılaştırma
    return hmac.compare_digest(password, stored)


def needs_rehash(stored: str | None) -> bool:
    """
    Saklanan değer güncellenmeli mi?

    Düz metin veya eski biçim ise `True` → girişte otomatik yükseltilebilir.
    """
    if not stored:
        return True
    stored = stored.strip()

    if stored.startswith(PREFIX + "$"):
        try:
            iterations = int(stored.split("$")[1])
        except (IndexError, ValueError):
            return True
        return iterations < DEFAULT_ITERATIONS

    # Düz metin, hex veya bcrypt → yükseltilmeli (bcrypt hariç tutulabilir)
    return not stored.startswith(("$2a$", "$2b$", "$2y$"))


__all__ = [
    "DEFAULT_ITERATIONS",
    "hash_password",
    "needs_rehash",
    "verify_password",
]
