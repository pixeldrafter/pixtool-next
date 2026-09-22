"""
Cihaz raporu modelleri.

Kullanıcı isteği: açılışta makinenin bilgileri toplanıp, onay verilirse
sistemimize kaydedilsin — sonradan o makine üzerinde çalışırken bakılabilsin.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DeviceReportRequest(BaseModel):
    """Arayüzden gelen makine raporu."""

    #: Arayüzün topladığı ham bilgi ağacı (tarayıcı + köprü verisi)
    report: dict[str, Any] = Field(default_factory=dict)
    #: Toplama zamanı (ISO 8601)
    collected_at: str | None = None
    #: Tarayıcı kimliği
    user_agent: str | None = None


class DeviceReportResponse(BaseModel):
    """Kayıt sonucu."""

    ok: bool
    #: Üretilen cihaz parmak izi
    device_id: str | None = None
    #: Nereye kaydedildi: "nocodb" | "local"
    stored_in: str | None = None
    message: str | None = None
