#!/usr/bin/env python3
"""
Pixtool Bridge — yerel makine bilgisi köprüsü (Faz 3).

## Neden gerekli?

Tarayıcı sandbox'ı donanımın tamamına erişemez: kurulu programlar, servisler,
işlemler, disk bölümleri, gerçek IP'ler, güvenlik durumu… Bu bilgiler
**konsolda** isteniyor ("açılan bilgisayarın her şeyi ama her şeyi").
Köprü bu boşluğu doldurur: `127.0.0.1` üzerinde küçük bir HTTP servisi açar.

## Tarayıcı kısıtları (ve çözümleri)

| Kısıt | Durum |
|---|---|
| **Mixed content** (HTTPS → HTTP) | ✅ Sorun değil: `127.0.0.1` ve `localhost` tarayıcılarda **güvenilir kaynak** sayılır |
| **Private Network Access** | ✅ `Access-Control-Allow-Private-Network: true` başlığı ile çözülür |
| **CORS** | ✅ İzinli kaynak listesi + `OPTIONS` ön kontrolü |
| **Yetkisiz erişim** | ✅ Her istek `X-Pixtool-Token` ister |

## Çalıştırma

    python pixtool_bridge.py                 # token otomatik üretilir ve yazdırılır
    python pixtool_bridge.py --token GIZLI   # sabit token
    python pixtool_bridge.py --port 8765     # farklı port

Bağımlılık yoktur (yalnızca stdlib). `psutil` kuruluysa daha zengin veri verir:

    pip install psutil
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import json
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

VERSION = "1.0.0"
DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"

IS_WINDOWS = sys.platform.startswith("win")


# ----------------------------------------------------------------------
#  Çıktı kodlaması
# ----------------------------------------------------------------------
def _force_utf8_output() -> None:
    """
    stdout/stderr'ı UTF-8'e zorlar.

    Windows konsolu (ve PyInstaller ile derlenmiş exe) varsayılan olarak
    cp1254/cp437 kullanır; kutucuk çizim karakterleri ve Türkçe harfler
    `UnicodeEncodeError` verir. Bu, köprüyü **başlatılamaz** hâle getirir.

    `errors="replace"` sayesinde desteklenmeyen bir konsolda bile çöküvermez.
    """
    for stream in (sys.stdout, sys.stderr):
        if stream is None:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError, OSError):
            # Kanal yeniden yapılandırılamıyorsa (ör. boru) sessizce geç
            pass


_force_utf8_output()

# psutil varsa kullan (zorunlu değil)
try:
    import psutil  # type: ignore[import-not-found]

    HAS_PSUTIL = True
except ImportError:  # pragma: no cover
    psutil = None  # type: ignore[assignment]
    HAS_PSUTIL = False


# ======================================================================
#  Yardımcılar
# ======================================================================
def _run(command: list[str], timeout: float = 12.0) -> str:
    """
    Komutu çalıştırır, çıktıyı döndürür. Hata durumunda boş string.

    ⚠️ Kodlama: Windows konsolu UTF-8 değildir (cp1254/cp437). Yanlış
    çözme, subprocess okuyucu iş parçacığını öldürür ve çıktı **boş** gelir.
    Bu yüzden `errors="replace"` ile toleranslı çözüyoruz.
    """
    try:
        result = subprocess.run(  # noqa: S603
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,  # type: ignore[attr-defined]
        )
        return (result.stdout or "").strip()
    except (OSError, subprocess.SubprocessError, ValueError):
        return ""


#: PowerShell'e eklenen UTF-8 çıktı zorlaması
_PS_UTF8 = (
    "[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
    "$OutputEncoding=[Text.Encoding]::UTF8; "
)


def _powershell(script: str, timeout: float = 15.0) -> str:
    """PowerShell betiği çalıştırır (Windows) — UTF-8 çıktı garantili."""
    if not IS_WINDOWS:
        return ""
    return _run(
        [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            _PS_UTF8 + script,
        ],
        timeout,
    )


def _bytes_percent(used: int, total: int) -> float:
    return round((used / total) * 100, 1) if total else 0.0


def _safe_float(value: Any) -> float | None:
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


# ======================================================================
#  Bilgi toplayıcılar
# ======================================================================
def collect_system() -> dict[str, Any]:
    """İşletim sistemi ve makine kimliği."""
    info: dict[str, Any] = {
        "hostname": socket.gethostname(),
        "fqdn": socket.getfqdn(),
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "architecture": platform.architecture()[0],
        "python": platform.python_version(),
        "user": getpass.getuser(),
        "boot_time": None,
        "uptime_seconds": None,
        "uptime_human": None,
    }

    if HAS_PSUTIL:
        boot = psutil.boot_time()
        uptime = time.time() - boot
        info["boot_time"] = datetime.fromtimestamp(boot, UTC).isoformat()
        info["uptime_seconds"] = int(uptime)
        info["uptime_human"] = _human_duration(uptime)

    if IS_WINDOWS:
        info["os_name"] = _powershell(
            "(Get-CimInstance Win32_OperatingSystem).Caption"
        )
        info["os_build"] = _powershell(
            "(Get-CimInstance Win32_OperatingSystem).BuildNumber"
        )
        info["install_date"] = _powershell(
            "(Get-CimInstance Win32_OperatingSystem) | "
            "Select-Object -ExpandProperty InstallDate | "
            "ForEach-Object { $_.ToString('yyyy-MM-dd HH:mm') }"
        )
        info["windows_edition"] = _powershell(
            "(Get-CimInstance Win32_OperatingSystem).OperatingSystemSKU"
        )

        # psutil yoksa uptime'i PowerShell'den al
        if not HAS_PSUTIL:
            raw = _powershell(
                "$o = Get-CimInstance Win32_OperatingSystem; "
                "\"$($o.LastBootUpTime.ToString('o'))|$([int]((Get-Date) - $o.LastBootUpTime).TotalSeconds)\""
            )
            if raw and "|" in raw:
                parts = raw.split("|")
                if parts[0].strip():
                    info["boot_time"] = parts[0].strip()
                if len(parts) > 1 and parts[1].strip().isdigit():
                    seconds = int(parts[1].strip())
                    info["uptime_seconds"] = seconds
                    info["uptime_human"] = _human_duration(seconds)
    else:
        info["os_name"] = _read_first_line("/etc/os-release", "PRETTY_NAME")
        info["kernel"] = platform.uname().release

    return info


# ======================================================================
#  Ebeveyn bekçisi
# ======================================================================
def _process_alive(pid: int) -> bool:
    """Süreç hâlâ çalışıyor mu?"""
    if pid <= 0:
        return False

    if HAS_PSUTIL:
        return psutil.pid_exists(pid)  # type: ignore[union-attr]

    if IS_WINDOWS:
        # ctypes ile — harici komut çalıştırmadan hızlı kontrol
        try:
            import ctypes  # noqa: PLC0415

            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            STILL_ACTIVE = 259
            kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if not handle:
                return False
            code = ctypes.c_ulong()
            ok = kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
            kernel32.CloseHandle(handle)
            return bool(ok) and code.value == STILL_ACTIVE
        except (OSError, AttributeError):
            return True

    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _watch_parent(parent_pid: int, interval: float = 2.0) -> None:
    """
    Ebeveyn süreç kapanınca köprüyü de kapatır.

    Neden gerekli? Tauri `child.kill()` çağırdığında **yalnızca doğrudan
    çocuğu** öldürür. PyInstaller `--onefile` ile derlenmiş exe bir
    bootloader + gerçek süreç olarak **iki işlem** oluşturur; biri kalır.
    Ayrıca uygulama çöker veya zorla kapatılırsa da köprü arkada kalırdı.

    Bu bekçi ebeveynin PID'ini izler ve kaybolduğunda `os._exit(0)` ile
    **tüm** işlem zincirini sonlandırır.
    """

    def _loop() -> None:
        while True:
            time.sleep(interval)
            if not _process_alive(parent_pid):
                # Ateş et ve çık — daemon thread olduğu için bekleme yok
                os._exit(0)

    threading.Thread(target=_loop, name="parent-watchdog", daemon=True).start()


def _human_duration(seconds: float) -> str:
    """Saniyeyi okunabilir süreye çevirir."""
    seconds = int(seconds)
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts = []
    if days:
        parts.append(f"{days} gün")
    if hours:
        parts.append(f"{hours} saat")
    parts.append(f"{minutes} dakika")
    return " ".join(parts)


def _read_first_line(path: str, key: str) -> str:
    try:
        for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith(key):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return ""


def collect_cpu() -> dict[str, Any]:
    """İşlemci bilgisi ve yükü."""
    info: dict[str, Any] = {
        "logical_cores": os.cpu_count(),
        "physical_cores": None,
        "max_frequency_mhz": None,
        "current_frequency_mhz": None,
        "usage_percent": None,
        "per_core_percent": None,
        "load_average": None,
        "model": platform.processor() or None,
    }

    if HAS_PSUTIL:
        info["physical_cores"] = psutil.cpu_count(logical=False)
        freq = psutil.cpu_freq()
        if freq:
            info["max_frequency_mhz"] = _safe_float(freq.max)
            info["current_frequency_mhz"] = _safe_float(freq.current)
        # Kısa örnekleme (bloklamasın)
        info["usage_percent"] = psutil.cpu_percent(interval=0.25)
        info["per_core_percent"] = psutil.cpu_percent(interval=0.1, percpu=True)
        try:
            load = psutil.getloadavg()
            info["load_average"] = [round(value, 2) for value in load]
        except (AttributeError, OSError):
            pass

    if IS_WINDOWS:
        if not info["model"]:
            model = _powershell("(Get-CimInstance Win32_Processor).Name")
            if model:
                info["model"] = model.splitlines()[0].strip()

        # psutil yoksa PowerShell'den al (bağımlılıksız)
        if not HAS_PSUTIL:
            raw = _powershell(
                "$p = Get-CimInstance Win32_Processor; "
                "\"$($p.NumberOfCores)|$($p.NumberOfLogicalProcessors)|$($p.MaxClockSpeed)|$($p.Name)\""
            )
            if raw and "|" in raw:
                parts = raw.split("|")
                if parts[0].strip().isdigit():
                    info["physical_cores"] = int(parts[0].strip())
                if len(parts) > 1 and parts[1].strip().isdigit():
                    info["logical_cores"] = int(parts[1].strip())
                if len(parts) > 2 and parts[2].strip().isdigit():
                    info["max_frequency_mhz"] = float(parts[2].strip())
                if len(parts) > 3 and parts[3].strip():
                    info["model"] = parts[3].strip()

            # Yük: CPU zamanı örneklemesi
            load_raw = _powershell(
                "$a=(Get-CimInstance Win32_Processor).LoadPercentage; "
                "Start-Sleep -Milliseconds 400; "
                "$b=(Get-CimInstance Win32_Processor).LoadPercentage; "
                "\"$a|$b\"",
                timeout=20.0,
            )
            if load_raw and "|" in load_raw:
                values = [v.strip() for v in load_raw.split("|") if v.strip().isdigit()]
                if values:
                    info["usage_percent"] = round(sum(int(v) for v in values) / len(values), 1)

    elif not HAS_PSUTIL:
        # Linux: /proc/loadavg + /proc/cpuinfo
        try:
            info["load_average"] = [
                round(float(item), 2) for item in Path("/proc/loadavg").read_text().split()[:3]
            ]
        except (OSError, ValueError):
            pass

    return info


def collect_memory() -> dict[str, Any]:
    """Bellek ve takas."""
    info: dict[str, Any] = {"total_bytes": None, "used_bytes": None, "percent": None, "swap": None}

    if HAS_PSUTIL:
        memory = psutil.virtual_memory()
        info.update(
            {
                "total_bytes": memory.total,
                "available_bytes": memory.available,
                "used_bytes": memory.used,
                "percent": memory.percent,
                "total_human": _human_bytes(memory.total),
                "used_human": _human_bytes(memory.used),
                "available_human": _human_bytes(memory.available),
            }
        )
        swap = psutil.swap_memory()
        info["swap"] = {
            "total_bytes": swap.total,
            "used_bytes": swap.used,
            "percent": swap.percent,
            "total_human": _human_bytes(swap.total),
        }

    if IS_WINDOWS:
        modules = _powershell(
            "$m = Get-CimInstance Win32_PhysicalMemory | "
            "Select-Object Manufacturer,Capacity,Speed,PartNumber; "
            "$m | ConvertTo-Csv -NoTypeInformation"
        )
        if modules:
            info["modules"] = modules.splitlines()[1:]

        # psutil yoksa PowerShell'den al (bağımlılıksız tam veri)
        if not HAS_PSUTIL:
            raw = _powershell(
                "$o = Get-CimInstance Win32_OperatingSystem; "
                "\"$($o.TotalVisibleMemorySize)|$($o.FreePhysicalMemory)\""
            )
            if raw and "|" in raw:
                total_kb, free_kb = (raw.split("|") + ["0", "0"])[:2]
                if total_kb.strip().isdigit() and free_kb.strip().isdigit():
                    total = int(total_kb.strip()) * 1024
                    free = int(free_kb.strip()) * 1024
                    used = total - free
                    info.update(
                        {
                            "total_bytes": total,
                            "available_bytes": free,
                            "used_bytes": used,
                            "percent": _bytes_percent(used, total),
                            "total_human": _human_bytes(total),
                            "used_human": _human_bytes(used),
                            "available_human": _human_bytes(free),
                            "source": "powershell",
                        }
                    )

    elif not HAS_PSUTIL:
        # Linux: /proc/meminfo
        try:
            values: dict[str, int] = {}
            for line in Path("/proc/meminfo").read_text().splitlines():
                key, _, rest = line.partition(":")
                digits = rest.strip().split()[0] if rest.strip() else "0"
                if digits.isdigit():
                    values[key] = int(digits) * 1024
            total = values.get("MemTotal", 0)
            available = values.get("MemAvailable", 0)
            used = max(0, total - available)
            if total:
                info.update(
                    {
                        "total_bytes": total,
                        "available_bytes": available,
                        "used_bytes": used,
                        "percent": _bytes_percent(used, total),
                        "total_human": _human_bytes(total),
                        "used_human": _human_bytes(used),
                        "available_human": _human_bytes(available),
                        "source": "procfs",
                    }
                )
        except OSError:
            pass

    return info


def _human_bytes(value: int | float) -> str:
    """Baytı okunabilir biçime çevirir."""
    size = float(value)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def collect_disks() -> list[dict[str, Any]]:
    """Disk bölümleri ve doluluk."""
    disks: list[dict[str, Any]] = []

    if HAS_PSUTIL:
        for part in psutil.disk_partitions(all=False):
            entry: dict[str, Any] = {
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "opts": part.opts,
            }
            try:
                usage = psutil.disk_usage(part.mountpoint)
                entry.update(
                    {
                        "total_bytes": usage.total,
                        "used_bytes": usage.used,
                        "free_bytes": usage.free,
                        "percent": usage.percent,
                        "total_human": _human_bytes(usage.total),
                        "used_human": _human_bytes(usage.used),
                        "free_human": _human_bytes(usage.free),
                    }
                )
            except (PermissionError, OSError):
                pass
            disks.append(entry)
        return disks

    if IS_WINDOWS:
        raw = _powershell(
            "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | "
            "ForEach-Object { \"$($_.DeviceID)|$($_.Size)|$($_.FreeSpace)|$($_.FileSystem)\" }"
        )
        for line in raw.splitlines():
            parts = line.split("|")
            if len(parts) < 3 or not parts[1].strip().isdigit():
                continue
            total = int(parts[1])
            free = int(parts[2]) if parts[2].strip().isdigit() else 0
            used = max(0, total - free)
            disks.append(
                {
                    "device": parts[0],
                    "mountpoint": parts[0],
                    "fstype": parts[3] if len(parts) > 3 else "",
                    "total_bytes": total,
                    "used_bytes": used,
                    "free_bytes": free,
                    "percent": _bytes_percent(used, total),
                    "total_human": _human_bytes(total),
                    "used_human": _human_bytes(used),
                    "free_human": _human_bytes(free),
                    "source": "powershell",
                }
            )
        return disks

    # Linux: df
    raw = _run(["df", "-kP"])
    for line in raw.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 6 or not parts[1].isdigit():
            continue
        total = int(parts[1]) * 1024
        used = int(parts[2]) * 1024
        free = int(parts[3]) * 1024
        disks.append(
            {
                "device": parts[0],
                "mountpoint": parts[5],
                "fstype": parts[4],
                "total_bytes": total,
                "used_bytes": used,
                "free_bytes": free,
                "percent": _bytes_percent(used, total),
                "total_human": _human_bytes(total),
                "used_human": _human_bytes(used),
                "free_human": _human_bytes(free),
                "source": "df",
            }
        )
    return disks


def collect_network() -> dict[str, Any]:
    """Ağ arayüzleri ve IP adresleri."""
    info: dict[str, Any] = {"interfaces": [], "external_ip": None, "gateway": None, "dns": []}

    if HAS_PSUTIL:
        for name, addresses in psutil.net_if_addrs().items():
            entry: dict[str, Any] = {"name": name, "addresses": []}
            for address in addresses:
                family = str(address.family)
                if "AF_INET6" in family:
                    kind = "ipv6"
                elif "AF_INET" in family:
                    kind = "ipv4"
                elif "AF_LINK" in family or "AF_PACKET" in family:
                    kind = "mac"
                else:
                    kind = family
                entry["addresses"].append(
                    {"kind": kind, "address": address.address, "netmask": address.netmask}
                )
            stats = psutil.net_if_stats().get(name)
            if stats:
                entry["is_up"] = stats.isup
                entry["speed_mbps"] = stats.speed
            info["interfaces"].append(entry)

        try:
            gateways = psutil.net_if_addrs()  # yer tutucu; aşağıda komutla alınır
            del gateways
        except OSError:
            pass

    # Dış IP (kısa süreli, hata yutulur)
    info["external_ip"] = _external_ip()

    if IS_WINDOWS:
        gw = _powershell(
            "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | "
            "Select-Object -First 1).NextHop"
        )
        if gw:
            info["gateway"] = gw.splitlines()[0].strip()
        dns = _powershell("(Get-DnsClientServerAddress -AddressFamily IPv4).ServerAddresses")
        if dns:
            info["dns"] = [line.strip() for line in dns.splitlines() if line.strip()]

        # psutil yoksa arayüzleri PowerShell'den al
        if not HAS_PSUTIL:
            raw = _powershell(
                "Get-NetIPConfiguration | Where-Object {$_.IPv4Address} | "
                "ForEach-Object { \"$($_.InterfaceAlias)|$($_.IPv4Address.IPAddress)|"
                "$($_.IPv4DefaultGateway.NextHop)\" }"
            )
            for line in raw.splitlines():
                parts = line.split("|")
                if not parts[0].strip():
                    continue
                info["interfaces"].append(
                    {
                        "name": parts[0].strip(),
                        "addresses": (
                            [{"kind": "ipv4", "address": parts[1].strip(), "netmask": None}]
                            if len(parts) > 1 and parts[1].strip()
                            else []
                        ),
                        "gateway": parts[2].strip() if len(parts) > 2 and parts[2].strip() else None,
                        "source": "powershell",
                    }
                )

            mac = _powershell(
                "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | "
                "ForEach-Object { \"$($_.Name)|$($_.MacAddress)\" }"
            )
            mac_map = {
                line.split("|")[0]: line.split("|")[1]
                for line in mac.splitlines()
                if "|" in line
            }
            for entry in info["interfaces"]:
                address = mac_map.get(entry["name"])
                if address:
                    entry["addresses"].append({"kind": "mac", "address": address, "netmask": None})

    elif Path("/etc/resolv.conf").is_file():
        info["dns"] = [
            line.split()[1]
            for line in Path("/etc/resolv.conf").read_text().splitlines()
            if line.startswith("nameserver") and len(line.split()) > 1
        ]

    return info


def _external_ip() -> str | None:
    """Dış IP adresini bulur (başarısız olursa None)."""
    for url in ("https://api.ipify.org", "https://ifconfig.me/ip"):
        try:
            with urlopen(Request(url, headers={"User-Agent": "pixtool-bridge"}), timeout=6) as response:  # noqa: S310
                return response.read().decode("utf-8", "replace").strip()[:45]
        except (URLError, OSError, ValueError):
            continue
    return None


def collect_gpu() -> list[dict[str, Any]]:
    """Ekran kartları."""
    gpus: list[dict[str, Any]] = []
    if IS_WINDOWS:
        raw = _powershell(
            "Get-CimInstance Win32_VideoController | "
            "Select-Object Name,DriverVersion,AdapterRAM,VideoProcessor | "
            "ConvertTo-Csv -NoTypeInformation"
        )
        if raw:
            for line in raw.splitlines()[1:]:
                parts = [item.strip('"') for item in line.split('","')]
                if parts and parts[0]:
                    gpus.append(
                        {
                            "name": parts[0].strip('"'),
                            "driver": parts[1] if len(parts) > 1 else None,
                            "memory_bytes": int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else None,
                            "processor": parts[3] if len(parts) > 3 else None,
                        }
                    )
    else:
        raw = _run(["lspci"])
        gpus = [
            {"name": line.split(":", 1)[1].strip()}
            for line in raw.splitlines()
            if "VGA" in line or "3D controller" in line
        ]
    return gpus


def collect_processes(limit: int = 15) -> dict[str, Any]:
    """En çok kaynak tüketen işlemler."""
    if not HAS_PSUTIL:
        if IS_WINDOWS:
            raw = _powershell(
                "Get-Process | Sort-Object WorkingSet64 -Descending | "
                "Select-Object -First " + str(limit) + " | "
                "ForEach-Object { \"$($_.ProcessName)|$($_.Id)|$($_.WorkingSet64)|$($_.CPU)\" }",
                timeout=20.0,
            )
            items: list[dict[str, Any]] = []
            for line in raw.splitlines():
                parts = line.split("|")
                if len(parts) < 3 or not parts[2].strip().isdigit():
                    continue
                rss = int(parts[2])
                items.append(
                    {
                        "name": parts[0].strip(),
                        "pid": int(parts[1]) if parts[1].strip().isdigit() else None,
                        "rss_bytes": rss,
                        "rss_human": _human_bytes(rss),
                        "cpu_percent": _safe_float(parts[3]) if len(parts) > 3 else None,
                        "source": "powershell",
                    }
                )
            return {
                "count": len(items),
                "top_cpu": sorted(items, key=lambda i: i["cpu_percent"] or 0, reverse=True)[:limit],
                "top_memory": items,
            }
        # Linux: ps
        raw = _run(["ps", "-eo", "pid,comm,rss,%cpu", "--sort=-rss"])
        items = []
        for line in raw.splitlines()[1 : limit + 1]:
            parts = line.split(None, 3)
            if len(parts) < 3 or not parts[0].isdigit():
                continue
            rss = int(parts[2]) * 1024
            items.append(
                {
                    "pid": int(parts[0]),
                    "name": parts[1],
                    "rss_bytes": rss,
                    "rss_human": _human_bytes(rss),
                    "cpu_percent": _safe_float(parts[3]) if len(parts) > 3 else None,
                    "source": "ps",
                }
            )
        return {"count": len(items), "top_cpu": items[:limit], "top_memory": items[:limit]}

    processes: list[dict[str, Any]] = []
    for process in psutil.process_iter(
        ["pid", "name", "username", "memory_info", "cpu_percent", "create_time"]
    ):
        try:
            data = process.info
            memory = data.get("memory_info")
            processes.append(
                {
                    "pid": data["pid"],
                    "name": data.get("name") or "?",
                    "user": data.get("username"),
                    "rss_bytes": memory.rss if memory else 0,
                    "rss_human": _human_bytes(memory.rss) if memory else None,
                    "cpu_percent": _safe_float(data.get("cpu_percent")),
                    "started": (
                        datetime.fromtimestamp(data["create_time"], UTC).isoformat()
                        if data.get("create_time")
                        else None
                    ),
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, KeyError):
            continue

    return {
        "count": len(processes),
        "top_cpu": sorted(processes, key=lambda item: item["cpu_percent"] or 0, reverse=True)[:limit],
        "top_memory": sorted(processes, key=lambda item: item["rss_bytes"], reverse=True)[:limit],
    }


def collect_services() -> dict[str, Any]:
    """Çalışan servisler."""
    services: list[dict[str, Any]] = []
    if IS_WINDOWS:
        raw = _powershell(
            "Get-Service | Where-Object {$_.Status -eq 'Running'} | "
            "Select-Object -First 40 Name,DisplayName | "
            "ForEach-Object { \"$($_.Name)|$($_.DisplayName)\" }"
        )
        services = [
            {"name": line.split("|", 1)[0], "display": line.split("|", 1)[1] if "|" in line else ""}
            for line in raw.splitlines()
            if line.strip()
        ]
    else:
        raw = _run(["systemctl", "list-units", "--type=service", "--state=running", "--no-legend", "--no-pager"])
        services = [
            {"name": line.split()[0], "display": line.split()[0]}
            for line in raw.splitlines()
            if line.strip()
        ]

    if HAS_PSUTIL:
        try:
            services = services[:60]
        except (AttributeError, TypeError):
            pass

    return {"count": len(services), "items": services}


def collect_users() -> dict[str, Any]:
    """Kullanıcı hesapları ve oturumlar."""
    info: dict[str, Any] = {"logged_in": [], "local_accounts": []}

    if HAS_PSUTIL:
        for user in psutil.users():
            info["logged_in"].append(
                {
                    "name": user.name,
                    "terminal": user.terminal,
                    "host": user.host,
                    "started": datetime.fromtimestamp(user.started, UTC).isoformat(),
                }
            )

    if IS_WINDOWS:
        raw = _powershell(
            "Get-LocalUser | Select-Object Name,Enabled,LastLogon | "
            "ForEach-Object { \"$($_.Name)|$($_.Enabled)|$($_.LastLogon)\" }"
        )
        info["local_accounts"] = [
            {"name": line.split("|")[0], "enabled": line.split("|")[1] == "True",
             "last_logon": line.split("|")[2] if len(line.split("|")) > 2 else None}
            for line in raw.splitlines()
            if line.strip()
        ]

        # psutil yoksa oturumları `query user` ile al
        if not HAS_PSUTIL:
            sessions = _run(["query", "user"])
            for line in sessions.splitlines()[1:]:
                parts = line.split()
                if len(parts) < 2 or parts[0].startswith(">"):
                    continue
                info["logged_in"].append(
                    {
                        "name": parts[0],
                        "session": parts[1] if len(parts) > 1 else None,
                        "state": parts[2] if len(parts) > 2 else None,
                        "source": "query-user",
                    }
                )
    else:
        raw = _run(["getent", "passwd"])
        info["local_accounts"] = [
            {"name": line.split(":")[0], "uid": line.split(":")[2]}
            for line in raw.splitlines()
            if line.strip()
        ][:60]

    return info


def collect_programs(limit: int = 80) -> dict[str, Any]:
    """Kurulu programlar."""
    programs: list[dict[str, Any]] = []
    if IS_WINDOWS:
        raw = _powershell(
            "$paths = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',"
            "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',"
            "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; "
            "Get-ItemProperty $paths -ErrorAction SilentlyContinue | "
            "Where-Object {$_.DisplayName} | "
            "Select-Object DisplayName,DisplayVersion,Publisher | "
            "ForEach-Object { \"$($_.DisplayName)|$($_.DisplayVersion)|$($_.Publisher)\" }",
            timeout=25.0,
        )
        programs = [
            {
                "name": line.split("|")[0],
                "version": line.split("|")[1] if len(line.split("|")) > 1 else None,
                "publisher": line.split("|")[2] if len(line.split("|")) > 2 else None,
            }
            for line in raw.splitlines()
            if line.strip()
        ]
    else:
        raw = _run(["dpkg-query", "-W", "-f=${Package}|${Version}\n"])
        if not raw:
            raw = _run(["rpm", "-qa", "--qf", "%{NAME}|%{VERSION}\n"])
        programs = [
            {"name": line.split("|")[0], "version": line.split("|")[1] if "|" in line else None}
            for line in raw.splitlines()
            if line.strip()
        ]

    return {"count": len(programs), "items": sorted(programs, key=lambda x: x["name"].lower())[:limit]}


def collect_security() -> dict[str, Any]:
    """Güvenlik durumu (firewall, antivirüs, güncellemeler)."""
    info: dict[str, Any] = {"firewall": None, "antivirus": [], "updates": None, "secure_boot": None}

    if IS_WINDOWS:
        firewall = _powershell(
            "(Get-NetFirewallProfile | Select-Object -ExpandProperty Enabled) -join ','"
        )
        if firewall:
            states = [item.strip() for item in firewall.split(",")]
            info["firewall"] = "açık" if all(state == "True" for state in states) else "kısmen kapalı"

        antivirus = _powershell(
            "Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | "
            "Select-Object -ExpandProperty displayName"
        )
        info["antivirus"] = [line.strip() for line in antivirus.splitlines() if line.strip()]

        secure_boot = _powershell("Confirm-SecureBootUEFI 2>$null")
        info["secure_boot"] = secure_boot.strip() or None

        info["defender"] = _powershell(
            "(Get-MpComputerStatus).RealTimeProtectionEnabled 2>$null"
        ).strip() or None
    else:
        raw = _run(["ufw", "status"])
        if raw:
            info["firewall"] = raw.splitlines()[0] if raw.splitlines() else None

    return info


def collect_environment() -> dict[str, Any]:
    """Geliştirici ortamı: PATH'te bulunan araçlar."""
    tools: dict[str, str | None] = {}
    for tool, args in (
        ("python", ["--version"]),
        ("node", ["--version"]),
        ("npm", ["--version"]),
        ("git", ["--version"]),
        ("docker", ["--version"]),
        ("powershell", ["-Command", "$PSVersionTable.PSVersion.ToString()"]),
    ):
        if not shutil.which(tool):
            tools[tool] = None
            continue
        output = _run([tool, *args], timeout=8.0)
        tools[tool] = output.splitlines()[0].strip() if output else "kurulu"
    return {"tools": tools}


# ======================================================================
#  Ana toplayıcı
# ======================================================================
def collect_all(parts: set[str] | None = None) -> dict[str, Any]:
    """
    Tüm bilgiyi toplar.

    Args:
        parts: yalnızca bu bölümleri topla (None → hepsi).

    Not: Bölümler **paralel** toplanır (PowerShell çağrıları yavaştır).
    """
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    started = time.time()
    collectors: dict[str, Any] = {
        "system": collect_system,
        "cpu": collect_cpu,
        "memory": collect_memory,
        "disks": collect_disks,
        "network": collect_network,
        "gpu": collect_gpu,
        "processes": collect_processes,
        "services": collect_services,
        "users": collect_users,
        "programs": collect_programs,
        "security": collect_security,
        "environment": collect_environment,
    }

    selected = {
        name: collector
        for name, collector in collectors.items()
        if not parts or name in parts
    }

    report: dict[str, Any] = {}

    def _run_one(item: tuple[str, Any]) -> tuple[str, Any]:
        name, collector = item
        try:
            return name, collector()
        except Exception as exc:  # noqa: BLE001 — köprü asla çökmemeli
            return name, {"error": f"{type(exc).__name__}: {exc}"}

    # Paralel toplama — sıralı sonuç korunur
    if selected:
        with ThreadPoolExecutor(max_workers=min(8, len(selected))) as pool:
            for name, value in pool.map(_run_one, selected.items()):
                report[name] = value

    return {
        "ok": True,
        "bridge_version": VERSION,
        "collected_at": datetime.now(UTC).isoformat(),
        "duration_ms": int((time.time() - started) * 1000),
        "psutil": HAS_PSUTIL,
        "report": report,
    }


def device_fingerprint() -> str:
    """
    Kalıcı cihaz kimliği üretir (hostname + MAC + platform karışımı).

    Aynı makinede her zaman aynı sonucu verir.
    """
    parts = [socket.gethostname(), platform.machine(), platform.system()]
    if HAS_PSUTIL:
        macs = sorted(
            address.address
            for addresses in psutil.net_if_addrs().values()
            for address in addresses
            if "AF_LINK" in str(address.family) or "AF_PACKET" in str(address.family)
        )
        parts.extend(macs[:3])
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).digest()
    return "dev-" + base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")[:18]


# ======================================================================
#  HTTP sunucusu
# ======================================================================
class BridgeHandler(BaseHTTPRequestHandler):
    """Köprü HTTP işleyicisi."""

    #: Handler örnekleri üzerinden paylaşılan ayarlar
    token: str = ""
    allowed_origins: list[str] = []
    started_at: float = 0.0

    server_version = f"PixtoolBridge/{VERSION}"

    # ---------------- CORS / yardımcılar ----------------
    def _cors_headers(self) -> dict[str, str]:
        origin = self.headers.get("Origin", "")
        headers = {
            "Access-Control-Allow-Origin": origin if self._origin_allowed(origin) else "null",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Pixtool-Token",
            "Access-Control-Max-Age": "600",
            # Private Network Access: HTTPS sayfadan localhost'a izin
            "Access-Control-Allow-Private-Network": "true",
            "Vary": "Origin",
        }
        return headers

    def _origin_allowed(self, origin: str) -> bool:
        if not origin:
            return False
        if not self.allowed_origins:
            return True  # kısıtlama yok
        return any(origin == allowed or origin.endswith(allowed) for allowed in self.allowed_origins)

    def _send(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in self._cors_headers().items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not self.token:
            return True
        supplied = self.headers.get("X-Pixtool-Token", "")
        return secrets.compare_digest(supplied, self.token)

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        """Varsayılan gürültülü günlüğü sadeleştirir."""
        if os.environ.get("PIXTOOL_BRIDGE_VERBOSE"):
            sys.stderr.write(f"[bridge] {fmt % args}\n")

    # ---------------- HTTP metotları ----------------
    def do_OPTIONS(self) -> None:  # noqa: N802
        """CORS + PNA ön kontrolü."""
        self.send_response(204)
        for key, value in self._cors_headers().items():
            self.send_header(key, value)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"

        if path == "/health":
            self._send(
                200,
                {
                    "ok": True,
                    "service": "pixtool-bridge",
                    "version": VERSION,
                    "psutil": HAS_PSUTIL,
                    "platform": platform.system(),
                    "device_id": device_fingerprint(),
                    "uptime_seconds": int(time.time() - self.started_at),
                    "token_required": bool(self.token),
                },
            )
            return

        if path == "/":
            self._send(
                200,
                {
                    "ok": True,
                    "service": "Pixtool Bridge",
                    "version": VERSION,
                    "endpoints": ["/health", "/info", "/run"],
                    "hint": "Bu yerel köprüdür; arayüz /info ile makine bilgisini alır.",
                },
            )
            return

        if path == "/info":
            if not self._authorized():
                self._send(401, {"ok": False, "error": "Yetkisiz — X-Pixtool-Token gerekli."})
                return
            parts = None
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            for chunk in query.split("&"):
                if chunk.startswith("parts="):
                    parts = {item for item in chunk[6:].split(",") if item}
            payload = collect_all(parts)
            payload["device_id"] = device_fingerprint()
            self._send(200, payload)
            return

        self._send(404, {"ok": False, "error": f"Bilinmeyen uç: {path}"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/")

        if path != "/run":
            self._send(404, {"ok": False, "error": f"Bilinmeyen uç: {path}"})
            return

        if not self._authorized():
            self._send(401, {"ok": False, "error": "Yetkisiz — X-Pixtool-Token gerekli."})
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > 1_000_000:
            self._send(400, {"ok": False, "error": "Geçersiz istek gövdesi."})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._send(400, {"ok": False, "error": "JSON çözümlenemedi."})
            return

        script = str(payload.get("script") or "").strip()
        executor = str(payload.get("executor") or "powershell" if IS_WINDOWS else "bash")
        timeout = min(float(payload.get("timeout") or 120), 900)

        if not script:
            self._send(400, {"ok": False, "error": "`script` alanı zorunlu."})
            return

        # Politika: yalnızca bilinen yorumlayıcılar
        commands = {
            "powershell": ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
            "cmd": ["cmd", "/c", script],
            "bash": ["bash", "-lc", script],
            "python": ["python", "-c", script],
        }
        command = commands.get(executor)
        if command is None:
            self._send(400, {"ok": False, "error": f"Desteklenmeyen yorumlayıcı: {executor}"})
            return

        started = time.time()
        try:
            result = subprocess.run(  # noqa: S603
                command,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
                creationflags=(
                    subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
                    if IS_WINDOWS
                    else 0
                ),
            )
            self._send(
                200,
                {
                    "ok": True,
                    "exit_code": result.returncode,
                    "stdout": (result.stdout or "")[:20000],
                    "stderr": (result.stderr or "")[:8000],
                    "duration_ms": int((time.time() - started) * 1000),
                },
            )
        except subprocess.TimeoutExpired:
            self._send(200, {"ok": False, "error": f"Zaman aşımı ({timeout}s).", "exit_code": None})
        except OSError as exc:
            self._send(200, {"ok": False, "error": f"Çalıştırılamadı: {exc}", "exit_code": None})


# ======================================================================
#  Başlatma
# ======================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description="Pixtool Bridge — yerel makine bilgisi köprüsü")
    parser.add_argument("--host", default=os.environ.get("PIXTOOL_BRIDGE_HOST", DEFAULT_HOST))
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PIXTOOL_BRIDGE_PORT", DEFAULT_PORT)),
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("PIXTOOL_BRIDGE_TOKEN", ""),
        help="Erişim tokenı (boşsa otomatik üretilir)",
    )
    parser.add_argument(
        "--allow-origin",
        action="append",
        default=[],
        help="İzinli kaynak (birden fazla verilebilir). Boşsa hepsi.",
    )
    parser.add_argument(
        "--parent-pid",
        type=int,
        default=0,
        help="Bu süreç kapanınca köprü de kapansın (Tauri tarafından verilir)",
    )
    args = parser.parse_args()

    # Ebeveyn bekçisi: uygulama kapanınca köprü de kapansın
    if args.parent_pid > 0:
        _watch_parent(args.parent_pid)

    token = args.token or secrets.token_urlsafe(24)
    BridgeHandler.token = token
    BridgeHandler.allowed_origins = args.allow_origin
    BridgeHandler.started_at = time.time()

    try:
        server = ThreadingHTTPServer((args.host, args.port), BridgeHandler)
    except OSError as exc:
        sys.stderr.write(f"\n  HATA: {args.host}:{args.port} dinlenemedi — {exc}\n")
        sys.stderr.write("  Port kullanımda olabilir. --port ile değiştirin.\n\n")
        return 1

    device_id = device_fingerprint()
    print()
    print("  ╔══════════════════════════════════════════════════════════╗")
    print("  ║            PIXTOOL BRIDGE — yerel köprü                  ║")
    print("  ╚══════════════════════════════════════════════════════════╝")
    print()
    print(f"  Adres      : http://{args.host}:{args.port}")
    print(f"  Cihaz kimliği: {device_id}")
    print(f"  Platform   : {platform.system()} {platform.release()}")
    print(f"  psutil     : {'kurulu (zengin veri)' if HAS_PSUTIL else 'YOK — pip install psutil önerilir'}")
    print()
    print("  ── TOKEN (arayüz Ayarlar > Köprü alanına girin) ──")
    print(f"  {token}")
    print("  ─────────────────────────────────────────────────")
    print()
    print("  Kapatmak için Ctrl+C. Günlük için PIXTOOL_BRIDGE_VERBOSE=1")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Köprü kapatılıyor…\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
