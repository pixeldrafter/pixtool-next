"""
Faz 0 duman testleri — backend ayakta mı, uç noktalar yanıt veriyor mu?

Çalıştırma:
    cd services/api
    .venv\\Scripts\\python.exe -m pytest -v
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_root_returns_service_identity() -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == settings.app_name
    assert "version" in body


def test_health_is_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_status_reports_configuration_shape() -> None:
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    body = response.json()

    # Beklenen üst düzey anahtarlar
    for key in ("app", "features", "integrations", "warnings"):
        assert key in body, f"eksik anahtar: {key}"

    # NocoDB durumu raporlanıyor mu
    nocodb = body["integrations"]["nocodb"]
    for key in ("configured", "placeholder", "reachable", "ok", "detail"):
        assert key in nocodb, f"nocodb içinde eksik anahtar: {key}"

    # Uyarılar liste olmalı
    assert isinstance(body["warnings"], list)


def test_status_runs_without_nocodb_configuration() -> None:
    """NocoDB ayarlanmamış olsa bile uç nokta çökmemeli."""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    nocodb = response.json()["integrations"]["nocodb"]
    # Bağlanamıyorsa bunun nedeni açıklanmış olmalı
    if not nocodb["ok"]:
        assert nocodb["detail"], "başarısız bağlantı için açıklama yok"


def test_openapi_schema_is_available() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == settings.app_name
