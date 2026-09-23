"""
Script kütüphanesi servisi.

`scripts_library/` klasörünü tarar, PowerShell yorum bloklarından açıklama
çıkarır ve kategorilere ayırır.

Desteklenen uzantılar: `.ps1`, `.py`, `.sh`
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from app.models.scripts import ScriptInfo

logger = logging.getLogger("pixtool.scripts")


SUPPORTED_EXTENSIONS = {".ps1", ".py", ".sh", ".bash"}


def _find_library_root() -> Path:
    """`scripts_library/` klasörünü yukarı doğru arar."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "scripts_library"
        if candidate.is_dir():
            return candidate
    return here.parents[4] / "scripts_library"


#: Kütüphane kökü — iki yerleşim desteklenir:
#:   yerel  : <kök>/scripts_library
#:   sunucu : /opt/pixtool/scripts_library
LIBRARY_ROOT = _find_library_root()

#: Dosya adı önekine göre kategori eşlemesi.
CATEGORY_PREFIXES: list[tuple[str, str]] = [
    ("PixNet", "Ağ"),
    ("PixSecure", "Güvenlik"),
    ("PixDriver", "Sürücü"),
    ("PixSoft", "Yazılım"),
    ("PixFile", "Dosya"),
    ("PixLog", "Günlük"),
    ("PixProcess", "İşlem"),
    ("PixUser", "Kullanıcı"),
    ("Pixuser", "Kullanıcı"),
    ("PixDebloat", "Temizlik"),
    ("Pix_Repair", "Tamir"),
    ("Pix", "Genel"),
    ("Windows_Temizligi", "Temizlik"),
    ("Sistem_Bilgisi", "Sistem"),
    ("Guc_Raporu", "Sistem"),
    ("Sifre_Uretici", "Güvenlik"),
    ("oemimza", "Lisans"),
]

#: Dosya adından çıkarılacak gürültü (uzantı, ayraçlar).
NAME_CLEANUP = re.compile(r"[_\-]+")


def _detect_category(filename: str) -> str:
    """Dosya adı önekine göre kategori belirler."""
    for prefix, category in CATEGORY_PREFIXES:
        if filename.startswith(prefix):
            return category
    return "Genel"


def _detect_platform(path: Path) -> str:
    """Klasör adına göre platform belirler."""
    parent = path.parent.name.lower()
    if parent in {"windows", "win"}:
        return "windows"
    if parent in {"linux", "unix"}:
        return "linux"
    return "windows" if path.suffix == ".ps1" else "linux"


def _pretty_name(filename: str) -> str:
    """Dosya adını okunabilir bir başlığa çevirir."""
    stem = Path(filename).stem
    stem = NAME_CLEANUP.sub(" ", stem)
    return " ".join(stem.split())


def _extract_powershell_meta(content: str) -> dict[str, str | None]:
    """
    PowerShell yorum bloğundan açıklama / yazar / sürüm çıkarır.

    Örnek:
        <#
        .SYNOPSIS
            Ağ yapılandırmasını yönetir.
        .AUTHOR
            Ömer Çataloğlu
        #>
    """
    result: dict[str, str | None] = {"description": "", "author": None, "version": None}

    # .SYNOPSIS veya .DESCRIPTION bloğu
    for key in ("SYNOPSIS", "DESCRIPTION"):
        match = re.search(
            rf"\.{key}\s*\r?\n(?P<body>(?:[ \t]+\S.*\r?\n)+)",
            content,
            re.IGNORECASE,
        )
        if match:
            body = match.group("body")
            lines = [line.strip() for line in body.splitlines() if line.strip()]
            # Yorum işaretlerini temizle (#, //, *)
            cleaned = [re.sub(r"^[#*/\s]+", "", line).strip() for line in lines]
            text = " ".join(part for part in cleaned if part and not part.startswith("."))
            if text:
                result["description"] = text[:400]
                break

    for key, field in (("AUTHOR", "author"), ("VERSION", "version")):
        match = re.search(rf"\.{key}\s*\r?\n(?P<body>[^\r\n]+)", content, re.IGNORECASE)
        if match:
            value = re.sub(r"^[#*/\s]+", "", match.group("body")).strip()
            if value:
                result[field] = value[:120]

    return result


def _extract_python_meta(content: str) -> dict[str, str | None]:
    """Python docstring'inden ilk satırı açıklama olarak alır."""
    result: dict[str, str | None] = {"description": "", "author": None, "version": None}
    match = re.match(r'\s*(?:"""|\'\'\')(?P<body>[\s\S]*?)(?:"""|\'\'\')', content)
    if match:
        body = match.group("body").strip()
        lines = [line.strip() for line in body.splitlines() if line.strip()]
        if lines:
            result["description"] = " ".join(lines[:2])[:400]

    version = re.search(r"__version__\s*=\s*[\"']([^\"']+)[\"']", content)
    if version:
        result["version"] = version.group(1)

    return result


def _read_script(path: Path) -> ScriptInfo:
    """Tek bir script dosyasını okur ve bilgilerini çıkarır."""
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("Script okunamadı: %s (%s)", path, exc)
        raw = ""

    meta = _extract_powershell_meta(raw) if path.suffix in {".ps1"} else _extract_python_meta(raw)

    return ScriptInfo(
        id=path.name,
        name=_pretty_name(path.name),
        description=meta["description"] or "",
        category=_detect_category(path.name),
        platform=_detect_platform(path),
        extension=path.suffix,
        size_bytes=path.stat().st_size,
        lines=raw.count("\n") + (1 if raw else 0),
        author=meta["author"],
        version=meta["version"],
    )


def list_scripts() -> tuple[list[ScriptInfo], list[str]]:
    """
    Kütüphaneyi tarar.

    Returns:
        (script listesi, kategori listesi)
    """
    scripts: list[ScriptInfo] = []

    if not LIBRARY_ROOT.exists():
        logger.warning("Script kütüphanesi bulunamadı: %s", LIBRARY_ROOT)
        return scripts, []

    for path in sorted(LIBRARY_ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        scripts.append(_read_script(path))

    categories = sorted({item.category for item in scripts})
    return scripts, categories


def find_script(script_id: str) -> Path | None:
    """
    Kimliğe göre script dosyasını bulur.

    ⚠️ Güvenlik: yalnızca kütüphane kökü içindeki dosyalar döndürülür
    (yol geçişi / path traversal engellenir).
    """
    # Yol geçişi denemelerini reddet
    if "/" in script_id or "\\" in script_id or ".." in script_id:
        logger.warning("Geçersiz script kimliği reddedildi: %r", script_id)
        return None

    for path in LIBRARY_ROOT.rglob(script_id):
        if not path.is_file():
            continue
        # Gerçekten kütüphane içinde mi?
        try:
            path.resolve().relative_to(LIBRARY_ROOT.resolve())
        except ValueError:
            continue
        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
            return path

    return None


def read_script(script_id: str) -> tuple[ScriptInfo, str] | None:
    """Script bilgisini ve içeriğini döndürür."""
    path = find_script(script_id)
    if path is None:
        return None

    content = path.read_text(encoding="utf-8", errors="replace")
    return _read_script(path), content
