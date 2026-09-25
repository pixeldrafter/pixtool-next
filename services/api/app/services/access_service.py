"""
Erişim talepleri — yeni kullanıcı kaydı ve parola yenileme.

Akış
----
1. Arayüz `POST /api/v1/access/register-request` gönderir.
2. API talebi **diskte** saklar (`data/access_requests.json`) ve n8n webhook'una
   iletir.
3. n8n, Telegram'a **satır içi butonlu** mesaj atar (Onayla / Reddet).
4. Yönetici butona basar → n8n `POST /api/v1/access/callback` çağırır.
5. API kararı uygular: onayda kullanıcıyı NocoDB'ye ekler, redde kaydı işaretler.
6. Arayüz `GET /api/v1/access/request/{id}` ile durumu **yoklar**.

Neden n8n?  Telegram buton etkileşimi ve yönetici bildirimi tek yerde toplanır;
API yalnızca talebi saklar ve kararı uygular. n8n yapılandırılmamışsa API
**doğrudan Telegram Bot API**'sini kullanır (yedek yol).
"""

from __future__ import annotations

import json
import logging
import secrets
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

import httpx

from app.core.config import settings

logger = logging.getLogger("pixtool.access")

#: Talep türü
AccessKind = Literal["register", "forgot"]

#: Talep durumu
AccessStatus = Literal["pending", "approved", "rejected", "expired", "failed"]

#: Talebin geçerlilik süresi (saniye) — 30 dakika
REQUEST_TTL_SECONDS = 30 * 60

#: Veri dosyası
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_STORE_PATH = _DATA_DIR / "access_requests.json"

#: Dosya erişimi için kilit (uvicorn tek işçi ama yine de güvenli olsun)
_LOCK = threading.Lock()


@dataclass
class AccessRequest:
    """Tek bir erişim talebi."""

    id: str
    kind: AccessKind
    status: AccessStatus
    username: str
    full_name: str = ""
    email: str = ""
    note: str = ""
    #: Kullanıcıya gösterilecek mesaj
    message: str = ""
    created_at: float = field(default_factory=time.time)
    decided_at: float | None = None
    decided_by: str = ""
    #: Onaylandıysa üretilen geçici parola (yalnızca yöneticiye gönderilir)
    issued_password: str = ""

    @property
    def expired(self) -> bool:
        return time.time() - self.created_at > REQUEST_TTL_SECONDS

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["expired"] = self.expired
        # Geçici parolayı arayüze sızdırma
        payload.pop("issued_password", None)
        return payload


# ----------------------------------------------------------------------
#  Disk deposu
# ----------------------------------------------------------------------


def _load() -> dict[str, dict[str, Any]]:
    """Talepleri diskten okur."""
    if not _STORE_PATH.exists():
        return {}
    try:
        data = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError) as exc:
        logger.warning("Erişim talepleri okunamadı: %s", exc)
        return {}


def _save(store: dict[str, dict[str, Any]]) -> None:
    """Talepleri diske yazar (atomik)."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp = _STORE_PATH.with_suffix(".json.tmp")
    try:
        temp.write_text(
            json.dumps(store, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        temp.replace(_STORE_PATH)
    except OSError as exc:
        logger.error("Erişim talepleri yazılamadı: %s", exc)


def _prune(store: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Süresi geçmiş talepleri temizler (son 200 kayıt tutulur)."""
    now = time.time()
    alive: dict[str, dict[str, Any]] = {}

    for key, value in store.items():
        age = now - float(value.get("created_at") or 0)
        status = value.get("status")
        # Bekleyen ve süresi geçmiş → expired
        if status == "pending" and age > REQUEST_TTL_SECONDS:
            value["status"] = "expired"
        # 7 günden eski karara bağlanmış kayıtları at
        if age < 7 * 24 * 3600:
            alive[key] = value

    # En yeni 200 kayıt
    if len(alive) > 200:
        ordered = sorted(
            alive.items(), key=lambda item: item[1].get("created_at") or 0, reverse=True
        )
        alive = dict(ordered[:200])

    return alive


def _read_request(request_id: str) -> AccessRequest | None:
    """Tek talebi okur."""
    with _LOCK:
        store = _load()
        raw = store.get(request_id)
    if not raw:
        return None
    return AccessRequest(
        **{k: v for k, v in raw.items() if k in AccessRequest.__dataclass_fields__}
    )


# ----------------------------------------------------------------------
#  Bildirim
# ----------------------------------------------------------------------


def _telegram_keyboard(request_id: str, kind: AccessKind) -> dict[str, Any]:
    """Telegram satır içi buton takımı."""
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Onayla", "callback_data": f"px:{kind}:approve:{request_id}"},
                {"text": "❌ Reddet", "callback_data": f"px:{kind}:reject:{request_id}"},
            ]
        ]
    }


def _telegram_text(request: AccessRequest) -> str:
    """Telegram mesaj gövdesi."""
    title = "🔐 YENİ KULLANICI KAYDI" if request.kind == "register" else "🔑 PAROLA YENİLEME TALEBİ"
    lines = [
        title,
        "",
        f"👤 Kullanıcı   : {request.username}",
    ]
    if request.full_name:
        lines.append(f"📛 Ad Soyad   : {request.full_name}")
    if request.email:
        lines.append(f"✉️  E-posta    : {request.email}")
    if request.note:
        lines.append(f"📝 Not        : {request.note}")
    lines += [
        "",
        f"🆔 Talep       : {request.id}",
        f"⏱  Zaman       : {time.strftime('%d.%m.%Y %H:%M', time.localtime(request.created_at))}",
        "",
        "Onaylarsan hesap oluşturulur. Reddedersen talep kapatılır.",
    ]
    return "\n".join(lines)


async def _notify_via_n8n(request: AccessRequest) -> tuple[bool, str]:
    """Talebi n8n webhook'una iletir (asıl yol)."""
    webhook = settings.n8n_register_webhook
    if not webhook:
        return False, "n8n webhook tanımlı değil"

    headers = {"Content-Type": "application/json"}
    if settings.n8n_webhook_secret:
        headers["X-Pixtool-Secret"] = settings.n8n_webhook_secret

    payload = {
        "requestId": request.id,
        "kind": request.kind,
        "username": request.username,
        "fullName": request.full_name,
        "email": request.email,
        "note": request.note,
        "text": _telegram_text(request),
        "keyboard": _telegram_keyboard(request.id, request.kind),
        "decidedBy": "n8n",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.post(webhook, json=payload, headers=headers)
        if response.status_code >= 400:
            logger.warning("n8n kayıt webhook hatası (HTTP %s)", response.status_code)
            return False, f"n8n HTTP {response.status_code}"
        return True, "n8n"
    except Exception as exc:  # noqa: BLE001 — ağ hataları çeşitli
        logger.warning("n8n kayıt webhook'una ulaşılamadı: %s", exc)
        return False, str(exc)


async def _notify_via_telegram(request: AccessRequest) -> tuple[bool, str]:
    """Yedek yol: Telegram Bot API'sine doğrudan gönderir."""
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        return False, "Telegram yapılandırılmamış"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": _telegram_text(request),
        "reply_markup": _telegram_keyboard(request.id, request.kind),
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload)
        if response.status_code >= 400:
            logger.warning(
                "Telegram gönderimi başarısız (HTTP %s): %s",
                response.status_code,
                response.text[:200],
            )
            return False, f"Telegram HTTP {response.status_code}"
        return True, "telegram"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Telegram'a ulaşılamadı: %s", exc)
        return False, str(exc)


async def notify(request: AccessRequest) -> tuple[bool, str]:
    """
    Talebi yöneticiye bildirir.

    Mesaj **doğrudan Telegram Bot API'si** üzerinden gönderilir: satır içi
    butonlar (`reply_markup.inline_keyboard`) Telegram'ın belgelenmiş, kararlı
    yapısıdır — n8n düğüm parametrelerine bağımlı olmaktan kaçınırız.

    Butona basıldığında **n8n** devreye girer (Telegram tetikleyicisi) ve
    `POST /api/v1/access/callback` ucunu çağırır. Yani:

        API  → Telegram (mesaj + buton)
        n8n  ← Telegram (buton tıklaması)
        n8n  → API (karar)
    """
    return await _notify_via_telegram(request)


# ----------------------------------------------------------------------
#  Genel API
# ----------------------------------------------------------------------


def create_request(
    kind: AccessKind,
    username: str,
    full_name: str = "",
    email: str = "",
    note: str = "",
) -> AccessRequest:
    """Yeni talep oluşturur ve diske yazar."""
    request = AccessRequest(
        id=secrets.token_urlsafe(16),
        kind=kind,
        status="pending",
        username=username.strip(),
        full_name=full_name.strip(),
        email=email.strip(),
        note=note.strip(),
    )

    with _LOCK:
        store = _prune(_load())
        store[request.id] = asdict(request) | {"expired": False}
        _save(store)

    logger.info("Erişim talebi oluşturuldu: tür=%s kullanıcı=%s id=%s", kind, username, request.id)
    return request


def get_request(request_id: str) -> AccessRequest | None:
    """Talep durumunu döndürür (arayüz yoklaması)."""
    with _LOCK:
        store = _prune(_load())
        _save(store)
        raw = store.get(request_id)

    if not raw:
        return None

    request = AccessRequest(
        **{k: v for k, v in raw.items() if k in AccessRequest.__dataclass_fields__}
    )
    return request


def mark_decision(
    request_id: str,
    approved: bool,
    decided_by: str = "telegram",
    message: str = "",
    issued_password: str = "",
) -> AccessRequest | None:
    """Talebi karara bağlar."""
    with _LOCK:
        store = _load()
        raw = store.get(request_id)
        if not raw:
            return None

        raw["status"] = "approved" if approved else "rejected"
        raw["decided_at"] = time.time()
        raw["decided_by"] = decided_by
        raw["message"] = message
        raw["issued_password"] = issued_password
        store[request_id] = raw
        _save(store)

    logger.info("Talep karara bağlandı: id=%s onay=%s", request_id, approved)
    return get_request(request_id)


def list_requests(limit: int = 40) -> list[AccessRequest]:
    """Son talepleri listeler (yönetici görünümü)."""
    with _LOCK:
        store = _prune(_load())
        _save(store)

    ordered = sorted(store.values(), key=lambda item: item.get("created_at") or 0, reverse=True)
    return [
        AccessRequest(**{k: v for k, v in raw.items() if k in AccessRequest.__dataclass_fields__})
        for raw in ordered[:limit]
    ]


def reset() -> None:
    """Tüm talepleri siler (test)."""
    with _LOCK:
        _save({})
