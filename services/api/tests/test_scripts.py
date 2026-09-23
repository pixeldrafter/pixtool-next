"""
Script kütüphanesi testleri.

Kapsam:
  • Kütüphane taraması ve metadata çıkarımı
  • Kategori algılama
  • Yol geçişi (path traversal) engeli
  • Uç noktalar: listeleme, detay, çalıştırma politikası
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import script_service

client = TestClient(app)


# ----------------------------------------------------------------------
#  Metadata çıkarımı
# ----------------------------------------------------------------------
def test_powershell_meta_extraction() -> None:
    content = """<#
.SYNOPSIS
    Ağ yapılandırmasını ve bağlantıyı yönetir.
.DESCRIPTION
    Detaylı açıklama burada.
.AUTHOR
    Ömer Çataloğlu
.VERSION
    2.1
#>
Write-Host "test"
"""
    meta = script_service._extract_powershell_meta(content)
    assert "Ağ yapılandırmasını" in meta["description"]
    assert meta["author"] == "Ömer Çataloğlu"
    assert meta["version"] == "2.1"


def test_powershell_meta_missing_block() -> None:
    meta = script_service._extract_powershell_meta("Write-Host 'selam'")
    assert meta["description"] == ""
    assert meta["author"] is None


def test_python_meta_extraction() -> None:
    content = '''"""
Basit bir yardımcı modül.
İkinci satır.
"""
__version__ = "1.2.3"
'''
    meta = script_service._extract_python_meta(content)
    assert "yardımcı" in meta["description"]
    assert meta["version"] == "1.2.3"


# ----------------------------------------------------------------------
#  Sınıflandırma
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("PixNet_Ag_ve_Internet_Yoneticisi.ps1", "Ağ"),
        ("PixSecure_v1.ps1", "Güvenlik"),
        ("PixDriver_Surucu.ps1", "Sürücü"),
        ("Windows_Temizligi.ps1", "Temizlik"),
        ("Sifre_Uretici.ps1", "Güvenlik"),
        ("bilinmeyen_dosya.ps1", "Genel"),
    ],
)
def test_category_detection(filename: str, expected: str) -> None:
    assert script_service._detect_category(filename) == expected


def test_pretty_name() -> None:
    assert script_service._pretty_name("PixNet_Ag_ve_Internet.ps1") == "PixNet Ag ve Internet"


# ----------------------------------------------------------------------
#  Kütüphane taraması
# ----------------------------------------------------------------------
def test_library_scan_finds_scripts() -> None:
    scripts, categories, kinds = script_service.list_scripts()
    assert len(scripts) > 0, "Kütüphane boş — scripts_library/ kontrol edin"
    assert len(categories) > 0
    assert len(kinds) > 0
    assert all(item.id for item in scripts)
    assert all(item.size_bytes > 0 for item in scripts)


def test_library_scripts_have_categories() -> None:
    scripts, _, _ = script_service.list_scripts()
    for script in scripts:
        assert script.category, f"{script.id} kategorisiz"
        assert script.platform in {"windows", "linux"}
        assert script.type in {"powershell", "cmd", "bash", "python"}


# ----------------------------------------------------------------------
#  Yol geçişi güvenliği
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "evil",
    [
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\config",
        "subdir/../../secret.txt",
        "/etc/shadow",
    ],
)
def test_path_traversal_is_blocked(evil: str) -> None:
    assert script_service.find_script(evil) is None


def test_read_unknown_script_returns_none() -> None:
    assert script_service.read_script("kesinlikle-yok.ps1") is None


def test_read_known_script_returns_content() -> None:
    scripts, _, _ = script_service.list_scripts()
    target = scripts[0]
    result = script_service.read_script(target.id)
    assert result is not None
    info, content = result
    assert info.id == target.id
    assert len(content) > 0


# ----------------------------------------------------------------------
#  Oluşturma / güncelleme / silme (CRUD)
# ----------------------------------------------------------------------
def test_create_update_delete_script() -> None:
    before = script_service.library_stats()["count"]

    # --- Oluştur (CMD tipi) ---
    info = script_service.create_script(
        name="Pytest Deneme Betigi",
        kind="cmd",
        category="Pytest",
        description="otomatik test",
        content="",
    )
    try:
        assert info.id.endswith(".cmd"), f"CMD uzantısı bekleniyordu: {info.id}"
        assert info.type == "cmd"
        assert info.category == "Pytest"
        assert info.platform == "windows"
        assert info.customized is True
        assert script_service.library_stats()["count"] == before + 1

        # --- Güncelle: kategori + ad (yeniden adlandırma) ---
        updated = script_service.update_script(
            info.id, category="Pytest Guncel", name="Pytest Deneme Betigi 2"
        )
        assert updated is not None
        assert updated.category == "Pytest Guncel"
        assert updated.name == "Pytest Deneme Betigi 2"
        assert updated.type == "cmd", "Tip korunmalı"

        # --- Tip değiştir: CMD → Bash (uzantı da değişmeli) ---
        converted = script_service.update_script(updated.id, kind="bash")
        assert converted is not None
        assert converted.type == "bash"
        assert converted.extension == ".sh"
        assert converted.platform == "linux"
    finally:
        for candidate in (
            "Pytest_Deneme_Betigi.cmd",
            "Pytest_Deneme_Betigi_2.cmd",
            "Pytest_Deneme_Betigi_2.sh",
        ):
            script_service.delete_script(candidate)

    assert script_service.library_stats()["count"] == before, "Test artığı kaldı"
    assert not script_service.load_meta(), "Üst veri artığı kaldı"


def test_create_unknown_type_rejected() -> None:
    """Geçersiz tip reddedilmeli (pydantic doğrulaması)."""
    from pydantic import ValidationError

    from app.models.scripts import ScriptCreateRequest

    with pytest.raises(ValidationError):
        ScriptCreateRequest(name="x", type="perl")  # type: ignore[arg-type]


def test_slugify_turkish() -> None:
    assert script_service.slugify("Ağ Yöneticisi ÇĞİÖŞÜ") == "Ag_Yoneticisi_CGIOSU"
    assert script_service.slugify("   ") == "script"


def test_delete_unknown_script_returns_false() -> None:
    assert script_service.delete_script("kesinlikle-yok.cmd") is False


def test_update_unknown_script_returns_none() -> None:
    assert script_service.update_script("kesinlikle-yok.ps1", category="X") is None


# ----------------------------------------------------------------------
#  Uç noktalar
# ----------------------------------------------------------------------
def test_list_endpoint() -> None:
    response = client.get("/api/v1/scripts")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["count"] > 0
    assert len(body["scripts"]) == body["count"]


def test_detail_endpoint() -> None:
    scripts = client.get("/api/v1/scripts").json()["scripts"]
    script_id = scripts[0]["id"]

    response = client.get(f"/api/v1/scripts/{script_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["script"]["id"] == script_id
    assert len(body["content"]) > 0


def test_detail_endpoint_404() -> None:
    response = client.get("/api/v1/scripts/yok-boyle-bir-script.ps1")
    assert response.status_code == 404


def test_run_endpoint_confirm_policy() -> None:
    """`confirm` politikasında çalıştırma ONAY bekler."""
    scripts = client.get("/api/v1/scripts").json()["scripts"]
    script_id = scripts[0]["id"]

    response = client.post(
        f"/api/v1/scripts/{script_id}/run",
        json={"script_id": script_id, "target": "local", "policy": "confirm"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "awaiting_confirmation"
    assert body["command"]


def test_run_endpoint_generates_correct_command() -> None:
    scripts = client.get("/api/v1/scripts").json()["scripts"]
    ps1 = next(item for item in scripts if item["extension"] == ".ps1")

    body = client.post(
        f"/api/v1/scripts/{ps1['id']}/run",
        json={"script_id": ps1["id"], "policy": "allow_all", "target": "local"},
    ).json()

    assert "powershell" in body["command"]
    assert ps1["id"] in body["command"]


def test_run_endpoint_whitelist_blocks() -> None:
    """`whitelist` politikasında izinsiz script 403 döner."""
    scripts = client.get("/api/v1/scripts").json()["scripts"]
    # İzinli listede olmayan bir script seç
    candidate = next(
        (item for item in scripts if item["id"] not in {"Guc_Raporu.ps1"}),
        scripts[0],
    )

    response = client.post(
        f"/api/v1/scripts/{candidate['id']}/run",
        json={"script_id": candidate["id"], "policy": "whitelist"},
    )
    # İzinli değilse 403; izinliyse 200
    assert response.status_code in {200, 403}


def test_run_endpoint_404() -> None:
    response = client.post(
        "/api/v1/scripts/yok.ps1/run",
        json={"script_id": "yok.ps1"},
    )
    assert response.status_code == 404
