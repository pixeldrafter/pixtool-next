"""
NocoDB istemcisi — uygulamanın **tek veri kaynağı** (karar #5).

Tüm tablo erişimi bu modül üzerinden yapılır. Başka hiçbir yerde doğrudan
NocoDB HTTP çağrısı yazılmaz.

NocoDB REST Data API v2 kullanılır:
    GET  {base}/api/v2/tables/{tableId}/records
    POST {base}/api/v2/tables/{tableId}/records
Kimlik doğrulama:
    Header: xc-token: {API_TOKEN}
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


@dataclass(slots=True)
class NocoDBStatus:
    """NocoDB bağlantı durumu."""

    configured: bool
    placeholder: bool
    reachable: bool
    base_url: str = ""
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.configured and not self.placeholder and self.reachable


class NocoDBClient:
    """NocoDB REST API istemcisi."""

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.base_url = (base_url or settings.nocodb_base_url).rstrip("/")
        self.token = token or settings.nocodb_api_token
        self.timeout = timeout

    # ------------------------------------------------------------------
    #  Yardımcılar
    # ------------------------------------------------------------------
    @property
    def _headers(self) -> dict[str, str]:
        return {
            "xc-token": self.token,
            "Accept": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    # ------------------------------------------------------------------
    #  Bağlantı doğrulaması
    # ------------------------------------------------------------------
    async def ping(self) -> NocoDBStatus:
        """
        NocoDB erişilebilir mi?

        Yapılandırma eksikse veya adres şablon değerse ağ isteği yapmadan
        durumu döner.
        """
        if not settings.nocodb_configured:
            return NocoDBStatus(
                configured=False,
                placeholder=settings.nocodb_is_placeholder,
                reachable=False,
                base_url=self.base_url,
                detail=(
                    "NocoDB yapılandırılmamış — .env içinde NOCODB_BASE_URL "
                    "ve NOCODB_API_TOKEN doldurulmalı."
                ),
            )

        if settings.nocodb_is_placeholder:
            return NocoDBStatus(
                configured=True,
                placeholder=True,
                reachable=False,
                base_url=self.base_url,
                detail=(
                    f"NocoDB adresi hâlâ şablon değer: {self.base_url!r} — gerçek adres girilmeli."
                ),
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(self._url("/api/v2/meta/bases/"), headers=self._headers)
        except httpx.HTTPError as exc:
            return NocoDBStatus(
                configured=True,
                placeholder=False,
                reachable=False,
                base_url=self.base_url,
                detail=f"Bağlantı hatası: {type(exc).__name__}: {exc}",
            )

        if response.status_code == 401:
            return NocoDBStatus(
                configured=True,
                placeholder=False,
                reachable=True,
                base_url=self.base_url,
                detail=(
                    "Sunucuya ulaşıldı ama token geçersiz (401). NOCODB_API_TOKEN kontrol edilmeli."
                ),
            )

        if response.status_code >= 400:
            return NocoDBStatus(
                configured=True,
                placeholder=False,
                reachable=False,
                base_url=self.base_url,
                detail=f"HTTP {response.status_code}: {response.text[:200]}",
            )

        return NocoDBStatus(
            configured=True,
            placeholder=False,
            reachable=True,
            base_url=self.base_url,
            detail="Bağlantı başarılı.",
        )

    # ------------------------------------------------------------------
    #  Base / tablo işlemleri
    # ------------------------------------------------------------------
    async def list_bases(self) -> list[dict[str, Any]]:
        """Erişilebilen NocoDB base'lerini listeler."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(self._url("/api/v2/meta/bases/"), headers=self._headers)
            response.raise_for_status()
            data = response.json()
        return data.get("list", data if isinstance(data, list) else [])

    async def insert_record(self, table: str, record: dict[str, Any]) -> dict[str, Any]:
        """Tabloya bir kayıt ekler."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                self._url(f"/api/v2/tables/{table}/records"),
                headers={**self._headers, "Content-Type": "application/json"},
                json=record,
            )
            response.raise_for_status()
            return response.json()

    async def update_record(
        self,
        table: str,
        record_id: str | int,
        record: dict[str, Any],
    ) -> dict[str, Any]:
        """Var olan kaydı günceller (PATCH)."""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.patch(
                self._url(f"/api/v2/tables/{table}/records"),
                headers=self._headers,
                json=[{"id": record_id, **record}],
            )
            response.raise_for_status()
            return response.json()

    async def list_tables(self) -> list[dict[str, Any]]:
        """
        Yapılandırılmış base içindeki tabloları listeler.

        Returns:
            `[{id, title, table_name}, …]`
        """
        base_id = settings.nocodb_base_id
        if not base_id:
            return []

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(
                self._url(f"/api/v2/meta/bases/{base_id}/tables"),
                headers=self._headers,
            )
            response.raise_for_status()
            data = response.json()

        return [
            {
                "id": table.get("id"),
                "title": table.get("title"),
                "table_name": table.get("table_name"),
            }
            for table in (data.get("list") or [])
        ]

    async def list_records(
        self,
        table: str,
        limit: int = 25,
        where: str | None = None,
    ) -> list[dict[str, Any]]:
        """Tablo kayıtlarını listeler."""
        params: dict[str, Any] = {"limit": limit}
        if where:
            params["where"] = where

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(
                self._url(f"/api/v2/tables/{table}/records"),
                headers=self._headers,
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        return data.get("list", [])


def get_nocodb_client() -> NocoDBClient:
    """FastAPI bağımlılığı olarak kullanılacak istemci."""
    return NocoDBClient()
