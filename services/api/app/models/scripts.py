"""
Script kütüphanesi modelleri.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScriptInfo(BaseModel):
    """Kütüphanedeki tek bir script."""

    #: Dosya adı (kimlik olarak kullanılır)
    id: str
    #: Görünen ad (dosya adından üretilir)
    name: str
    #: PowerShell `.SYNOPSIS` bloğundan çıkarılan açıklama
    description: str = ""
    #: Kategori (dosya adı önekine göre: ağ, güvenlik, sürücü…)
    category: str = "genel"
    #: Hedef platform
    platform: str = "windows"
    #: Dosya uzantısı
    extension: str = ".ps1"
    #: Bayt cinsinden boyut
    size_bytes: int = 0
    #: Satır sayısı
    lines: int = 0
    #: Script yorumundan çıkarılan yazar bilgisi (varsa)
    author: str | None = None
    #: Yorumdan çıkarılan sürüm (varsa)
    version: str | None = None


class ScriptListResponse(BaseModel):
    """Kütüphane listesi."""

    ok: bool
    count: int
    categories: list[str]
    scripts: list[ScriptInfo]


class ScriptDetailResponse(BaseModel):
    """Script içeriği."""

    ok: bool
    script: ScriptInfo
    content: str


class RunScriptRequest(BaseModel):
    """Script çalıştırma isteği."""

    #: Script kimliği (dosya adı)
    script_id: str = Field(min_length=1)
    #: Nerede çalışsın: yerel köprü (Faz 3) veya uzak SSH
    target: str = Field(default="local", pattern="^(local|ssh)$")
    #: Komut politikası (ayarlardan gelir)
    policy: str = Field(default="confirm", pattern="^(confirm|whitelist|allow_all)$")


class RunScriptResponse(BaseModel):
    """Çalıştırma sonucu."""

    ok: bool
    #: Çalıştırıldı mı, yoksa onay mı bekliyor
    status: str
    command: str
    output: str = ""
    exit_code: int | None = None
    message: str | None = None
