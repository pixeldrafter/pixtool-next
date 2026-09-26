"""
Erişim uçları — yeni kullanıcı kaydı ve parola yenileme.

    POST /api/v1/access/register-request   → kayıt talebi oluştur + bildir
    POST /api/v1/access/forgot-request     → parola talebi oluştur + bildir
    GET  /api/v1/access/request/{id}       → talep durumu (arayüz yoklaması)
    POST /api/v1/access/callback           → n8n/Telegram kararı (imzalı)
    GET  /api/v1/access/requests           → son talepler (yalnızca yönetici)

Güvenlik
--------
• Talepler **yalnızca bekleyen** durumdayken kabul edilir; süresi geçenler
  otomatik `expired` olur (30 dakika).
• Karar uç noktası `N8N_WEBHOOK_SECRET` ile imzalanır — dışarıdan
  sahte onay üretilemez.
• Üretilen geçici parola **arayüze hiç gönderilmez**, yalnızca Telegram
  mesajında yöneticiye iletilir.
"""

from __future__ import annotations

import logging
import secrets
import string

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.core.passwords import hash_password
from app.integrations.nocodb import get_nocodb_client
from app.models.access import (
    AccessCallbackRequest,
    AccessDecisionResponse,
    AccessListResponse,
    AccessRequestResponse,
    ForgotRequestBody,
    RegisterRequestBody,
)
from app.services import access_service

logger = logging.getLogger("pixtool.access")

router = APIRouter(prefix="/api/v1/access", tags=["erişim"])

#: Geçici parola uzunluğu
TEMP_PASSWORD_LENGTH = 14

#: Karıştırılması kolay karakterler hariç (0/O, 1/l/I)
SAFE_ALPHABET = "".join(ch for ch in (string.ascii_letters + string.digits) if ch not in "0O1lI")

#: Türkçe/aksanlı harfleri ASCII karşılığına çevirir.
#  Kullanıcı adları dosya yolu, e-posta ve veritabanı anahtarı olarak
#  kullanılabildiği için ASCII'de kalmaları gerekir.
_TRANSLITERATION = str.maketrans(
    {
        "ç": "c",
        "Ç": "c",
        "ğ": "g",
        "Ğ": "g",
        "ı": "i",
        "İ": "i",
        "ö": "o",
        "Ö": "o",
        "ş": "s",
        "Ş": "s",
        "ü": "u",
        "Ü": "u",
        "â": "a",
        "Â": "a",
        "î": "i",
        "Î": "i",
        "û": "u",
        "Û": "u",
    }
)


def _generate_password(length: int = TEMP_PASSWORD_LENGTH) -> str:
    """Güçlü geçici parola üretir."""
    while True:
        candidate = "".join(secrets.choice(SAFE_ALPHABET) for _ in range(length))
        # En az bir büyük, bir küçük, bir rakam içermeli
        if (
            any(ch.islower() for ch in candidate)
            and any(ch.isupper() for ch in candidate)
            and any(ch.isdigit() for ch in candidate)
        ):
            return candidate


def _normalise_username(raw: str) -> str:
    """Kullanıcı adını sadeleştirir ve doğrular.

    Türkçe harfler ASCII karşılığına çevrilir (ö → o), ardından yalnızca
    harf, rakam ve `. _ -` kalır.
    """
    username = (raw or "").strip().translate(_TRANSLITERATION).lower()
    username = "".join(ch for ch in username if ch.isascii() and (ch.isalnum() or ch in "._-"))
    username = username.strip("._-")
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Kullanıcı adı en az 3 karakter olmalı (harf, rakam, . _ -).",
        )
    if len(username) > 40:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Kullanıcı adı en fazla 40 karakter olabilir.",
        )
    return username


async def _user_exists(username: str) -> bool:
    """NocoDB'de kullanıcı var mı?"""
    if not (settings.nocodb_configured and settings.nocodb_table_users):
        return False

    client = get_nocodb_client()
    try:
        records = await client.list_records(
            settings.nocodb_table_users,
            limit=1,
            where=f"(Username,eq,{username})",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kullanıcı sorgusu başarısız: %s", exc)
        return False

    return bool(records)


# ----------------------------------------------------------------------
#  Talep oluşturma
# ----------------------------------------------------------------------


@router.post("/register-request", response_model=AccessRequestResponse)
async def register_request(payload: RegisterRequestBody) -> AccessRequestResponse:
    """Yeni kullanıcı kaydı talebi oluşturur ve yöneticiye bildirir."""
    username = _normalise_username(payload.username)

    if await _user_exists(username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{username}' kullanıcı adı zaten kayıtlı.",
        )

    request = access_service.create_request(
        kind="register",
        username=username,
        full_name=payload.full_name,
        email=payload.email,
        note=payload.note,
    )

    notified, channel = await access_service.notify(request)
    if not notified:
        access_service.mark_decision(
            request.id,
            approved=False,
            decided_by="system",
            message=f"Bildirim gönderilemedi: {channel}",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=("Talebin yöneticiye iletilemedi. Telegram/n8n yapılandırmasını kontrol edin."),
        )

    request.message = f"Talep {channel} üzerinden gönderildi."
    return AccessRequestResponse(ok=True, request=request.to_dict(), channel=channel)


@router.post("/forgot-request", response_model=AccessRequestResponse)
async def forgot_request(payload: ForgotRequestBody) -> AccessRequestResponse:
    """Parola yenileme talebi oluşturur ve yöneticiye bildirir."""
    username = _normalise_username(payload.username)

    # Var olmayan kullanıcı için de aynı cevabı ver (kullanıcı adı keşfini engelle)
    exists = await _user_exists(username)

    request = access_service.create_request(
        kind="forgot",
        username=username,
        note=payload.note or ("kullanıcı bulundu" if exists else "kullanıcı bulunamadı"),
    )

    notified, channel = await access_service.notify(request)
    if not notified:
        access_service.mark_decision(
            request.id,
            approved=False,
            decided_by="system",
            message=f"Bildirim gönderilemedi: {channel}",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Talebin yöneticiye iletilemedi. Telegram/n8n yapılandırmasını kontrol edin.",
        )

    return AccessRequestResponse(ok=True, request=request.to_dict(), channel=channel)


# ----------------------------------------------------------------------
#  Durum yoklaması
# ----------------------------------------------------------------------


@router.get("/request/{request_id}", response_model=AccessRequestResponse)
async def request_status(request_id: str) -> AccessRequestResponse:
    """Talebin güncel durumunu döndürür."""
    request = access_service.get_request(request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Talep bulunamadı.",
        )
    return AccessRequestResponse(ok=True, request=request.to_dict())


# ----------------------------------------------------------------------
#  Karar (n8n / Telegram)
# ----------------------------------------------------------------------


@router.post("/callback", response_model=AccessDecisionResponse)
async def decision_callback(
    payload: AccessCallbackRequest,
    x_pixtool_secret: str | None = Header(default=None),
) -> AccessDecisionResponse:
    """
    n8n'in Telegram butonuna basıldığında çağırdığı uç.

    `N8N_WEBHOOK_SECRET` tanımlıysa `X-Pixtool-Secret` başlığı zorunludur.
    """
    if settings.n8n_webhook_secret and (
        not x_pixtool_secret
        or not secrets.compare_digest(x_pixtool_secret, settings.n8n_webhook_secret)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz webhook imzası.",
        )

    request = access_service.get_request(payload.request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Talep bulunamadı.",
        )

    return await _decide(request, payload.approve, payload.decided_by)


async def _decide(
    request: access_service.AccessRequest,
    approve: bool,
    decided_by: str,
) -> AccessDecisionResponse:
    """Talebe karar uygular (onay/red) — HTTP callback ve Telegram webhook ortak."""
    if request.status != "pending":
        return AccessDecisionResponse(
            ok=True,
            status=request.status,
            message=f"Talep zaten '{request.status}' durumunda.",
        )

    if request.expired:
        access_service.mark_decision(
            request.id, approved=False, decided_by="system", message="Süre doldu."
        )
        return AccessDecisionResponse(ok=True, status="expired", message="Talebin süresi dolmuş.")

    # --- Red ---
    if not approve:
        updated = access_service.mark_decision(
            request.id,
            approved=False,
            decided_by=decided_by,
            message="Yönetici reddetti.",
        )
        return AccessDecisionResponse(
            ok=True,
            status=updated.status if updated else "rejected",
            message="Talep reddedildi.",
        )

    # --- Onay ---
    temporary_password = _generate_password()

    # Parola yenileme: mevcut kullanıcının parolasını değiştir
    if request.kind == "forgot":
        ok, message = await _apply_password_change(request.username, temporary_password)
    # Yeni kayıt: kullanıcıyı oluştur
    else:
        ok, message = await _create_user(request, temporary_password)

    if not ok:
        access_service.mark_decision(
            request.id, approved=False, decided_by=decided_by, message=message
        )
        return AccessDecisionResponse(ok=False, status="failed", message=message)

    updated = access_service.mark_decision(
        request.id,
        approved=True,
        decided_by=decided_by,
        message=message,
        issued_password=temporary_password,
    )

    # Parolayı yöneticiye ayrıca ulaştır
    await _send_password(request.username, temporary_password, request.kind)

    return AccessDecisionResponse(
        ok=True,
        status=updated.status if updated else "approved",
        message=message,
    )


# ----------------------------------------------------------------------
#  Telegram webhook (buton kararları — n8n olmadan)
# ----------------------------------------------------------------------


def _telegram_api(method: str) -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}/{method}"


async def _telegram_answer(callback_query_id: str | None, text: str) -> None:
    """Butona basıldığında Telegram'daki yükleniyor göstergesini kapatır."""
    if not callback_query_id or not settings.telegram_bot_token:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                _telegram_api("answerCallbackQuery"),
                json={"callback_query_id": callback_query_id, "text": text[:180]},
            )
    except Exception:  # noqa: BLE001
        logger.warning("answerCallbackQuery gönderilemedi")


async def _telegram_edit(callback_query: dict, text: str) -> None:
    """Orijinal mesajı sonuçla günceller ve butonları kaldırır."""
    message = callback_query.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    message_id = message.get("message_id")
    if chat_id is None or message_id is None or not settings.telegram_bot_token:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                _telegram_api("editMessageText"),
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": text[:3500],
                    "reply_markup": {"inline_keyboard": []},
                },
            )
    except Exception:  # noqa: BLE001
        logger.warning("editMessageText gönderilemedi")


@router.post("/telegram-webhook")
async def telegram_webhook(
    update: dict,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    """
    Telegram bot webhook'u — satır içi buton (Onayla/Reddet) kararlarını işler.

    NocoDB/n8n gerektirmez. Bot webhook'u bu adrese ayarlanmalıdır
    (`setWebhook`). `TELEGRAM_WEBHOOK_SECRET` tanımlıysa gizli başlık doğrulanır.
    """
    if settings.telegram_webhook_secret and (
        not x_telegram_bot_api_secret_token
        or not secrets.compare_digest(
            x_telegram_bot_api_secret_token, settings.telegram_webhook_secret
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz Telegram webhook imzası.",
        )

    callback_query = update.get("callback_query")
    if not callback_query:
        return {"ok": True}

    data = str(callback_query.get("data") or "")
    parts = data.split(":")
    if len(parts) != 4 or parts[0] != "px":
        return {"ok": True}

    _, kind, action, request_id = parts
    request = access_service.get_request(request_id)
    if not request:
        await _telegram_answer(callback_query.get("id"), "Talep bulunamadı.")
        return {"ok": True}

    result = await _decide(request, action == "approve", decided_by="telegram")

    label = "✅ ONAYLANDI" if action == "approve" and result.ok else "❌ REDDEDİLDİ"
    decided_by = callback_query.get("from") or {}
    who = decided_by.get("username") or decided_by.get("first_name") or "yönetici"
    summary = (
        f"{label}\n\n"
        f"👤 {request.username}  ({kind})\n"
        f"{result.message}\n"
        f"👮 Karar: {who}"
    )
    await _telegram_answer(callback_query.get("id"), result.message)
    await _telegram_edit(callback_query, summary)

    return {"ok": True}


@router.post("/telegram-webhook/register")
async def telegram_webhook_register() -> dict:
    """Bot webhook'unu bu API'ye ayarlar (kurulumda bir kez çağrılır)."""
    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TELEGRAM_BOT_TOKEN tanımlı değil.",
        )
    base = (settings.web_base_url or settings.api_base_url or "").rstrip("/")
    if not base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WEB_BASE_URL/API_BASE_URL tanımlı değil.",
        )
    url = f"{base}/api/v1/access/telegram-webhook"
    body: dict[str, object] = {"url": url, "allowed_updates": ["callback_query"]}
    if settings.telegram_webhook_secret:
        body["secret_token"] = settings.telegram_webhook_secret
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(_telegram_api("setWebhook"), json=body)
        return {"ok": response.is_success, "url": url, "telegram": response.json()}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"setWebhook başarısız: {exc}",
        ) from exc


# ----------------------------------------------------------------------
#  Karar uygulama yardımcıları
# ----------------------------------------------------------------------


async def _create_user(request: access_service.AccessRequest, password: str) -> tuple[bool, str]:
    """Onaylanan kayıt talebi için NocoDB'ye kullanıcı ekler."""
    if not (settings.nocodb_configured and settings.nocodb_table_users):
        return False, "NocoDB yapılandırılmamış — kullanıcı oluşturulamadı."

    client = get_nocodb_client()
    record = {
        "Username": request.username,
        "PasswordHash": hash_password(password),
        "Role": "user",
        "IsActive": True,
    }

    try:
        await client.insert_record(settings.nocodb_table_users, record)
    except Exception as exc:  # noqa: BLE001
        logger.error("Kullanıcı oluşturulamadı (%s): %s", request.username, exc)
        return False, f"Kullanıcı oluşturulamadı: {exc}"

    logger.info("Kullanıcı oluşturuldu: %s", request.username)
    return True, f"'{request.username}' kullanıcısı oluşturuldu."


async def _apply_password_change(username: str, password: str) -> tuple[bool, str]:
    """Parola yenileme talebini uygular."""
    if not (settings.nocodb_configured and settings.nocodb_table_users):
        return False, "NocoDB yapılandırılmamış."

    client = get_nocodb_client()
    try:
        records = await client.list_records(
            settings.nocodb_table_users,
            limit=1,
            where=f"(Username,eq,{username})",
        )
    except Exception as exc:  # noqa: BLE001
        return False, f"Kullanıcı sorgulanamadı: {exc}"

    if not records:
        return False, f"'{username}' kullanıcısı bulunamadı."

    record_id = records[0].get("Id") or records[0].get("id")
    if record_id is None:
        return False, "Kullanıcı kaydında kimlik bulunamadı."

    try:
        await client.update_record(
            settings.nocodb_table_users, record_id, {"PasswordHash": hash_password(password)}
        )
    except Exception as exc:  # noqa: BLE001
        return False, f"Parola güncellenemedi: {exc}"

    return True, f"'{username}' parolası yenilendi."


async def _send_password(username: str, password: str, kind: str) -> None:
    """Üretilen geçici parolayı yöneticiye Telegram'dan yollar."""
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        return

    title = "✅ Hesap oluşturuldu" if kind == "register" else "🔑 Parola yenilendi"
    text = (
        f"{title}\n\n"
        f"👤 Kullanıcı : {username}\n"
        f"🔑 Geçici parola : {password}\n\n"
        "Kullanıcı ilk girişte bu parolayı kullanmalı ve değiştirmelidir."
    )

    import httpx

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Geçici parola gönderilemedi: %s", exc)


# ----------------------------------------------------------------------
#  Yönetici listesi
# ----------------------------------------------------------------------


@router.get("/requests", response_model=AccessListResponse)
async def list_requests(limit: int = 40) -> AccessListResponse:
    """Son erişim taleplerini listeler."""
    requests = access_service.list_requests(limit=min(max(limit, 1), 200))
    return AccessListResponse(
        ok=True,
        count=len(requests),
        requests=[item.to_dict() for item in requests],
    )
