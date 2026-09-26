"""
Uygulama sürümü ve güncelleme bildirimi.

Neden iki katman?
-----------------
Pixtool iki parçadan oluşur ve **güncelleme sıklıkları çok farklıdır**:

| Katman | Nedir | Değişim sıklığı | Nasıl güncellenir |
|---|---|---|---|
| **Arayüz** | React uygulaması | Her geliştirmede | Sunucuya kopyala → **anında** |
| **Kabuk** | Tauri exe + köprü binary'si | Nadir | Kurulum dosyası indirilip çalıştırılır |

Arayüz sunucudan yüklendiği için (`ui_remote_url`) **yeniden derleme
gerekmez**. Yalnızca kabuk değiştiğinde kullanıcıya bildirim gösterilir.

    GET /api/v1/app/version

Sunucudaki kurulum dizininden okur:

    /opt/pixtool/releases/
        shell.json          → { "version": "1.1.0", "notes": "...", "released": "..." }
        Pixtool-Next-1.1.0-setup.exe

Kabuk sürümü bu dosyadan gelir; indirme bağlantısı da buradan üretilir.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

logger = logging.getLogger("pixtool.version")

router = APIRouter(prefix="/api/v1/app", tags=["uygulama"])

#: Arayüzün gömülü sürümü (build sırasında güncellenir)
UI_VERSION = "1.2.5"

#: Sürüm dosyalarının bulunduğu dizin
RELEASES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "releases"

#: Zaman aşımı olmadan indirilebilecek en büyük kurulum (150 MB)
MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024


def _read_manifest() -> dict[str, Any]:
    """`shell.json` dosyasını okur (yoksa boş)."""
    path = RELEASES_DIR / "shell.json"
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError) as exc:
        logger.warning("shell.json okunamadı: %s", exc)
        return {}


def _installer_path(version: str) -> Path | None:
    """
    Kurulum dosyasını bulur.

    Adlandırma esnektir: `*<version>*setup.exe` desenini arar.
    """
    if not RELEASES_DIR.is_dir():
        return None

    candidates = sorted(
        RELEASES_DIR.glob("*.exe"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

    # Önce sürümü içeren
    for candidate in candidates:
        if version and version in candidate.name:
            return candidate

    return candidates[0] if candidates else None


@router.get("/version")
async def app_version() -> dict[str, Any]:
    """
    Güncel sürüm bilgisi ve indirme bağlantısı.

    Arayüz her açılışta bunu çağırır; kabuk sürümü daha yeniyse kullanıcıya
    bildirim gösterilir.
    """
    manifest = _read_manifest()
    shell_version = str(manifest.get("version") or "1.0.0")

    installer = _installer_path(shell_version)
    download_path = "/api/v1/app/download" if installer else None

    return {
        "ok": True,
        "ui": {
            "version": UI_VERSION,
            # Arayüz güncellemesi sunucudan otomatik gelir; yeniden derleme yok
            "autoUpdate": True,
        },
        "shell": {
            "version": shell_version,
            "notes": manifest.get("notes") or "",
            "released": manifest.get("released") or "",
            "download": download_path,
            "size_bytes": installer.stat().st_size if installer else None,
            "filename": installer.name if installer else None,
            # Kurulum zorunlu mu (kritik güvenlik güncellemesi)
            "mandatory": bool(manifest.get("mandatory")),
        },
        "checkedAt": datetime.now(UTC).isoformat(),
    }


@router.get("/latest.json")
async def latest_json() -> JSONResponse:
    """
    Tauri güncelleyicisinin bekledigi bicim.

    `tauri.conf.json` icindeki `plugins.updater.endpoints` bu adresi gosterir.
    Uygulama acilista burayi okur; surum daha yeniyse imzali paketi indirip
    **kendini gunceller ve yeniden baslatir** — kullanici hicbir sey yapmaz.
    """
    manifest = _read_manifest()
    version = str(manifest.get("version") or "")

    if not version:
        return JSONResponse(
            status_code=404,
            content={"ok": False, "error": "Sürüm bilgisi yok (shell.json eksik)."},
        )

    installer = _installer_path(version)
    if installer is None:
        return JSONResponse(
            status_code=404,
            content={"ok": False, "error": "Kurulum dosyası bulunamadı."},
        )

    # İmza dosyası: `…setup.exe.sig`
    signature_path = installer.with_suffix(installer.suffix + ".sig")
    if not signature_path.exists():
        return JSONResponse(
            status_code=409,
            content={
                "ok": False,
                "error": (
                    "İmza dosyası yok — otomatik güncelleme çalışmaz. "
                    f"Beklenen: {signature_path.name}"
                ),
            },
        )

    signature = signature_path.read_text(encoding="utf-8").strip()
    base = os.environ.get("APP_PUBLIC_URL", "https://pixtool.omercataloglu.com").rstrip("/")

    return JSONResponse(
        content={
            "version": version,
            "notes": manifest.get("notes") or "",
            "pub_date": manifest.get("released") or datetime.now(UTC).isoformat(),
            "platforms": {
                "windows-x86_64": {
                    "signature": signature,
                    "url": f"{base}/api/v1/app/download",
                }
            },
        },
        headers={"Cache-Control": "no-store"},
    )


@router.get("/download", response_model=None)
async def download_installer() -> FileResponse | JSONResponse:
    """
    En güncel kabuk kurulumunu indirir.

    Dosya sunucudan servis edildiği için indirme **sunucunun IP'sinden** gider
    ve harici bir depoya (GitHub gibi) ihtiyaç duyulmaz.
    """
    manifest = _read_manifest()
    version = str(manifest.get("version") or "")

    installer = _installer_path(version)
    if installer is None or not installer.exists():
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": (
                    "Kurulum dosyası bulunamadı. "
                    f"Sunucuda {RELEASES_DIR}/shell.json ve .exe dosyaları gerekli."
                ),
            },
        )

    size = installer.stat().st_size
    if size > MAX_DOWNLOAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={"ok": False, "error": "Kurulum dosyası beklenenden büyük."},
        )

    return FileResponse(
        path=installer,
        media_type="application/vnd.microsoft.portable-executable",
        filename=installer.name,
    )
