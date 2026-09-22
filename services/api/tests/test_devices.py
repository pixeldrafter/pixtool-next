"""
Cihaz raporu testleri.

Kapsam:
  • Rapor kaydı (NocoDB yok → yerel dosya)
  • Cihaz parmak izinin kararlılığı (aynı girdi → aynı kimlik)
  • Farklı makinelerin farklı kimlik alması
  • Liste uç noktası ve limit doğrulaması
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import devices

client = TestClient(app)


@pytest.fixture(autouse=True)
def _temp_reports_file(tmp_path, monkeypatch):
    """Her test için geçici rapor dosyası kullan (gerçek veriyi kirletme)."""
    monkeypatch.setattr(devices, "DATA_DIR", tmp_path)
    monkeypatch.setattr(devices, "REPORTS_FILE", tmp_path / "device-reports.jsonl")
    yield


def _sample_report() -> dict:
    return {
        "report": {
            "browser": {
                "platform": "Win32",
                "language": "tr-TR",
                "timezone": "Europe/Istanbul",
                "online": True,
            },
            "hardware": {
                "logicalCores": 16,
                "deviceMemoryGb": 8,
                "screen": "1920×1080",
                "pixelRatio": 1,
            },
            "gpu": {"renderer": "NVIDIA GeForce RTX 4060"},
        },
        "collected_at": "2026-09-22T12:00:00Z",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }


def test_report_is_saved_locally_when_nocodb_missing() -> None:
    response = client.post("/api/v1/devices/report", json=_sample_report())
    assert response.status_code == 200

    body = response.json()
    assert body["ok"] is True
    assert body["stored_in"] == "local"
    assert body["device_id"].startswith("dev-")


def test_report_writes_jsonl_file() -> None:
    client.post("/api/v1/devices/report", json=_sample_report())

    assert devices.REPORTS_FILE.exists()
    lines = devices.REPORTS_FILE.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1

    record = json.loads(lines[0])
    assert record["device_id"].startswith("dev-")
    assert record["report"]["hardware"]["logicalCores"] == 16


def test_device_id_is_stable_for_same_machine() -> None:
    first = client.post("/api/v1/devices/report", json=_sample_report()).json()
    second = client.post("/api/v1/devices/report", json=_sample_report()).json()
    assert first["device_id"] == second["device_id"]


def test_device_id_differs_for_different_machines() -> None:
    other = _sample_report()
    other["report"]["hardware"]["screen"] = "3840×2160"
    other["report"]["hardware"]["logicalCores"] = 32

    first = client.post("/api/v1/devices/report", json=_sample_report()).json()
    second = client.post("/api/v1/devices/report", json=other).json()

    assert first["device_id"] != second["device_id"]


def test_volatile_fields_do_not_affect_device_id() -> None:
    """Sayfa yükleme süresi gibi geçici alanlar kimliği değiştirmemeli."""
    base = _sample_report()
    base["report"]["performance"] = {"pageLoadMs": 120, "jsHeapMb": 40}

    other = _sample_report()
    other["report"]["performance"] = {"pageLoadMs": 980, "jsHeapMb": 120}

    first = client.post("/api/v1/devices/report", json=base).json()
    second = client.post("/api/v1/devices/report", json=other).json()

    assert first["device_id"] == second["device_id"]


def test_empty_report_is_accepted() -> None:
    response = client.post("/api/v1/devices/report", json={})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_list_devices_returns_saved_reports() -> None:
    client.post("/api/v1/devices/report", json=_sample_report())
    client.post("/api/v1/devices/report", json=_sample_report())

    response = client.get("/api/v1/devices")
    body = response.json()

    assert body["ok"] is True
    assert body["count"] == 2
    assert body["source"] == "local"


def test_list_devices_rejects_bad_limit() -> None:
    assert client.get("/api/v1/devices?limit=0").status_code == 422
    assert client.get("/api/v1/devices?limit=9999").status_code == 422


def test_list_devices_empty_when_no_reports() -> None:
    body = client.get("/api/v1/devices").json()
    assert body["count"] == 0
    assert body["devices"] == []
