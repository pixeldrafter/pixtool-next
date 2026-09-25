"""
Erişim talebi testleri — yeni kullanıcı kaydı ve parola yenileme.

Telegram/n8n çağrıları **taklit edilir** (monkeypatch); testler ağa çıkmaz.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import access_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_store():
    """Her testten önce talepleri temizle."""
    access_service.reset()
    yield
    access_service.reset()


@pytest.fixture
def notify_ok(monkeypatch):
    """Bildirimi başarılı taklit et."""
    calls: list[str] = []

    async def fake_notify(request):
        calls.append(request.id)
        return True, "telegram"

    monkeypatch.setattr(access_service, "notify", fake_notify)
    return calls


@pytest.fixture
def notify_fail(monkeypatch):
    """Bildirimi başarısız taklit et."""

    async def fake_notify(request):
        return False, "Telegram yapılandırılmamış"

    monkeypatch.setattr(access_service, "notify", fake_notify)


@pytest.fixture
def user_absent(monkeypatch):
    """Kullanıcı yokmuş gibi davran (NocoDB'ye dokunma)."""

    async def fake_exists(username: str) -> bool:
        return False

    from app.routers import access as access_router

    monkeypatch.setattr(access_router, "_user_exists", fake_exists)


@pytest.fixture
def nocodb_ready(monkeypatch):
    """`nocodb_configured` salt-okunur bir özelliktir — sınıf düzeyinde değiştir."""
    from app.core.config import Settings

    monkeypatch.setattr(Settings, "nocodb_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "nocodb_table_users", "fake-users-table", raising=False)


@pytest.fixture
def nocodb_absent(monkeypatch):
    """NocoDB yokmuş gibi davran."""
    from app.core.config import Settings

    monkeypatch.setattr(Settings, "nocodb_configured", property(lambda self: False))


# ----------------------------------------------------------------------
#  Talep oluşturma
# ----------------------------------------------------------------------


def test_register_request_creates_pending(notify_ok, user_absent):
    """Kayıt talebi oluşturulur ve bekleyen durumda döner."""
    response = client.post(
        "/api/v1/access/register-request",
        json={"username": "yeni.kullanici", "full_name": "Test Kişi", "email": "t@ornek.com"},
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["ok"] is True
    assert body["request"]["status"] == "pending"
    assert body["request"]["kind"] == "register"
    assert body["request"]["username"] == "yeni.kullanici"
    assert body["channel"] == "telegram"
    # Geçici parola arayüze sızmamalı
    assert "issued_password" not in body["request"]
    assert notify_ok, "bildirim çağrılmadı"


def test_register_request_normalises_username(notify_ok, user_absent):
    """Türkçe harfler ASCII'ye çevrilir, geçersiz karakterler atılır."""
    response = client.post(
        "/api/v1/access/register-request",
        json={"username": "  Ömer.Cataloğlu!  "},
    )
    assert response.status_code == 200, response.text
    assert response.json()["request"]["username"] == "omer.cataloglu"


def test_register_request_rejects_short_username(notify_ok, user_absent):
    """3 karakterden kısa kullanıcı adı reddedilir."""
    response = client.post("/api/v1/access/register-request", json={"username": "ab"})
    assert response.status_code == 422


def test_register_request_duplicate(notify_ok, monkeypatch):
    """Kayıtlı kullanıcı adı 409 döner."""
    from app.routers import access as access_router

    async def fake_exists(username: str) -> bool:
        return True

    monkeypatch.setattr(access_router, "_user_exists", fake_exists)

    response = client.post("/api/v1/access/register-request", json={"username": "admin"})
    assert response.status_code == 409
    assert "zaten kayıtlı" in response.json()["detail"]


def test_notify_failure_marks_rejected(notify_fail, user_absent):
    """Bildirim gönderilemezse talep reddedilir ve 502 döner."""
    response = client.post("/api/v1/access/register-request", json={"username": "bildirimsiz"})
    assert response.status_code == 502

    # Talep kaydedilmiş ama reddedilmiş olmalı
    listed = client.get("/api/v1/access/requests").json()
    assert listed["count"] == 1
    assert listed["requests"][0]["status"] == "rejected"


def test_forgot_request(notify_ok, user_absent):
    """Parola yenileme talebi oluşturulur."""
    response = client.post("/api/v1/access/forgot-request", json={"username": "omer"})
    assert response.status_code == 200, response.text
    assert response.json()["request"]["kind"] == "forgot"


# ----------------------------------------------------------------------
#  Durum yoklaması
# ----------------------------------------------------------------------


def test_request_status_roundtrip(notify_ok, user_absent):
    """Oluşturulan talep kimliğiyle durum okunabilir."""
    created = client.post(
        "/api/v1/access/register-request", json={"username": "durum.testi"}
    ).json()

    request_id = created["request"]["id"]
    status = client.get(f"/api/v1/access/request/{request_id}")

    assert status.status_code == 200
    assert status.json()["request"]["id"] == request_id
    assert status.json()["request"]["status"] == "pending"


def test_request_status_unknown():
    """Bilinmeyen kimlik 404 döner."""
    assert client.get("/api/v1/access/request/yok-boyle-bir-sey").status_code == 404


# ----------------------------------------------------------------------
#  Karar
# ----------------------------------------------------------------------


def _make_request(username: str = "karar.testi") -> str:
    return client.post("/api/v1/access/register-request", json={"username": username}).json()[
        "request"
    ]["id"]


def test_callback_rejects_without_secret(notify_ok, user_absent, monkeypatch):
    """Secret tanımlıyken imzasız karar 401 döner."""
    monkeypatch.setattr(settings, "n8n_webhook_secret", "gizli-anahtar", raising=False)
    request_id = _make_request()

    response = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": True}
    )
    assert response.status_code == 401


def test_callback_accepts_with_secret(notify_ok, user_absent, nocodb_absent, monkeypatch):
    """Doğru imzayla karar kabul edilir."""
    monkeypatch.setattr(settings, "n8n_webhook_secret", "gizli-anahtar", raising=False)
    request_id = _make_request()

    response = client.post(
        "/api/v1/access/callback",
        json={"request_id": request_id, "approve": False},
        headers={"X-Pixtool-Secret": "gizli-anahtar"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "rejected"


def test_callback_reject_changes_status(notify_ok, user_absent):
    """Red kararı talebi 'rejected' yapar."""
    request_id = _make_request("reddedilecek")

    response = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": False}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"

    status = client.get(f"/api/v1/access/request/{request_id}").json()
    assert status["request"]["status"] == "rejected"
    assert status["request"]["decided_at"] is not None


def test_callback_approve_without_nocodb_fails(notify_ok, user_absent, nocodb_absent):
    """NocoDB yokken onay 'failed' döner (sessizce başarılı görünmemeli)."""
    request_id = _make_request("nocodb.yok")

    response = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": True}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["status"] == "failed"


def test_callback_approve_creates_user(notify_ok, user_absent, nocodb_ready, monkeypatch):
    """NocoDB varken onay kullanıcıyı oluşturur ve parola üretir."""
    from app.routers import access as access_router

    inserted: list[dict] = []

    class FakeClient:
        async def insert_record(self, table, record):
            inserted.append(record)
            return {"Id": 1, **record}

    monkeypatch.setattr(access_router, "get_nocodb_client", lambda: FakeClient())

    sent: list[str] = []

    async def fake_send(username, password, kind):
        sent.append(password)

    monkeypatch.setattr(access_router, "_send_password", fake_send)

    request_id = _make_request("onaylanan")
    response = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": True}
    )

    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True
    assert response.json()["status"] == "approved"

    # Kullanıcı eklendi mi
    assert len(inserted) == 1
    record = inserted[0]
    assert record["Username"] == "onaylanan"
    assert record["IsActive"] is True
    assert record["Role"] == "user"
    # Parola düz metin değil, hash olmalı
    assert record["PasswordHash"] != sent[0]
    assert "pbkdf2" in record["PasswordHash"].lower() or "$" in record["PasswordHash"]

    # Parola yöneticiye gönderildi mi
    assert len(sent) == 1
    assert len(sent[0]) >= 12


def test_callback_twice_is_idempotent(notify_ok, user_absent):
    """Aynı talebe iki kez karar verilirse ikincisi durumu bozmaz."""
    request_id = _make_request("iki.kez")

    first = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": False}
    )
    assert first.json()["status"] == "rejected"

    second = client.post(
        "/api/v1/access/callback", json={"request_id": request_id, "approve": True}
    )
    assert second.status_code == 200
    assert "zaten" in second.json()["message"]


def test_callback_unknown_request(notify_ok):
    """Bilinmeyen talep 404 döner."""
    response = client.post(
        "/api/v1/access/callback", json={"request_id": "bilinmeyen-kimlik", "approve": True}
    )
    assert response.status_code == 404


# ----------------------------------------------------------------------
#  Servis katmanı
# ----------------------------------------------------------------------


def test_expired_request_marked():
    """Süresi geçmiş bekleyen talep 'expired' olur."""
    import time as time_module

    request = access_service.create_request(kind="register", username="suresi.gecti")

    # Oluşturma zamanını geriye çek
    store = access_service._load()  # noqa: SLF001 — test amaçlı
    store[request.id]["created_at"] = time_module.time() - access_service.REQUEST_TTL_SECONDS - 10
    access_service._save(store)  # noqa: SLF001

    fetched = access_service.get_request(request.id)
    assert fetched is not None
    assert fetched.status == "expired"


def test_prune_keeps_latest():
    """Budama en yeni kayıtları korur."""
    for index in range(5):
        access_service.create_request(kind="register", username=f"kullanici{index}")

    listed = access_service.list_requests(limit=100)
    assert len(listed) == 5
