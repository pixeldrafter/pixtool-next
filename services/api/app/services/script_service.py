"""
Script kütüphanesi servisi.

`scripts_library/` klasörünü tarar, yorum bloklarından açıklama çıkarır,
kategorilere ayırır ve **tam CRUD** (oluştur / oku / güncelle / sil) sağlar.

Desteklenen uzantılar: `.ps1`, `.psm1`, `.cmd`, `.bat`, `.sh`, `.bash`, `.py`

## Elle belirlenen üst veri (`.meta.json`)

Kategori ve tip dosya adından otomatik çıkarılır; ama kullanıcı elle
belirlediğinde `scripts_library/.meta.json` içinde saklanır:

    {
      "PixNet_Ag.ps1": {
        "name": "Ağ Yöneticisi",
        "category": "Ağ",
        "type": "powershell",
        "description": "..."
      }
    }

Bu dosya sayesinde `.cmd` veya `.sh` gibi tipler de sorunsuz saklanır.
"""

from __future__ import annotations

import json
import logging
import re
import threading
from pathlib import Path
from typing import Any

from app.models.scripts import (
    EXTENSION_KIND,
    KIND_EXTENSION,
    ScriptInfo,
    ScriptKind,
)

logger = logging.getLogger("pixtool.scripts")


SUPPORTED_EXTENSIONS = {".ps1", ".psm1", ".cmd", ".bat", ".sh", ".bash", ".py"}

#: Kütüphane taramasında yok sayılan isimler (üst veri dosyası vb.)
IGNORED_FILES = {".meta.json"}

#: Aynı anda yazmayı önlemek için kilit
_META_LOCK = threading.Lock()


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


# ----------------------------------------------------------------------
#  Üst veri (metadata) deposu
# ----------------------------------------------------------------------
def _meta_path() -> Path:
    return LIBRARY_ROOT / ".meta.json"


def load_meta() -> dict[str, dict[str, Any]]:
    """`.meta.json` içeriğini okur (yoksa boş sözlük)."""
    path = _meta_path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Üst veri okunamadı: %s", exc)
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): value for key, value in data.items() if isinstance(value, dict)}


def _save_meta(meta: dict[str, dict[str, Any]]) -> None:
    """`.meta.json` dosyasını yazar (atomik + kilitli)."""
    LIBRARY_ROOT.mkdir(parents=True, exist_ok=True)
    path = _meta_path()
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    temporary.replace(path)


def set_meta(script_id: str, patch: dict[str, Any]) -> None:
    """Tek bir scriptin üst verisini günceller (var olanlarla birleştirir)."""
    with _META_LOCK:
        meta = load_meta()
        entry = dict(meta.get(script_id, {}))
        for key, value in patch.items():
            if value is None:
                entry.pop(key, None)
            else:
                entry[key] = value
        if entry:
            meta[script_id] = entry
        else:
            meta.pop(script_id, None)
        _save_meta(meta)


def remove_meta(script_id: str) -> None:
    """Bir scriptin üst verisini siler."""
    with _META_LOCK:
        meta = load_meta()
        if meta.pop(script_id, None) is not None:
            _save_meta(meta)


def rename_meta(old_id: str, new_id: str) -> None:
    """Dosya adı değişince üst veriyi taşır."""
    with _META_LOCK:
        meta = load_meta()
        entry = meta.pop(old_id, None)
        if entry is not None:
            meta[new_id] = entry
            _save_meta(meta)


# ----------------------------------------------------------------------
#  Otomatik algılama
# ----------------------------------------------------------------------
def _detect_category(filename: str) -> str:
    """Dosya adı önekine göre kategori belirler."""
    for prefix, category in CATEGORY_PREFIXES:
        if filename.startswith(prefix):
            return category
    return "Genel"


def _detect_kind(path: Path) -> ScriptKind:
    """Uzantıya göre script tipini belirler."""
    return EXTENSION_KIND.get(path.suffix.lower(), "python")


def _kind_platform(kind: ScriptKind) -> str:
    """Tipe göre hedef platform."""
    return "windows" if kind in {"powershell", "cmd"} else "linux"


def _pretty_name(filename: str) -> str:
    """Dosya adını okunabilir bir başlığa çevirir."""
    stem = Path(filename).stem
    stem = NAME_CLEANUP.sub(" ", stem)
    return " ".join(stem.split())


def slugify(name: str) -> str:
    """
    Görünen addan güvenli bir dosya adı üretir.

    Türkçe karakterler sadeleştirilir; boşluklar `_` olur.
    """
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    slug = name.translate(table)
    slug = re.sub(r"[^\w\s-]", "", slug, flags=re.UNICODE)
    slug = re.sub(r"[\s-]+", "_", slug).strip("_")
    return slug[:80] or "script"


# ----------------------------------------------------------------------
#  Yorum bloğu çıkarımı
# ----------------------------------------------------------------------
def _extract_powershell_meta(content: str) -> dict[str, str | None]:
    """PowerShell yorum bloğundan açıklama / yazar / sürüm çıkarır."""
    result: dict[str, str | None] = {"description": "", "author": None, "version": None}

    for key in ("SYNOPSIS", "DESCRIPTION"):
        match = re.search(
            rf"\.{key}\s*\r?\n(?P<body>(?:[ \t]+\S.*\r?\n)+)",
            content,
            re.IGNORECASE,
        )
        if match:
            body = match.group("body")
            lines = [line.strip() for line in body.splitlines() if line.strip()]
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


def _extract_cmd_meta(content: str) -> dict[str, str | None]:
    """CMD/Bash başlık yorumundan (`REM` / `#`) açıklama çıkarır."""
    result: dict[str, str | None] = {"description": "", "author": None, "version": None}
    for line in content.splitlines()[:20]:
        stripped = line.strip()
        if not stripped:
            continue
        cleaned = re.sub(r"^(REM|::|#|//)\s*", "", stripped, flags=re.IGNORECASE).strip()
        if cleaned and cleaned != stripped:
            result["description"] = cleaned[:400]
            break
    return result


def _extract_meta(content: str, kind: ScriptKind) -> dict[str, str | None]:
    """Tipe uygun yorum çıkarıcıyı seçer."""
    if kind == "powershell":
        return _extract_powershell_meta(content)
    if kind == "python":
        return _extract_python_meta(content)
    return _extract_cmd_meta(content)


# ----------------------------------------------------------------------
#  Okuma
# ----------------------------------------------------------------------
def _read_script(
    path: Path,
    meta: dict[str, dict[str, Any]] | None = None,
) -> ScriptInfo:
    """Tek bir script dosyasını okur ve bilgilerini çıkarır."""
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("Script okunamadı: %s (%s)", path, exc)
        raw = ""

    entry = (meta or {}).get(path.name, {})
    auto_kind = _detect_kind(path)
    kind: ScriptKind = entry.get("type") or auto_kind

    # Elle girilen açıklama yorum bloğunu geçersiz kılar
    extracted = _extract_meta(raw, kind)
    description = entry.get("description") or extracted["description"] or ""

    return ScriptInfo(
        id=path.name,
        name=entry.get("name") or _pretty_name(path.name),
        description=description,
        category=entry.get("category") or _detect_category(path.name),
        platform=_kind_platform(kind),
        type=kind,
        extension=path.suffix,
        size_bytes=path.stat().st_size,
        lines=raw.count("\n") + (1 if raw else 0),
        author=extracted["author"],
        version=extracted["version"],
        customized=bool(entry),
    )


def _iter_scripts() -> list[Path]:
    """Kütüphanedeki desteklenen script dosyalarını listeler."""
    if not LIBRARY_ROOT.exists():
        return []

    found: list[Path] = []
    for path in sorted(LIBRARY_ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.name in IGNORED_FILES:
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        found.append(path)
    return found


def list_scripts() -> tuple[list[ScriptInfo], list[str], list[str]]:
    """
    Kütüphaneyi tarar.

    Returns:
        (script listesi, kategori listesi, tip listesi)
    """
    meta = load_meta()
    scripts: list[ScriptInfo] = []

    if not LIBRARY_ROOT.exists():
        logger.warning("Script kütüphanesi bulunamadı: %s", LIBRARY_ROOT)
        return scripts, [], []

    for path in _iter_scripts():
        scripts.append(_read_script(path, meta))

    categories = sorted({item.category for item in scripts})
    kinds = sorted({item.type for item in scripts})
    return scripts, categories, kinds


def find_script(script_id: str) -> Path | None:
    """
    Kimliğe göre script dosyasını bulur.

    ⚠️ Güvenlik: yalnızca kütüphane kökü içindeki dosyalar döndürülür
    (yol geçişi / path traversal engellenir).
    """
    if "/" in script_id or "\\" in script_id or ".." in script_id:
        logger.warning("Geçersiz script kimliği reddedildi: %r", script_id)
        return None

    for path in LIBRARY_ROOT.rglob(script_id):
        if not path.is_file():
            continue
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
    return _read_script(path, load_meta()), content


# ----------------------------------------------------------------------
#  Yazma — CRUD
# ----------------------------------------------------------------------
def _unique_path(folder: str, slug: str, extension: str) -> Path:
    """Çakışmayan bir hedef yol üretir (`ad`, `ad_2`, `ad_3`…)."""
    base = LIBRARY_ROOT / folder if folder else LIBRARY_ROOT
    base.mkdir(parents=True, exist_ok=True)

    candidate = base / f"{slug}{extension}"
    counter = 2
    while candidate.exists():
        candidate = base / f"{slug}_{counter}{extension}"
        counter += 1
    return candidate


def _sanitize_folder(folder: str) -> str:
    """Alt klasör adını güvenli hâle getirir (yalnızca tek seviye)."""
    if not folder:
        return ""
    cleaned = re.sub(r"[^\w\-]", "", folder.strip())
    return cleaned[:40]


def create_script(  # noqa: PLR0913
    *,
    name: str,
    kind: ScriptKind,
    category: str,
    description: str,
    content: str,
    folder: str = "",
) -> ScriptInfo:
    """
    Yeni bir script oluşturur.

    Dosya adı görünen addan üretilir; kategori ve tip `.meta.json`'a yazılır.
    """
    extension = KIND_EXTENSION.get(kind, ".ps1")
    safe_folder = _sanitize_folder(folder)
    slug = slugify(name)
    path = _unique_path(safe_folder, slug, extension)

    body = content
    if not body.strip():
        body = _starter_template(name, kind, description)

    path.write_text(body, encoding="utf-8")
    logger.info("Script oluşturuldu: %s", path)

    set_meta(
        path.name,
        {
            "name": name,
            "category": category or "Genel",
            "type": kind,
            "description": description or "",
        },
    )

    return _read_script(path, load_meta())


def _starter_template(name: str, kind: ScriptKind, description: str) -> str:
    """Boş içerik verilirse tipe uygun iskelet üretir."""
    note = description or name
    if kind == "powershell":
        return f"""<#
.SYNOPSIS
    {note}

.DESCRIPTION
    {note}
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "{name} çalışıyor..." -ForegroundColor Cyan

# TODO: komutlarınızı buraya yazın

Write-Host "Tamamlandı." -ForegroundColor Green
"""
    if kind == "cmd":
        return f"""@echo off
REM {note}
setlocal

echo {name} calisiyor...

REM TODO: komutlarinizi buraya yazin

endlocal
echo Tamamlandi.
"""
    if kind == "bash":
        return f"""#!/usr/bin/env bash
# {note}
set -euo pipefail

echo "{name} çalışıyor..."

# TODO: komutlarınızı buraya yazın

echo "Tamamlandı."
"""
    return f'''"""{note}"""

def main() -> None:
    print("{name} çalışıyor...")
    # TODO: kodunuzu buraya yazın


if __name__ == "__main__":
    main()
'''


def update_script(  # noqa: PLR0913
    script_id: str,
    *,
    name: str | None = None,
    kind: ScriptKind | None = None,
    category: str | None = None,
    description: str | None = None,
    content: str | None = None,
) -> ScriptInfo | None:
    """
    Var olan scripti günceller.

    Ad veya tip değişirse dosya **yeniden adlandırılır** (uzantı dahil).
    """
    path = find_script(script_id)
    if path is None:
        return None

    new_id = script_id

    # Ad veya tip değiştiyse dosyayı yeniden adlandır
    if name is not None or kind is not None:
        current_meta = load_meta().get(script_id, {})
        current_kind: ScriptKind = current_meta.get("type") or _detect_kind(path)
        resolved_kind = kind or current_kind
        resolved_name = name or current_meta.get("name") or _pretty_name(path.name)

        extension = KIND_EXTENSION.get(resolved_kind, path.suffix)
        slug = slugify(resolved_name)

        if f"{slug}{extension}" != path.name:
            target = _unique_path(path.parent.name, slug, extension)
            path.replace(target)
            logger.info("Script yeniden adlandırıldı: %s → %s", script_id, target.name)

            with _META_LOCK:
                meta = load_meta()
                entry = meta.pop(script_id, None)
                if entry is not None:
                    meta[target.name] = entry
                    _save_meta(meta)

            path = target
            new_id = target.name

    # İçeriği güncelle
    if content is not None:
        path.write_text(content, encoding="utf-8")

    # Üst veriyi güncelle
    patch: dict[str, Any] = {}
    if name is not None:
        patch["name"] = name
    if kind is not None:
        patch["type"] = kind
    if category is not None:
        patch["category"] = category or "Genel"
    if description is not None:
        patch["description"] = description
    if patch:
        set_meta(new_id, patch)

    return _read_script(path, load_meta())


def delete_script(script_id: str) -> bool:
    """Scripti ve üst verisini siler."""
    path = find_script(script_id)
    if path is None:
        return False

    try:
        path.unlink()
    except OSError as exc:
        logger.error("Script silinemedi: %s (%s)", path, exc)
        return False

    remove_meta(script_id)
    logger.info("Script silindi: %s", script_id)
    return True


def library_stats() -> dict[str, Any]:
    """Kütüphane özeti (arayüz başlığı için)."""
    scripts, categories, kinds = list_scripts()
    return {
        "root": str(LIBRARY_ROOT),
        "count": len(scripts),
        "categories": categories,
        "kinds": kinds,
        "customized": sum(1 for item in scripts if item.customized),
        "bytes": sum(item.size_bytes for item in scripts),
    }


__all__ = [
    "LIBRARY_ROOT",
    "SUPPORTED_EXTENSIONS",
    "create_script",
    "delete_script",
    "find_script",
    "library_stats",
    "list_scripts",
    "load_meta",
    "read_script",
    "remove_meta",
    "rename_meta",
    "set_meta",
    "slugify",
    "update_script",
]
