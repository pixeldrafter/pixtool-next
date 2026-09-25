"""
Donanım envanteri toplayıcıları — anakart, BIOS, RAM slotları, ısı, fan, port.

Ana köprü modülünden ayrı tutulur: burada yalnızca **donanım kimliği** ve
**fiziksel ölçüm** işleri yapılır; HTTP katmanıyla ilgisi yoktur.

Kaynaklar
---------
Windows : CIM/WMI (Win32_BaseBoard, Win32_BIOS, Win32_PhysicalMemory,
          Win32_PhysicalMemoryArray, MSAcpi_ThermalZoneTemperature, Win32_Fan)
Linux   : dmidecode, /sys/class/dmi/id, /sys/class/thermal, /sys/class/hwmon,
          sensors, ss

Tüm işlevler **asla hata fırlatmaz** — bir kaynak okunamazsa alan `None`
kalır ve `notes` içinde nedeni belirtilir.
"""

from __future__ import annotations

import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

IS_WINDOWS = sys.platform.startswith("win")

#: PowerShell çağrıları için varsayılan zaman aşımı
PS_TIMEOUT = 25.0


# ----------------------------------------------------------------------
#  Alt işlem yardımcıları
# ----------------------------------------------------------------------


def _run(command: list[str], timeout: float = 12.0) -> str:
    """Komutu çalıştırır, çıktıyı döndürür (hata → boş metin)."""
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
        return (result.stdout or "").strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _powershell(script: str, timeout: float = PS_TIMEOUT) -> str:
    """PowerShell betiği çalıştırır (UTF-8 çıktı)."""
    if not IS_WINDOWS:
        return ""
    prefix = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
    return _run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", prefix + script],
        timeout=timeout,
    )


def _powershell_json(script: str, timeout: float = PS_TIMEOUT) -> Any:
    """PowerShell'den JSON okur (ConvertTo-Json ile)."""
    raw = _powershell(script, timeout)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def _as_list(value: Any) -> list[dict[str, Any]]:
    """PowerShell tek nesne dönerse listeye çevirir."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def _int(value: Any) -> int | None:
    """Güvenli tam sayı dönüşümü."""
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _clean(value: Any) -> str | None:
    """Boş/anlamsız metinleri None yapar, kırpar."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "unknown", "to be filled by o.e.m.", "default string"}:
        return None
    return text


# ----------------------------------------------------------------------
#  Anakart & BIOS
# ----------------------------------------------------------------------


def collect_board() -> dict[str, Any]:
    """Anakart ve BIOS künyesi."""
    info: dict[str, Any] = {
        "motherboard": {},
        "bios": {},
        "chassis": {},
        "notes": [],
    }

    if IS_WINDOWS:
        board = _as_list(
            _powershell_json(
                "Get-CimInstance Win32_BaseBoard | "
                "Select-Object Manufacturer,Product,Version,SerialNumber,Tag | ConvertTo-Json -Compress"
            )
        )
        if board:
            row = board[0]
            info["motherboard"] = {
                "manufacturer": _clean(row.get("Manufacturer")),
                "product": _clean(row.get("Product")),
                "version": _clean(row.get("Version")),
                "serial": _clean(row.get("SerialNumber")),
                "tag": _clean(row.get("Tag")),
            }
        else:
            info["notes"].append("Win32_BaseBoard okunamadı")

        bios = _as_list(
            _powershell_json(
                "Get-CimInstance Win32_BIOS | "
                "Select-Object Manufacturer,Name,Version,SMBIOSBIOSVersion,"
                "ReleaseDate,SerialNumber | ConvertTo-Json -Compress"
            )
        )
        if bios:
            row = bios[0]
            release = row.get("ReleaseDate")
            info["bios"] = {
                "vendor": _clean(row.get("Manufacturer")),
                "name": _clean(row.get("Name")),
                "version": _clean(row.get("SMBIOSBIOSVersion")) or _clean(row.get("Version")),
                "release_date": _parse_cim_date(release),
                **({"release_date_raw": str(release)} if release else {}),
                "serial": _clean(row.get("SerialNumber")),
                # SMBIOS sürümü ayrıca okunur (BIOS güncelleme karşılaştırması için)
                "smbios_version": None,
                "age_days": None,
            }
            # BIOS yaşı
            parsed = info["bios"]["release_date"]
            if parsed:
                try:
                    released = datetime.strptime(parsed, "%Y-%m-%d").replace(tzinfo=UTC)
                    info["bios"]["age_days"] = (datetime.now(UTC) - released).days
                except ValueError:
                    pass
        else:
            info["notes"].append("Win32_BIOS okunamadı")

        smbios = _powershell_json(
            "Get-CimInstance Win32_ComputerSystemProduct | "
            "Select-Object Vendor,Name,Version,IdentifyingNumber,UUID | ConvertTo-Json -Compress"
        )
        if smbios:
            row = smbios if isinstance(smbios, dict) else (_as_list(smbios) or [{}])[0]
            info["chassis"] = {
                "vendor": _clean(row.get("Vendor")),
                "model": _clean(row.get("Name")),
                "version": _clean(row.get("Version")),
                "serial": _clean(row.get("IdentifyingNumber")),
                "uuid": _clean(row.get("UUID")),
            }

        # Sistem üreticisi/modeli (Win32_ComputerSystem daha dolu olabilir)
        cs = _as_list(
            _powershell_json(
                "Get-CimInstance Win32_ComputerSystem | "
                "Select-Object Manufacturer,Model,SystemFamily,SystemSKUNumber,"
                "TotalPhysicalMemory,NumberOfProcessors | ConvertTo-Json -Compress"
            )
        )
        if cs:
            row = cs[0]
            info["system"] = {
                "manufacturer": _clean(row.get("Manufacturer")),
                "model": _clean(row.get("Model")),
                "family": _clean(row.get("SystemFamily")),
                "sku": _clean(row.get("SystemSKUNumber")),
            }
            info["chassis"] = {**info.get("chassis", {}), **{k: v for k, v in info["system"].items() if v}}

        # SMBIOS sürümü (BIOS güncelleme sitelerinde gerekir)
        smbios_ver = _run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue).Version",
            ],
            timeout=10.0,
        )
        if smbios_ver and info["bios"]:
            info["bios"]["smbios_version"] = _clean(smbios_ver)

    else:
        # Linux — DMI bilgileri doğrudan çekirdekten okunur
        dmi = "/sys/class/dmi/id"
        mapping = {
            "board_vendor": "manufacturer",
            "board_name": "product",
            "board_version": "version",
        }
        board: dict[str, Any] = {}
        for file_name, key in mapping.items():
            value = _read_file(f"{dmi}/{file_name}")
            if value:
                board[key] = value
        info["motherboard"] = board

        bios = {
            "vendor": _read_file(f"{dmi}/bios_vendor"),
            "version": _read_file(f"{dmi}/bios_version"),
            "release_date": _read_file(f"{dmi}/bios_date"),
        }
        bios = {k: v for k, v in bios.items() if v}
        info["bios"] = bios

        info["chassis"] = {
            "vendor": _read_file(f"{dmi}/sys_vendor"),
            "model": _read_file(f"{dmi}/product_name"),
            "version": _read_file(f"{dmi}/product_version"),
            "serial": _read_file(f"{dmi}/product_serial"),
            "uuid": _read_file(f"{dmi}/product_uuid"),
        }

        # dmidecode daha zengin (root gerekir)
        if shutil.which("dmidecode") and os.geteuid() == 0:
            raw = _run(["dmidecode", "-t", "bios"], timeout=10.0)
            for line in raw.splitlines():
                if "Version:" in line and info["bios"].get("version") is None:
                    info["bios"]["version"] = line.split(":", 1)[1].strip()

    return info


def _read_file(path: str) -> str | None:
    """Dosyadan tek satır okur (yoksa None)."""
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return _clean(handle.readline())
    except OSError:
        return None


def _parse_cim_date(value: Any) -> str | None:
    """CIM tarih biçimini (`/Date(1234567890000)/` veya ISO) YYYY-MM-DD yapar."""
    if not value:
        return None
    text = str(value)

    match = re.search(r"/Date\((\d+)", text)
    if match:
        milliseconds = int(match.group(1))
        return datetime.fromtimestamp(milliseconds / 1000, tz=UTC).strftime("%Y-%m-%d")

    match = re.match(r"(\d{4})(\d{2})(\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        return match.group(0)

    return None


# ----------------------------------------------------------------------
#  RAM modülleri ve slotlar
# ----------------------------------------------------------------------


def collect_memory_modules() -> dict[str, Any]:
    """RAM modülleri, slot yerleşimi ve hız bilgisi."""
    result: dict[str, Any] = {
        "modules": [],
        "slots_total": None,
        "slots_used": None,
        "max_capacity_gb": None,
        "notes": [],
    }

    if IS_WINDOWS:
        modules = _as_list(
            _powershell_json(
                "Get-CimInstance Win32_PhysicalMemory | Select-Object "
                "BankLabel,DeviceLocator,Capacity,Speed,ConfiguredClockSpeed,"
                "Manufacturer,PartNumber,SerialNumber,MemoryType,SMBIOSMemoryType,"
                "FormFactor,DataWidth,TotalWidth,ConfiguredVoltage | ConvertTo-Json -Compress",
                timeout=30.0,
            )
        )

        for row in modules:
            capacity = _int(row.get("Capacity")) or 0
            result["modules"].append(
                {
                    "bank": _clean(row.get("BankLabel")),
                    "slot": _clean(row.get("DeviceLocator")),
                    "size_bytes": capacity,
                    "size_gb": round(capacity / (1024**3), 1) if capacity else None,
                    # `Speed` = modülün nominal hızı, `ConfiguredClockSpeed` = çalışan hız
                    "rated_speed_mhz": _int(row.get("Speed")),
                    "speed_mhz": _int(row.get("ConfiguredClockSpeed")) or _int(row.get("Speed")),
                    "manufacturer": _clean(row.get("Manufacturer")),
                    "part_number": _clean(row.get("PartNumber")),
                    "serial": _clean(row.get("SerialNumber")),
                    "memory_type": _memory_type_name(row.get("SMBIOSMemoryType") or row.get("MemoryType")),
                    "form_factor": _form_factor_name(row.get("FormFactor")),
                    "data_width": _int(row.get("DataWidth")),
                    "total_width": _int(row.get("TotalWidth")),
                    "voltage_mv": _int(row.get("ConfiguredVoltage")),
                }
            )

        array = _as_list(
            _powershell_json(
                "Get-CimInstance Win32_PhysicalMemoryArray | "
                "Select-Object MemoryDevices,MaxCapacityEx,MaxCapacity | ConvertTo-Json -Compress"
            )
        )
        if array:
            row = array[0]
            total = _int(row.get("MemoryDevices"))
            max_kb = _int(row.get("MaxCapacityEx")) or _int(row.get("MaxCapacity"))
            result["slots_total"] = total
            # MaxCapacity KB cinsindendir
            result["max_capacity_gb"] = round(max_kb / (1024**2), 1) if max_kb and max_kb > 0 else None

        result["slots_used"] = len(result["modules"])

        if not modules:
            result["notes"].append("Win32_PhysicalMemory okunamadı (sanal makine olabilir)")

    else:
        # Linux — dmidecode root gerektirir
        if shutil.which("dmidecode") and os.geteuid() == 0:
            raw = _run(["dmidecode", "-t", "memory"], timeout=20.0)
            current: dict[str, Any] = {}
            for line in raw.splitlines():
                stripped = line.strip()
                if stripped.startswith("Size:") and "No Module" not in stripped:
                    if current:
                        result["modules"].append(current)
                    current = {"size_gb": _parse_size_gb(stripped.split(":", 1)[1])}
                elif stripped.startswith("Locator:") and current is not None:
                    current["slot"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("Bank Locator:") and current is not None:
                    current["bank"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("Speed:") and current is not None:
                    current["rated_speed_mhz"] = _parse_mhz(stripped.split(":", 1)[1])
                elif stripped.startswith("Configured Memory Speed:") and current is not None:
                    current["speed_mhz"] = _parse_mhz(stripped.split(":", 1)[1])
                elif stripped.startswith("Manufacturer:") and current is not None:
                    current["manufacturer"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("Part Number:") and current is not None:
                    current["part_number"] = stripped.split(":", 1)[1].strip()
                elif stripped.startswith("Type:") and current is not None:
                    current["memory_type"] = stripped.split(":", 1)[1].strip()

            if current and current.get("size_gb"):
                result["modules"].append(current)

            result["slots_used"] = len(result["modules"])

            raw_array = _run(["dmidecode", "-t", "17"], timeout=15.0)
            devices = re.search(r"Number Of Devices:\s*(\d+)", raw_array)
            if devices:
                result["slots_total"] = int(devices.group(1))
            maximum = re.search(r"Maximum Capacity:\s*([\d.]+)\s*(\w+)", raw_array)
            if maximum:
                result["max_capacity_gb"] = _parse_size_gb(f"{maximum.group(1)} {maximum.group(2)}")
        else:
            result["notes"].append("dmidecode yok veya root yetkisi gerekiyor")

        # Fallback: /proc/meminfo
        if not result["modules"]:
            try:
                with open("/proc/meminfo", encoding="utf-8") as handle:
                    for line in handle:
                        if line.startswith("MemTotal:"):
                            result["slots_used"] = 1
                            result["modules"] = [
                                {"slot": "bilinmiyor", "size_gb": round(int(line.split()[1]) / (1024**2), 1)}
                            ]
                            break
            except OSError:
                pass

    return result


def _parse_size_gb(text: str) -> float | None:
    """`8 GB`, `2048 MB` → GB."""
    match = re.search(r"([\d.]+)\s*(GB|MB|TB|KB)", text, re.IGNORECASE)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2).upper()
    factor = {"KB": 1 / (1024**2), "MB": 1 / 1024, "GB": 1, "TB": 1024}[unit]
    return round(value * factor, 1)


def _parse_mhz(text: str) -> int | None:
    """`3200 MT/s` veya `3200 MHz` → 3200."""
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else None


def _memory_type_name(code: Any) -> str | None:
    """SMBIOS bellek tipi kodunu ada çevirir."""
    table = {
        20: "DDR",
        21: "DDR2",
        24: "DDR3",
        26: "DDR4",
        27: "LPDDR",
        28: "LPDDR2",
        29: "LPDDR3",
        30: "LPDDR4",
        34: "DDR5",
        35: "LPDDR5",
    }
    value = _int(code)
    return table.get(value) if value is not None else None


def _form_factor_name(code: Any) -> str | None:
    """Bellek form faktörü kodunu ada çevirir."""
    table = {8: "DIMM", 12: "SODIMM", 13: "SRIMM", 11: "RIMM"}
    value = _int(code)
    return table.get(value) if value is not None else None


# ----------------------------------------------------------------------
#  Isı ve fanlar
# ----------------------------------------------------------------------


def _collect_nvidia() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    NVIDIA GPU'ları için ısı, fan ve güç bilgisi (`nvidia-smi`).

    Bu yol **ek kurulum gerektirmez** — sürücüyle birlikte gelir. CPU ve
    anakart sensörleri için LibreHardwareMonitor gerekir (bkz. `setup-sensors.ps1`).
    """
    if not shutil.which("nvidia-smi"):
        return [], []

    raw = _run(
        [
            "nvidia-smi",
            "--query-gpu=index,name,driver_version,temperature.gpu,temperature.memory,"
            "fan.speed,power.draw,power.limit,utilization.gpu,utilization.memory,"
            "memory.used,memory.total,clocks.current.graphics,clocks.current.memory,"
            "clocks.max.graphics",
            "--format=csv,noheader,nounits",
        ],
        timeout=15.0,
    )

    temperatures: list[dict[str, Any]] = []
    fans: list[dict[str, Any]] = []

    for line in raw.splitlines():
        parts = [piece.strip() for piece in line.split(",")]
        if len(parts) < 15:
            continue

        name = parts[1]

        def num(value: str) -> float | None:
            try:
                return float(value)
            except ValueError:
                return None

        core_temp = num(parts[3])
        mem_temp = num(parts[4])
        fan_percent = num(parts[5])

        if core_temp is not None:
            temperatures.append(
                {
                    "label": f"{name} · çekirdek",
                    "celsius": round(core_temp, 1),
                    "source": "nvidia-smi",
                }
            )
        if mem_temp is not None and mem_temp > 0:
            temperatures.append(
                {
                    "label": f"{name} · bellek",
                    "celsius": round(mem_temp, 1),
                    "source": "nvidia-smi",
                }
            )

        if fan_percent is not None:
            fans.append(
                {
                    "label": f"{name} · fan",
                    "percent": round(fan_percent),
                    "rpm": None,
                    "source": "nvidia-smi",
                }
            )

    return temperatures, fans


def _collect_nvidia_detail() -> list[dict[str, Any]]:
    """GPU ayrıntısı (güç, VRAM, saat hızları) — `nvidia-smi`."""
    if not shutil.which("nvidia-smi"):
        return []

    raw = _run(
        [
            "nvidia-smi",
            "--query-gpu=index,name,driver_version,temperature.gpu,fan.speed,power.draw,"
            "power.limit,utilization.gpu,utilization.memory,memory.used,memory.total,"
            "clocks.current.graphics,clocks.current.memory,clocks.max.graphics",
            "--format=csv,noheader,nounits",
        ],
        timeout=15.0,
    )

    cards: list[dict[str, Any]] = []

    for line in raw.splitlines():
        parts = [piece.strip() for piece in line.split(",")]
        if len(parts) < 14:
            continue

        def num(value: str) -> float | None:
            try:
                return float(value)
            except ValueError:
                return None

        cards.append(
            {
                "index": _int(parts[0]),
                "name": parts[1],
                "driver": parts[2],
                "temperature_c": num(parts[3]),
                "fan_percent": num(parts[4]),
                "power_w": num(parts[5]),
                "power_limit_w": num(parts[6]),
                "utilization_percent": num(parts[7]),
                "memory_utilization_percent": num(parts[8]),
                "memory_used_mb": num(parts[9]),
                "memory_total_mb": num(parts[10]),
                "clock_graphics_mhz": num(parts[11]),
                "clock_memory_mhz": num(parts[12]),
                "clock_max_graphics_mhz": num(parts[13]),
            }
        )

    return cards


def collect_thermal() -> dict[str, Any]:
    """
    Sıcaklıklar ve fan devirleri.

    Windows'ta yerleşik WMI yalnızca ACPI termal bölgesi verir (çoğu masaüstü
    anakartta boş döner). Bu yüzden sırayla denenir:

      1. LibreHardwareMonitor / OpenHardwareMonitor WMI ad alanı (kuruluysa — en zengin)
      2. `MSAcpi_ThermalZoneTemperature` (ACPI)
      3. `Win32_Fan` / `Win32_TemperatureProbe` (çoğu zaman boş)

    Linux'ta `/sys/class/thermal`, `/sys/class/hwmon` ve `sensors` kullanılır.
    """
    result: dict[str, Any] = {
        "temperatures": [],
        "fans": [],
        "source": None,
        "available": False,
        "notes": [],
    }

    if IS_WINDOWS:
        # 0) NVIDIA — sürücüyle gelir, ek kurulum gerekmez (en güvenilir yol)
        nvidia_temps, nvidia_fans = _collect_nvidia()
        result["temperatures"].extend(nvidia_temps)
        result["fans"].extend(nvidia_fans)
        if nvidia_temps or nvidia_fans:
            result["source"] = "nvidia-smi"
            result["available"] = True

        # 1) LibreHardwareMonitor / OpenHardwareMonitor
        for namespace in ("root/LibreHardwareMonitor", "root/OpenHardwareMonitor"):
            data = _as_list(
                _powershell_json(
                    f"Get-CimInstance -Namespace {namespace} -ClassName Sensor "
                    "-ErrorAction SilentlyContinue | "
                    "Select-Object Identifier,SensorType,Name,Value,Min,Max | ConvertTo-Json -Compress",
                    timeout=20.0,
                )
            )
            if data:
                for row in data:
                    kind = str(row.get("SensorType") or "").lower()
                    name = _clean(row.get("Name"))
                    value = row.get("Value")
                    if kind == "temperature":
                        result["temperatures"].append(
                            {
                                "label": name,
                                "celsius": round(float(value), 1) if value is not None else None,
                                "max_celsius": round(float(row["Max"]), 1) if row.get("Max") is not None else None,
                                "source": namespace.split("/")[-1],
                            }
                        )
                    elif kind == "fan":
                        result["fans"].append(
                            {
                                "label": name,
                                "rpm": round(float(value), 0) if value is not None else None,
                                "source": namespace.split("/")[-1],
                            }
                        )
                if result["temperatures"] or result["fans"]:
                    if result["source"] is None:
                        result["source"] = namespace.split("/")[-1]
                    result["available"] = True
                    break

        # 2) ACPI termal bölgesi
        if not result["available"]:
            acpi = _as_list(
                _powershell_json(
                    "Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature "
                    "-ErrorAction SilentlyContinue | "
                    "Select-Object InstanceName,CurrentTemperature | ConvertTo-Json -Compress",
                    timeout=20.0,
                )
            )
            for row in acpi:
                raw = row.get("CurrentTemperature")
                if raw is None:
                    continue
                # Deci-Kelvin → Celsius
                celsius = round(float(raw) / 10.0 - 273.15, 1)
                if -20 < celsius < 150:
                    result["temperatures"].append(
                        {
                            "label": _clean(row.get("InstanceName")) or "ACPI termal bölge",
                            "celsius": celsius,
                            "source": "ACPI",
                        }
                    )
            if result["temperatures"]:
                if result["source"] is None:
                    result["source"] = "ACPI"
                result["available"] = True

        # 3) Win32_Fan
        if not result["fans"]:
            fans = _as_list(
                _powershell_json(
                    "Get-CimInstance Win32_Fan -ErrorAction SilentlyContinue | "
                    "Select-Object Name,DesiredSpeed,ActiveCooling,VariableSpeed | ConvertTo-Json -Compress",
                    timeout=15.0,
                )
            )
            for row in fans:
                speed = row.get("DesiredSpeed")
                result["fans"].append(
                    {
                        "label": _clean(row.get("Name")) or "Fan",
                        "rpm": _int(speed),
                        "active": bool(row.get("ActiveCooling")),
                        "source": "Win32_Fan",
                    }
                )

        if not result["available"]:
            result["notes"].append(
                "Windows yerleşik WMI ısı sensörü sağlamadı ve NVIDIA GPU bulunamadı. "
                "Ayrıntılı CPU/anakart ısısı ve fan devri için LibreHardwareMonitor "
                "kurup çalıştırın: services/bridge/setup-sensors.ps1"
            )
        elif result["source"] == "nvidia-smi":
            result["notes"].append(
                "Isı verisi NVIDIA GPU'dan geliyor. CPU ve anakart sensörleri için "
                "services/bridge/setup-sensors.ps1 çalıştırın."
            )

    else:
        # Linux — /sys/class/thermal
        thermal_dir = "/sys/class/thermal"
        if os.path.isdir(thermal_dir):
            for zone in sorted(os.listdir(thermal_dir)):
                if not zone.startswith("thermal_zone"):
                    continue
                try:
                    with open(f"{thermal_dir}/{zone}/temp", encoding="utf-8") as handle:
                        milli = int(handle.readline().strip())
                except (OSError, ValueError):
                    continue
                label = zone
                try:
                    with open(f"{thermal_dir}/{zone}/type", encoding="utf-8") as handle:
                        label = handle.readline().strip() or zone
                except OSError:
                    pass
                celsius = round(milli / 1000.0, 1)
                if -20 < celsius < 150:
                    result["temperatures"].append(
                        {"label": label, "celsius": celsius, "source": "thermal_zone"}
                    )

        # Linux — /sys/class/hwmon (fanlar ve ek sensörler)
        hwmon = "/sys/class/hwmon"
        if os.path.isdir(hwmon):
            for chip in sorted(os.listdir(hwmon)):
                base = f"{hwmon}/{chip}"
                chip_name = _read_file(f"{base}/name") or chip
                for entry in sorted(os.listdir(base)) if os.path.isdir(base) else []:
                    if entry.startswith("temp") and entry.endswith("_input"):
                        try:
                            with open(f"{base}/{entry}", encoding="utf-8") as handle:
                                milli = int(handle.readline().strip())
                        except (OSError, ValueError):
                            continue
                        celsius = round(milli / 1000.0, 1)
                        if -20 < celsius < 150:
                            result["temperatures"].append(
                                {"label": f"{chip_name}/{entry}", "celsius": celsius, "source": "hwmon"}
                            )
                    elif entry.startswith("fan") and entry.endswith("_input"):
                        try:
                            with open(f"{base}/{entry}", encoding="utf-8") as handle:
                                rpm = int(handle.readline().strip())
                        except (OSError, ValueError):
                            continue
                        if rpm > 0:
                            result["fans"].append(
                                {"label": f"{chip_name}/{entry}", "rpm": rpm, "source": "hwmon"}
                            )

        if result["temperatures"] or result["fans"]:
            result["source"] = "sysfs"
            result["available"] = True

    if result["temperatures"]:
        hottest = max(result["temperatures"], key=lambda item: item.get("celsius") or -273)
        result["hottest"] = hottest
        values = [item["celsius"] for item in result["temperatures"] if item.get("celsius") is not None]
        if values:
            result["average_celsius"] = round(sum(values) / len(values), 1)

    # GPU ayrıntısı (NVIDIA)
    if IS_WINDOWS:
        cards = _collect_nvidia_detail()
        if cards:
            result["gpu_cards"] = cards

    return result


# ----------------------------------------------------------------------
#  Port taraması
# ----------------------------------------------------------------------

#: Riskli portlar → açıklama ve seviye
RISKY_PORTS: dict[int, tuple[str, str]] = {
    21: ("FTP — şifresiz iletim", "Yüksek"),
    23: ("Telnet — şifresiz, kullanılmamalı", "Yüksek"),
    25: ("SMTP — açık relay riski", "Orta"),
    53: ("DNS — amplifikasyon saldırısı", "Düşük"),
    111: ("rpcbind", "Orta"),
    135: ("RPC", "Orta"),
    137: ("NetBIOS isim çözümleme", "Orta"),
    138: ("NetBIOS datagram", "Orta"),
    139: ("NetBIOS oturum", "Orta"),
    445: ("SMB — fidye yazılımı hedefi", "Yüksek"),
    1433: ("MSSQL", "Yüksek"),
    1521: ("Oracle DB", "Yüksek"),
    2049: ("NFS — dışarı açılmamalı", "Yüksek"),
    2375: ("Docker API — şifresiz root erişimi", "Kritik"),
    3306: ("MySQL/MariaDB", "Yüksek"),
    3389: ("RDP — uzak masaüstü", "Yüksek"),
    5432: ("PostgreSQL", "Yüksek"),
    5900: ("VNC — zayıf şifreleme", "Yüksek"),
    5985: ("WinRM HTTP", "Orta"),
    5986: ("WinRM HTTPS", "Düşük"),
    6379: ("Redis — çoğu zaman şifresiz", "Kritik"),
    8080: ("HTTP alternatif", "Düşük"),
    9200: ("Elasticsearch — çoğu zaman şifresiz", "Yüksek"),
    11211: ("Memcached", "Yüksek"),
    27017: ("MongoDB", "Yüksek"),
}


def collect_ports() -> dict[str, Any]:
    """Dinlenen TCP/UDP portları, sahibi ve risk değerlendirmesi."""
    result: dict[str, Any] = {
        "listening": [],
        "tcp_count": 0,
        "udp_count": 0,
        "external_count": 0,
        "risky": [],
        "risk_score": 0,
        "notes": [],
    }

    if IS_WINDOWS:
        tcp = _as_list(
            _powershell_json(
                "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | "
                "Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress",
                timeout=30.0,
            )
        )

        # PID → süreç adı (tek çağrıda)
        process_map: dict[int, str] = {}
        processes = _as_list(
            _powershell_json(
                "Get-Process -ErrorAction SilentlyContinue | "
                "Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress",
                timeout=30.0,
            )
        )
        for row in processes:
            pid = _int(row.get("Id"))
            if pid is not None:
                process_map[pid] = _clean(row.get("ProcessName")) or "?"

        seen: set[tuple[str, int]] = set()
        for row in tcp:
            address = str(row.get("LocalAddress") or "")
            port = _int(row.get("LocalPort"))
            pid = _int(row.get("OwningProcess"))
            if port is None:
                continue

            key = (address, port)
            if key in seen:
                continue
            seen.add(key)

            external = address in {"0.0.0.0", "::"}
            entry = {
                "protocol": "tcp",
                "address": "tümü" if external else address,
                "port": port,
                "pid": pid,
                "process": process_map.get(pid or -1, "?") if pid else "?",
                "external": external,
            }
            result["listening"].append(entry)
            result["tcp_count"] += 1
            if external:
                result["external_count"] += 1

        udp = _as_list(
            _powershell_json(
                "Get-NetUDPEndpoint -ErrorAction SilentlyContinue | "
                "Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress",
                timeout=30.0,
            )
        )
        for row in udp:
            address = str(row.get("LocalAddress") or "")
            port = _int(row.get("LocalPort"))
            pid = _int(row.get("OwningProcess"))
            if port is None:
                continue
            key = (address, port)
            if key in seen:
                continue
            seen.add(key)
            external = address in {"0.0.0.0", "::"}
            result["listening"].append(
                {
                    "protocol": "udp",
                    "address": "tümü" if external else address,
                    "port": port,
                    "pid": pid,
                    "process": process_map.get(pid or -1, "?") if pid else "?",
                    "external": external,
                }
            )
            result["udp_count"] += 1

    else:
        raw = _run(["ss", "-tulpnH"], timeout=15.0)
        if not raw:
            raw = _run(["netstat", "-tulpn"], timeout=15.0)

        for line in raw.splitlines():
            parts = line.split()
            if len(parts) < 5:
                continue
            protocol = parts[0].lower()
            local = parts[4]
            port_text = local.rsplit(":", 1)[-1]
            port = _int(port_text)
            if port is None:
                continue

            address = local.rsplit(":", 1)[0]
            external = address in {"0.0.0.0", "::", "*", "[::]"}
            process = ""
            match = re.search(r'users:\(\("([^"]+)"', line)
            if match:
                process = match.group(1)

            result["listening"].append(
                {
                    "protocol": protocol,
                    "address": "tümü" if external else address,
                    "port": port,
                    "pid": None,
                    "process": process or "?",
                    "external": external,
                }
            )
            if protocol.startswith("tcp"):
                result["tcp_count"] += 1
            else:
                result["udp_count"] += 1
            if external:
                result["external_count"] += 1

    # Risk değerlendirmesi
    weights = {"Kritik": 40, "Yüksek": 20, "Orta": 8, "Düşük": 3}
    score = 0
    seen_risky: set[int] = set()

    for entry in result["listening"]:
        port = entry["port"]
        if port not in RISKY_PORTS:
            continue

        # Aynı port TCP ve UDP'de ya da birden çok adreste dinleniyorsa
        # yalnızca **bir kez** raporla (risk de bir kez sayılır).
        if port in seen_risky:
            continue
        seen_risky.add(port)

        description, severity = RISKY_PORTS[port]
        result["risky"].append(
            {
                "port": port,
                "protocol": entry["protocol"],
                "description": description,
                "severity": severity,
                "process": entry["process"],
                "external": entry["external"],
            }
        )
        # Dışarı açık değilse risk yarıya iner
        score += weights.get(severity, 3) if entry["external"] else weights.get(severity, 3) / 2

    # Geçici portlar (49152+) normaldir — sayılmaz
    meaningful = [entry for entry in result["listening"] if entry["external"] and entry["port"] < 49152]
    if len(meaningful) > 8:
        score += 8
        result["notes"].append(f"{len(meaningful)} adet geçici olmayan port dışarı açık")

    result["risk_score"] = min(100, int(round(score)))
    result["listening"].sort(key=lambda item: (item["port"], item["protocol"]))
    result["risky"].sort(key=lambda item: weights.get(item["severity"], 0), reverse=True)
    result["meaningful_external"] = len(meaningful)

    return result


# ----------------------------------------------------------------------
#  BIOS güncelleme kontrolü
# ----------------------------------------------------------------------

#: Anakart üreticisi → destek sayfası şablonu
#  `{model}` model numarasıyla değiştirilir.
VENDOR_SUPPORT: dict[str, dict[str, str]] = {
    "micro-star": {
        "name": "MSI",
        "url": "https://www.msi.com/Motherboard/{model}/support",
        "search": "https://www.msi.com/search/{model}",
    },
    "asustek": {
        "name": "ASUS",
        "url": "https://www.asus.com/support/Download-Center/",
        "search": "https://www.asus.com/support/search?search={model}",
    },
    "gigabyte": {
        "name": "Gigabyte",
        "url": "https://www.gigabyte.com/Motherboard/{model}/support",
        "search": "https://www.gigabyte.com/search?q={model}",
    },
    "asrock": {
        "name": "ASRock",
        "url": "https://www.asrock.com/mb/index.asp",
        "search": "https://www.asrock.com/search.asp?q={model}",
    },
    "dell": {
        "name": "Dell",
        "url": "https://www.dell.com/support/home/en-us/product-support/servicetag/{serial}/drivers",
        "search": "https://www.dell.com/support/home",
    },
    "hp": {
        "name": "HP",
        "url": "https://support.hp.com/us-en/drivers",
        "search": "https://support.hp.com/us-en/search?q={model}",
    },
    "lenovo": {
        "name": "Lenovo",
        "url": "https://pcsupport.lenovo.com/products/{serial}",
        "search": "https://pcsupport.lenovo.com",
    },
    "acer": {
        "name": "Acer",
        "url": "https://www.acer.com/us-en/support/product-support/{model}",
        "search": "https://www.acer.com/us-en/support",
    },
    "american megatrends": {
        "name": "AMI (OEM)",
        "url": "",
        "search": "",
    },
}


def _vendor_key(manufacturer: str | None) -> str | None:
    """Üretici adından şablon anahtarını bulur."""
    if not manufacturer:
        return None
    text = manufacturer.lower()
    for key in VENDOR_SUPPORT:
        if key in text:
            return key
    return None


def _model_slug(motherboard: dict[str, Any], board_model: str | None) -> str | None:
    """
    Destek URL'i için ürün kimliği.

    Üreticiler **pazarlama adını** kullanır, kod adını değil:
      • MSI  → `PRO-B840M-B`   ("PRO B840M-B (MS-7E76)" metninden)
      • ASUS → `PRIME-B650-PLUS`

    Kod adı (`MS-7E76`) yalnızca pazarlama adı yoksa kullanılır.
    """
    product = str(motherboard.get("product") or "")

    # Parantez içindeki kod adını at: "PRO B840M-B (MS-7E76)" → "PRO B840M-B"
    marketing = re.sub(r"\s*\([^)]*\)\s*", "", product).strip()

    if marketing:
        # Boşlukları tireye çevir, ardışık tireleri sadeleştir
        slug = re.sub(r"[^A-Za-z0-9]+", "-", marketing).strip("-")
        if slug:
            return slug

    if board_model:
        match = re.search(r"([A-Z]{2}-[0-9A-Z]{4,})", board_model)
        if match:
            return match.group(1)
        return board_model.replace(" ", "-")

    return None


#: `collect_board()` sonucu için kısa ömürlü önbellek.
#  BIOS kontrolü de aynı veriyi kullanır; iki kez PowerShell çağırmayalım.
_BOARD_CACHE: dict[str, Any] = {"at": 0.0, "data": None}
_BOARD_TTL = 60.0


def collect_board_cached() -> dict[str, Any]:
    """`collect_board()` sonucunu 60 sn önbellekten döndürür."""
    now = time.time()
    if _BOARD_CACHE["data"] is not None and (now - _BOARD_CACHE["at"]) < _BOARD_TTL:
        return _BOARD_CACHE["data"]  # type: ignore[return-value]

    data = collect_board()
    _BOARD_CACHE["data"] = data
    _BOARD_CACHE["at"] = now
    return data


def collect_bios_check() -> dict[str, Any]:
    """BIOS güncelleme kontrolü (anakart verisini önbellekten kullanır)."""
    return check_bios_update(collect_board_cached())


def check_bios_update(info: dict[str, Any]) -> dict[str, Any]:
    """
    BIOS güncellemesi var mı diye **en iyi çabayla** bakar.

    ⚠️ Üretici siteleri bot koruması kullanır; otomatik sürüm çıkarımı her
    zaman mümkün değildir. Bu yüzden dönen yapı:

      • `checked`      → çevrimiçi sorgu denendi mi
      • `latest`       → bulunabildiyse en yeni sürüm/tarih
      • `update_available` → karşılaştırma yapılabildiyse sonuç
      • `support_url`  → **her durumda** doldurulur (kullanıcı elle bakar)
      • `note`         → durumun açıklaması
    """
    motherboard = info.get("motherboard") or {}
    bios = info.get("bios") or {}
    chassis = info.get("chassis") or {}

    manufacturer = motherboard.get("manufacturer") or chassis.get("vendor")
    board_model = chassis.get("model") or motherboard.get("product")
    serial = chassis.get("serial")

    result: dict[str, Any] = {
        "vendor": None,
        "current_version": bios.get("version"),
        "current_date": bios.get("release_date"),
        "current_age_days": bios.get("age_days"),
        "latest_version": None,
        "latest_date": None,
        "update_available": None,
        "support_url": None,
        "search_url": None,
        "model": None,
        "searched": False,
        "blocked": False,
        "note": "",
        "source": None,
    }

    key = _vendor_key(str(manufacturer or ""))
    if not key:
        result["note"] = (
            "Üretici tanınamadı — destek sayfası oluşturulamadı. "
            "Anakart markasına göre üretici sitesinden kontrol edin."
        )
        return result

    vendor = VENDOR_SUPPORT[key]
    result["vendor"] = vendor["name"]

    model_id = _model_slug(motherboard, str(board_model) if board_model else None)
    result["model"] = model_id
    template = vendor["url"]

    if template:
        result["support_url"] = template.format(
            model=model_id or "anakart",
            serial=serial or "seri-no",
        )

    if vendor.get("search") and model_id:
        result["search_url"] = vendor["search"].format(model=model_id)

    if not result["support_url"]:
        result["note"] = f"{vendor['name']} için doğrudan bağlantı oluşturulamadı."
        return result

    # --- Çevrimiçi sorgu (en iyi çaba) ---
    # Üretici siteleri çoğunlukla JS ile yüklenir; HTML'den sürüm çıkarmak
    # güvenilir değildir. Yine de denenir, başarılı olursa karşılaştırılır.
    try:
        request = Request(
            result["support_url"],
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urlopen(request, timeout=15) as response:  # noqa: S310 — sabit şablon
            html = response.read().decode("utf-8", errors="replace")

        result["searched"] = True

        # Sürüm benzeri diziler: "7E76v2A", "2.A40", "1.20"
        versions = re.findall(r"\b([0-9A-Z]{1,4}[vV][0-9]+\.[0-9A-Z]{1,4})\b", html)
        if not versions:
            versions = re.findall(r"\b(\d+\.[0-9A-Z]{1,3})\b", html)

        cleaned = sorted({item.strip() for item in versions if len(item) >= 3})
        if cleaned:
            result["latest_version"] = cleaned[-1]
            result["source"] = "vendor-html"
        else:
            result["note"] = (
                "Destek sayfası okunamadı (üretici sayfaları JavaScript ile yüklenir). "
                "Bağlantıya tıklayıp elle kontrol edin."
            )
    except (URLError, OSError, ValueError) as exc:
        # Üretici siteleri bot koruması kullanır (403/503) — bu **beklenen** durum.
        detail = getattr(exc, "code", None)
        if detail in {403, 429, 503}:
            result["note"] = (
                f"{vendor['name']} destek sayfası otomatik sorguyu engelledi (HTTP {detail}). "
                "Kurulu sürüm ve tarih yukarıda; karşılaştırma için bağlantıyı kullanın."
            )
        else:
            result["note"] = f"Üretici sitesine ulaşılamadı: {type(exc).__name__}"
        result["blocked"] = True

    # --- Değerlendirme ---
    current = str(result["current_version"] or "").strip()
    latest = str(result["latest_version"] or "").strip()

    if latest and current:
        if latest.lower() == current.lower():
            result["update_available"] = False
            result["note"] = "Kurulu BIOS zaten en son sürüm."
        else:
            result["update_available"] = True
            result["note"] = (
                f"Yeni sürüm olabilir: kurulu {current} → sitede {latest}. "
                "Doğrulamak için destek sayfasına bakın."
            )
    elif not result["note"]:
        result["note"] = (
            "BIOS yaşı "
            + (f"{result['current_age_days']} gün. " if result["current_age_days"] else "")
            + "Üretici sayfasından güncel sürümü karşılaştırın."
        )

    if result["current_age_days"] is not None and result["current_age_days"] > 730:
        result["note"] += " (BIOS 2 yaşından eski — güncelleme önerilir.)"

    return result
