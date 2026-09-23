"""
Script kütüphanesi modelleri.

Script **tipi** (PowerShell / CMD / Bash / Python) artık açıkça belirtilebilir;
dosya uzantısından otomatik çıkarılır ama `.meta.json` ile geçersiz kılınabilir.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

#: Desteklenen script tipleri
ScriptKind = Literal["powershell", "cmd", "bash", "python"]

#: Uzantı → tip eşlemesi (otomatik algılama için)
EXTENSION_KIND: dict[str, ScriptKind] = {
    ".ps1": "powershell",
    ".psm1": "powershell",
    ".cmd": "cmd",
    ".bat": "cmd",
    ".sh": "bash",
    ".bash": "bash",
    ".py": "python",
}

#: Tip → varsayılan uzantı (yeni script oluştururken)
KIND_EXTENSION: dict[ScriptKind, str] = {
    "powershell": ".ps1",
    "cmd": ".cmd",
    "bash": ".sh",
    "python": ".py",
}


class ScriptInfo(BaseModel):
    """Kütüphanedeki tek bir script."""

    #: Dosya adı (kimlik olarak kullanılır)
    id: str
    #: Görünen ad (dosya adından üretilir, `.meta.json` ile geçersiz kılınabilir)
    name: str
    #: Yorum bloğundan çıkarılan açıklama
    description: str = ""
    #: Kategori (önekten otomatik, `.meta.json` ile geçersiz kılınabilir)
    category: str = "Genel"
    #: Hedef platform
    platform: str = "windows"
    #: Script tipi — powershell | cmd | bash | python
    type: ScriptKind = "powershell"
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
    #: Kategori/tip elle belirlendi mi (`.meta.json` kaydı var mı)
    customized: bool = False


class ScriptListResponse(BaseModel):
    """Kütüphane listesi."""

    ok: bool
    count: int
    categories: list[str]
    #: Bilinen tüm script tipleri (arayüz filtresi için)
    kinds: list[str] = []
    scripts: list[ScriptInfo]


class ScriptDetailResponse(BaseModel):
    """Script içeriği."""

    ok: bool
    script: ScriptInfo
    content: str


class ScriptCreateRequest(BaseModel):
    """Yeni script oluşturma isteği."""

    #: Görünen ad — dosya adı bundan üretilir
    name: str = Field(min_length=1, max_length=120)
    #: Script tipi
    type: ScriptKind = "powershell"
    #: Kategori (boşsa "Genel")
    category: str = Field(default="Genel", max_length=60)
    #: Açıklama
    description: str = Field(default="", max_length=600)
    #: Script içeriği
    content: str = ""
    #: Alt klasör (isteğe bağlı: "windows", "linux"…)
    folder: str = Field(default="", max_length=60)


class ScriptUpdateRequest(BaseModel):
    """Script güncelleme isteği — yalnızca verilen alanlar değişir."""

    name: str | None = Field(default=None, max_length=120)
    type: ScriptKind | None = None
    category: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=600)
    #: Verilirse dosya içeriği de değiştirilir
    content: str | None = None


class ScriptMutationResponse(BaseModel):
    """Oluşturma / güncelleme / silme sonucu."""

    ok: bool
    message: str
    script: ScriptInfo | None = None


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
