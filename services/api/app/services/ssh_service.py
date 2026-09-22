"""
SSH / SFTP servisi (paramiko).

⚠️ Bu modül **canlı sunucuda komut çalıştırır**. Tasarım kararları:
  • `paramiko` isteğe bağlıdır — kurulu değilse uç noktalar anlamlı hata döner
  • Parolalar **asla loglanmaz**
  • Her işlem `logs/ssh-audit.jsonl` dosyasına kaydedilir (denetim izi)
  • Komut politikası denetimi `routers/remote.py` içinde yapılır

Faz 2 kapsamı: exec, dizin listeleme, sistem bilgisi.
Faz 3'te yerel köprü aynı arayüzü kullanacak.
"""

from __future__ import annotations

import contextlib
import json
import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.remote import RemoteFile, SshExecRequest, SshTarget

logger = logging.getLogger("pixtool.ssh")

#: Denetim kaydı dosyası
AUDIT_FILE = Path(__file__).resolve().parents[2] / "logs" / "ssh-audit.jsonl"

#: paramiko isteğe bağlı
try:
    import paramiko  # type: ignore[import-untyped]

    PARAMIKO_AVAILABLE = True
except ImportError:  # pragma: no cover
    paramiko = None  # type: ignore[assignment]
    PARAMIKO_AVAILABLE = False


class SshError(RuntimeError):
    """SSH işlemi başarısız."""


def _audit(action: str, target: SshTarget, detail: dict[str, Any]) -> None:
    """İşlemi denetim dosyasına yazar (parola HARİÇ)."""
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        record = {
            "timestamp": datetime.now(UTC).isoformat(),
            "action": action,
            "host": target.host or settings.ssh_default_host,
            "username": target.username or settings.ssh_default_user,
            "detail": detail,
        }
        with AUDIT_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:  # pragma: no cover
        logger.warning("Denetim kaydı yazılamadı: %s", exc)


def resolve_target(target: SshTarget) -> tuple[str, int, str, str | None]:
    """
    Hedefi `.env` varsayılanlarıyla tamamlar.

    Returns:
        (host, port, username, password)
    """
    host = target.host or settings.ssh_default_host
    port = target.port or settings.ssh_default_port or 22
    username = target.username or settings.ssh_default_user
    #: İstekte parola verilmediyse `.env` değerine düş
    password = target.password or settings.ssh_default_password or None

    if not host:
        raise SshError("SSH hedefi tanımlı değil (host boş).")
    if not username:
        raise SshError("SSH kullanıcı adı tanımlı değil.")

    return host, port, username, password


def ensure_available() -> None:
    """paramiko kurulu mu?"""
    if not PARAMIKO_AVAILABLE:
        raise SshError(
            "paramiko kurulu değil. Kurmak için: "
            "services/api/.venv/Scripts/python.exe -m pip install paramiko"
        )


def _connect(target: SshTarget, timeout: int = 15):
    """SSH istemcisi açar."""
    ensure_available()
    host, port, username, password = resolve_target(target)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            timeout=timeout,
            allow_agent=True,
            look_for_keys=True,
        )
    except Exception as exc:  # noqa: BLE001 — paramiko çok çeşitli hata atar
        raise SshError(f"Bağlantı kurulamadı ({host}:{port}): {type(exc).__name__}") from exc

    return client


def exec_command(request: SshExecRequest) -> dict[str, Any]:
    """
    Uzak sunucuda komut çalıştırır.

    Returns:
        {"stdout", "stderr", "exit_code", "duration_ms"}
    """
    started = time.monotonic()
    client = _connect(request.target)

    try:
        _stdin, stdout, stderr = client.exec_command(
            request.command,
            timeout=request.timeout_seconds,
        )
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
    except Exception as exc:  # noqa: BLE001
        raise SshError(f"Komut çalıştırılamadı: {type(exc).__name__}") from exc
    finally:
        client.close()

    duration_ms = int((time.monotonic() - started) * 1000)
    _audit("exec", request.target, {"command": request.command[:200], "exit_code": exit_code})

    return {
        "stdout": out[:20000],
        "stderr": err[:5000],
        "exit_code": exit_code,
        "duration_ms": duration_ms,
    }


def list_directory(target: SshTarget, path: str = ".") -> list[RemoteFile]:
    """Uzak dizini listeler."""
    client = _connect(target)

    try:
        sftp = client.open_sftp()
    except Exception as exc:  # noqa: BLE001
        client.close()
        raise SshError(f"SFTP oturumu açılamadı: {type(exc).__name__}") from exc

    entries: list[RemoteFile] = []
    try:
        for attr in sftp.listdir_attr(path):
            is_dir = attr.st_mode is not None and (attr.st_mode & 0o40000) != 0
            entries.append(
                RemoteFile(
                    name=attr.filename,
                    path=f"{path.rstrip('/')}/{attr.filename}",
                    is_dir=is_dir,
                    size_bytes=attr.st_size or 0,
                    modified=(
                        datetime.fromtimestamp(attr.st_mtime, tz=UTC).isoformat()
                        if attr.st_mtime
                        else None
                    ),
                    permissions=oct(attr.st_mode)[-3:] if attr.st_mode else None,
                )
            )
    except Exception as exc:  # noqa: BLE001
        raise SshError(f"Dizin listelenemedi: {type(exc).__name__}") from exc
    finally:
        sftp.close()
        client.close()

    entries.sort(key=lambda item: (not item.is_dir, item.name.lower()))
    _audit("sftp_list", target, {"path": path, "count": len(entries)})
    return entries


def system_info(target: SshTarget) -> dict[str, Any]:
    """
    Uzak sistem bilgisini komutlarla toplar.

    Tek bir bileşik komut çalıştırılır (birden fazla bağlantı açmamak için).
    """
    command = (
        "echo '@@HOST'; hostname 2>/dev/null; "
        "echo '@@OS'; (cat /etc/os-release 2>/dev/null "
        "| grep PRETTY_NAME | cut -d= -f2 | tr -d '\"') || uname -s; "
        "echo '@@KERNEL'; uname -r; "
        "echo '@@UPTIME'; uptime -p 2>/dev/null || uptime; "
        "echo '@@CORES'; nproc 2>/dev/null || echo 0; "
        "echo '@@MEM'; free -m 2>/dev/null | awk '/Mem:/{print $2\" \"$3}'; "
        "echo '@@DISK'; df -BG / 2>/dev/null | awk 'NR==2{"
        'gsub("G","",$2); gsub("G","",$3); print $2" "$3}\''
    )

    request = SshExecRequest(target=target, command=command, timeout_seconds=20)
    result = exec_command(request)
    raw = result.get("stdout", "")

    info: dict[str, Any] = {
        "hostname": None,
        "os": None,
        "kernel": None,
        "uptime": None,
        "cpu_cores": None,
        "memory_total_mb": None,
        "memory_used_mb": None,
        "disk_total_gb": None,
        "disk_used_gb": None,
    }

    section = None
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("@@"):
            section = line[2:]
            continue

        if section == "HOST" and not info["hostname"]:
            info["hostname"] = line
        elif section == "OS" and not info["os"]:
            info["os"] = line
        elif section == "KERNEL":
            info["kernel"] = line
        elif section == "UPTIME":
            info["uptime"] = line
        elif section == "CORES":
            with contextlib.suppress(ValueError):
                info["cpu_cores"] = int(line)
        elif section == "MEM":
            parts = line.split()
            if len(parts) >= 2:
                try:
                    info["memory_total_mb"] = int(float(parts[0]))
                    info["memory_used_mb"] = int(float(parts[1]))
                except ValueError:
                    pass
        elif section == "DISK":
            parts = line.split()
            if len(parts) >= 2:
                try:
                    info["disk_total_gb"] = round(float(parts[0]), 1)
                    info["disk_used_gb"] = round(float(parts[1]), 1)
                except ValueError:
                    pass

    return info
