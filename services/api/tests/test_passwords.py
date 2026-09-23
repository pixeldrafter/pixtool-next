"""
Parola hash'leme ve doğrulama testleri.
"""

from __future__ import annotations

import hashlib

from app.core.passwords import (
    DEFAULT_ITERATIONS,
    hash_password,
    needs_rehash,
    verify_password,
)


def test_hash_and_verify_roundtrip() -> None:
    stored = hash_password("gizli-parola-123")
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password("gizli-parola-123", stored) is True
    assert verify_password("yanlis", stored) is False


def test_hash_is_salted() -> None:
    """Aynı parola iki kez hash'lenince farklı çıktı vermeli (tuz)."""
    first = hash_password("aynı-parola")
    second = hash_password("aynı-parola")
    assert first != second
    assert verify_password("aynı-parola", first)
    assert verify_password("aynı-parola", second)


def test_verify_plaintext_legacy() -> None:
    """Eski NocoDB kayıtları düz metin içerebilir — doğrulanmalı."""
    assert verify_password("pixtool123", "pixtool123") is True
    assert verify_password("yanlis", "pixtool123") is False


def test_verify_sha256_hex_legacy() -> None:
    digest = hashlib.sha256(b"eski-parola").hexdigest()
    assert verify_password("eski-parola", digest) is True
    assert verify_password("baska", digest) is False


def test_empty_values_rejected() -> None:
    assert verify_password("", "herhangi") is False
    assert verify_password("herhangi", "") is False
    assert verify_password("x", None) is False


def test_malformed_hash_rejected() -> None:
    """Bozuk kayıt güvenli tarafta reddedilmeli, çökmemeli."""
    assert verify_password("x", "pbkdf2_sha256$abc$def$ghi") is False
    assert verify_password("x", "pbkdf2_sha256$") is False
    assert verify_password("x", "$2b$12$gecersiz-bcrypt") is False


def test_needs_rehash() -> None:
    # Düz metin → yükseltilmeli
    assert needs_rehash("pixtool123") is True
    # Güncel hash → hayır
    assert needs_rehash(hash_password("x")) is False
    # Düşük yineleme → evet
    assert needs_rehash(hash_password("x", iterations=1000)) is True
    # Boş → evet
    assert needs_rehash(None) is True
    assert needs_rehash("") is True


def test_default_iterations_are_strong() -> None:
    assert DEFAULT_ITERATIONS >= 200_000, "PBKDF2 yinelemesi çok düşük"
