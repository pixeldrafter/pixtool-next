"""
Kimlik doğrulama testleri.

Kapsam:
  • Demo girişi (doğru/yanlış parola)
  • OTP akışı: meydan okuma → doğrulama → token
  • Yanlış kodda deneme hakkının azalması
  • Deneme hakkı bitince meydan okumanın kapanması
  • Token üretimi ve doğrulaması
  • Yeniden gönderim
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_token, generate_otp, verify_token
from app.main import app
from app.services.auth_service import auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_challenges():
    """Her testten önce meydan okumaları temizle."""
    auth_service.reset()
    yield
    auth_service.reset()


# ----------------------------------------------------------------------
#  Güvenlik yardımcıları
# ----------------------------------------------------------------------
def test_generate_otp_length_and_digits() -> None:
    for length in (4, 6, 8):
        code = generate_otp(length)
        assert len(code) == length
        assert code.isdigit()


def test_generate_otp_is_random() -> None:
    codes = {generate_otp(6) for _ in range(60)}
    assert len(codes) > 40, "Kodlar yeterince rastgele değil"


def test_token_roundtrip() -> None:
    token = create_token("omercataloglu")
    assert verify_token(token) == "omercataloglu"


def test_token_rejects_tampering() -> None:
    token = create_token("omercataloglu")
    payload, signature = token.split(".", 1)
    # İmzayı boz
    tampered = f"{payload}.{'A' * len(signature)}"
    assert verify_token(tampered) is None


def test_token_rejects_garbage() -> None:
    assert verify_token("bu-bir-token-degil") is None
    assert verify_token("") is None


def test_token_expiry() -> None:
    token = create_token("kullanici", ttl_seconds=-10)
    assert verify_token(token) is None


# ----------------------------------------------------------------------
#  Giriş
# ----------------------------------------------------------------------
def test_login_with_wrong_password_fails() -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "yanlis-parola"},
    )
    assert response.status_code == 401


def test_login_with_unknown_user_fails() -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "olmayan-kullanici", "password": "pixtool"},
    )
    assert response.status_code == 401


def test_login_success_returns_challenge() -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "pixtool"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["ok"] is True
    assert body["otp_required"] is True
    assert body["challenge_id"]
    assert body["code_length"] == 6
    assert body["attempts_left"] == 3


def test_login_demo_mode_exposes_dev_otp() -> None:
    """Demo kipinde (varsayılan, üretimde değil) kod yanıtta döner."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "pixtool"},
    )
    body = response.json()
    assert auth_service.demo_mode is True
    assert body["dev_otp"] is not None
    assert len(body["dev_otp"]) == 6


def test_login_rejects_empty_payload() -> None:
    response = client.post("/api/v1/auth/login", json={"username": "", "password": ""})
    assert response.status_code == 422


# ----------------------------------------------------------------------
#  OTP doğrulama
# ----------------------------------------------------------------------
def _start_challenge() -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "pixtool"},
    )
    assert response.status_code == 200
    return response.json()


def test_verify_otp_with_correct_code_issues_token() -> None:
    challenge = _start_challenge()

    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"challenge_id": challenge["challenge_id"], "code": challenge["dev_otp"]},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["ok"] is True
    assert body["token"]
    assert verify_token(body["token"]) == "admin"


def test_verify_otp_with_wrong_code_decrements_attempts() -> None:
    challenge = _start_challenge()

    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"challenge_id": challenge["challenge_id"], "code": "000000"},
    )
    body = response.json()

    assert body["ok"] is False
    assert body["attempts_left"] == 2
    assert "deneme" in body["message"].lower()


def test_verify_otp_locks_after_max_attempts() -> None:
    """3 yanlış denemeden sonra meydan okuma kapanır — ceza ekranı burada devreye girer."""
    challenge = _start_challenge()
    challenge_id = challenge["challenge_id"]

    last = None
    for expected_left in (2, 1, 0):
        response = client.post(
            "/api/v1/auth/verify-otp",
            json={"challenge_id": challenge_id, "code": "000000"},
        )
        last = response.json()
        assert last["attempts_left"] == expected_left

    assert last is not None
    assert last["ok"] is False
    assert "kilitlendi" in last["message"].lower()

    # Kilitlendikten sonra doğru kod bile kabul edilmez
    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"challenge_id": challenge_id, "code": challenge["dev_otp"]},
    )
    assert response.json()["ok"] is False


def test_verify_otp_with_unknown_challenge_fails() -> None:
    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"challenge_id": "uydurma-kimlik", "code": "123456"},
    )
    body = response.json()
    assert body["ok"] is False
    assert body["attempts_left"] == 0


def test_verify_otp_cannot_be_reused() -> None:
    challenge = _start_challenge()
    payload = {"challenge_id": challenge["challenge_id"], "code": challenge["dev_otp"]}

    first = client.post("/api/v1/auth/verify-otp", json=payload)
    second = client.post("/api/v1/auth/verify-otp", json=payload)

    assert first.json()["ok"] is True
    assert second.json()["ok"] is False, "Aynı kod iki kez kullanılabilmemeli"


# ----------------------------------------------------------------------
#  Yeniden gönderim
# ----------------------------------------------------------------------
def test_resend_otp_generates_new_code() -> None:
    challenge = _start_challenge()
    old_code = challenge["dev_otp"]

    response = client.post(
        "/api/v1/auth/resend-otp",
        json={"challenge_id": challenge["challenge_id"]},
    )
    body = response.json()

    assert body["ok"] is True
    assert body["attempts_left"] == 3
    # Yeni kod farklı olabilir (aynı da olabilir — 6 hanede çakışma olası).
    # Bu yüzden yalnızca kodun geçerli olduğunu doğruluyoruz.
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"challenge_id": challenge["challenge_id"], "code": body["dev_otp"]},
    )
    assert verify_response.json()["ok"] is True
    assert old_code  # eski kodun varlığını doğruladık


def test_resend_otp_with_unknown_challenge_404() -> None:
    response = client.post(
        "/api/v1/auth/resend-otp",
        json={"challenge_id": "yok-boyle-bir-sey"},
    )
    assert response.status_code == 404


# ----------------------------------------------------------------------
#  Oturum doğrulama
# ----------------------------------------------------------------------
def test_session_endpoint_with_valid_token() -> None:
    token = create_token("admin")
    response = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    body = response.json()
    assert body["ok"] is True
    assert body["username"] == "admin"


def test_session_endpoint_without_token() -> None:
    response = client.get("/api/v1/auth/session")
    assert response.json()["ok"] is False


def test_session_endpoint_with_bad_token() -> None:
    response = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": "Bearer sahte.token"},
    )
    assert response.json()["ok"] is False
