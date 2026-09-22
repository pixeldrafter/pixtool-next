"""
Cihaz raporu uç noktaları.

    POST /api/v1/devices/report   → makine raporunu kaydet
    GET  /api/v1/devices          → kayıtlı cihazları listele

Kayıt hedefi:
    • NocoDB yapılandırılmışsa  → `devices` tablosuna yazılır
    • Değilse                   → yerel JSON dosyasına yazılır (kayıp olmasın)

Yerel dosya yolu: `services/api/data/device-reports.jsonl`
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.integrations.nocodb import NocoDBClient
from app.models.devices import DeviceReportRequest, DeviceReportResponse

logger = logging.getLogger("pixtool.devices")

router = APIRouter(prefix="/api/v1/devices", tags=["cihazlar"])

#: Yerel rapor deposu (NocoDB yoksa)
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
REPORTS_FILE = DATA_DIR / "device-reports.jsonl"


def compute_device_id(payload: DeviceReportRequest) -> str:
    """
    Cihaz parmak izi üretir.

    Tarayıcıdan gelen **kararlı** alanlar kullanılır (ekran, çekirdek sayısı,
    platform, GPU, saat dilimi). Rastgele/oturuma özel alanlar (sayfa yükleme
    süresi, JS yığını) dışarıda bırakılır ki aynı makine aynı kimliği alsın.
    """
    report = payload.report
    hardware = report.get("hardware", {}) if isinstance(report, dict) else {}
    gpu = report.get("gpu", {}) if isinstance(report, dict) else {}
    browser = report.get("browser", {}) if isinstance(report, dict) else {}

    parts = [
        str(browser.get("platform", "")),
        str(hardware.get("screen", "")),
        str(hardware.get("logicalCores", "")),
        str(hardware.get("deviceMemoryGb", "")),
        str(hardware.get("pixelRatio", "")),
        str(gpu.get("renderer", "")),
        str(browser.get("timezone", "")),
        str(browser.get("language", "")),
    ]

    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return f"dev-{digest[:16]}"


def _write_local(payload: DeviceReportRequest, device_id: str) -> None:
    """Raporu yerel JSONL dosyasına ekler."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    record = {
        "device_id": device_id,
        "collected_at": payload.collected_at or datetime.now(UTC).isoformat(),
        "received_at": datetime.now(UTC).isoformat(),
        "user_agent": payload.user_agent,
        "report": payload.report,
    }

    with REPORTS_FILE.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def _read_local(limit: int = 50) -> list[dict]:
    """Yerel rapor deposunu okur (en yeniler önce)."""
    if not REPORTS_FILE.exists():
        return []

    lines = REPORTS_FILE.read_text(encoding="utf-8").splitlines()
    records: list[dict] = []
    for line in reversed(lines[-limit:]):
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records


@router.post("/report", response_model=DeviceReportResponse)
async def save_report(payload: DeviceReportRequest) -> DeviceReportResponse:
    """
    Makine raporunu kaydeder.

    NocoDB yapılandırılmışsa oraya, aksi hâlde yerel dosyaya yazılır.
    """
    device_id = compute_device_id(payload)

    # --- 1) NocoDB yolu ---
    if settings.nocodb_configured and not settings.nocodb_is_placeholder:
        table = settings.nocodb_table_devices
        if not table:
            # Tablo adı henüz tanımlanmamış — yerel yaz ve bilgilendir
            _write_local(payload, device_id)
            return DeviceReportResponse(
                ok=True,
                device_id=device_id,
                stored_in="local",
                message=(
                    "NocoDB bağlı ama `NOCODB_TABLE_DEVICES` tanımlı değil. "
                    "Rapor yerel dosyaya kaydedildi."
                ),
            )

        try:
            client = NocoDBClient()
            await client.insert_record(
                table,
                {
                    "device_id": device_id,
                    "collected_at": payload.collected_at or datetime.now(UTC).isoformat(),
                    "user_agent": payload.user_agent or "",
                    "report": json.dumps(payload.report, ensure_ascii=False),
                },
            )
        except Exception as exc:  # noqa: BLE001 — yerel yedeğe düşmek istiyoruz
            logger.warning("NocoDB kaydı başarısız, yerel dosyaya yazılıyor: %s", exc)
            _write_local(payload, device_id)
            return DeviceReportResponse(
                ok=True,
                device_id=device_id,
                stored_in="local",
                message=f"NocoDB'ye yazılamadı ({type(exc).__name__}). Yerel dosyaya kaydedildi.",
            )

        return DeviceReportResponse(
            ok=True,
            device_id=device_id,
            stored_in="nocodb",
            message="Cihaz raporu NocoDB'ye kaydedildi.",
        )

    # --- 2) Yerel yol ---
    _write_local(payload, device_id)
    return DeviceReportResponse(
        ok=True,
        device_id=device_id,
        stored_in="local",
        message=(
            "NocoDB henüz yapılandırılmadı. Rapor yerel dosyaya kaydedildi — "
            "yapılandırma tamamlanınca aktarılabilir."
        ),
    )


@router.get("")
async def list_devices(limit: int = 50) -> dict:
    """
    Kayıtlı cihaz raporlarını listeler.

    NocoDB bağlıysa oradan okumak Faz 2'de eklenecek; şimdilik yerel depo.
    """
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="limit 1 ile 500 arasında olmalı.",
        )

    records = _read_local(limit)
    return {
        "ok": True,
        "source": "local",
        "count": len(records),
        "devices": records,
        "storage_file": str(REPORTS_FILE) if REPORTS_FILE.exists() else None,
    }
