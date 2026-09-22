"""
Uzak erişim (SSH / SFTP) modelleri.

⚠️ Bu uç noktalar **canlı sunucuda komut çalıştırır**. Bu yüzden:
  • Tüm istekler `COMMAND_POLICY` ile denetlenir
  • Denetim kaydı (audit) yazılır
  • Varsayılan politika `confirm` — onay olmadan çalışmaz
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SshTarget(BaseModel):
    """Bağlantı hedefi. Boş bırakılırsa `.env` varsayılanları kullanılır."""

    host: str | None = None
    port: int | None = None
    username: str | None = None
    #: Parola (yerel kullanım için; üretimde anahtar tercih edilmeli)
    password: str | None = Field(default=None, repr=False)


class SshExecRequest(BaseModel):
    """Uzak komut çalıştırma."""

    target: SshTarget = Field(default_factory=SshTarget)
    command: str = Field(min_length=1, max_length=4000)
    timeout_seconds: int = Field(default=30, ge=1, le=600)


class SshExecResponse(BaseModel):
    """Komut sonucu."""

    ok: bool
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    duration_ms: int = 0
    message: str | None = None


class RemoteFile(BaseModel):
    """Uzak dosya/dizin girdisi."""

    name: str
    path: str
    is_dir: bool
    size_bytes: int = 0
    modified: str | None = None
    permissions: str | None = None


class SftpListRequest(BaseModel):
    """Dizin listeleme."""

    target: SshTarget = Field(default_factory=SshTarget)
    path: str = "."


class SftpListResponse(BaseModel):
    """Dizin içeriği."""

    ok: bool
    path: str
    entries: list[RemoteFile]
    message: str | None = None


class RemoteInfoResponse(BaseModel):
    """Uzak sistem bilgisi."""

    ok: bool
    hostname: str | None = None
    os: str | None = None
    kernel: str | None = None
    uptime: str | None = None
    cpu_cores: int | None = None
    memory_total_mb: int | None = None
    memory_used_mb: int | None = None
    disk_total_gb: float | None = None
    disk_used_gb: float | None = None
    message: str | None = None
