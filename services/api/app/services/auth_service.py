"""
Kimlik doğrulama servisi.

Akış:
    1. `authenticate(username, password)` → şifre doğruysa OTP meydan okuması üretir
    2. `verify_otp(challenge_id, code)`   → kodu doğrular, başarılıysa oturum tokenı
    3. `resend_otp(challenge_id)`         → yeni kod üretir

**Demo kipi:** NocoDB/n8n/Telegram yapılandırılmamışken sistem demo kullanıcısıyla
çalışır ve OTP yanıtta `dev_otp` alanında döner. Üretimde (`APP_ENV=production`)
bu davranış otomatik olarak kapanır — kullanıcı gerçek entegrasyonu kurmak zorundadır.

Meydan okumalar **bellekte** tutulur (Faz 1). Çok örnekli dağıtımda Redis'e
taşınmalıdır — bkz. docs/ACIK-KONULAR.md.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings
from app.core.passwords import hash_password, needs_rehash, verify_password
from app.core.security import (
    constant_time_equals,
    create_token,
    generate_id,
    generate_otp,
)

logger = logging.getLogger("pixtool.auth")

#: Meydan okuma ömrü (saniye) — 5 dakika
CHALLENGE_TTL_SECONDS = 5 * 60


@dataclass
class Challenge:
    """Bekleyen bir OTP meydan okuması."""

    challenge_id: str
    username: str
    code: str
    attempts_left: int
    created_at: float = field(default_factory=time.time)
    #: Gönderim başarılı mı (demo kipinde her zaman True)
    send_ok: bool = True
    #: Gönderim sonucu açıklaması
    send_message: str = ""

    @property
    def expired(self) -> bool:
        return time.time() - self.created_at > CHALLENGE_TTL_SECONDS


class AuthService:
    """Bellek içi kimlik doğrulama servisi."""

    def __init__(self) -> None:
        self._challenges: dict[str, Challenge] = {}

    # ------------------------------------------------------------------
    #  NocoDB kullanıcı sorgusu
    # ------------------------------------------------------------------
    def _nocodb_find_user(self, username: str) -> tuple[dict[str, Any] | None, str]:
        """
        NocoDB `Users` tablosundan kullanıcıyı bulur.

        Returns:
            (kayıt, mesaj). Kayıt `None` ise mesaj hata nedenini açıklar.
        """
        table = settings.nocodb_table_users
        if not settings.nocodb_configured or not table:
            return None, "Kimlik doğrulama kaynağı yapılandırılmamış."

        # NocoDB `where` söz dizimi: (Alan,eq,değer)
        escaped = username.replace("(", "").replace(")", "").replace(",", "")
        where = f"(Username,eq,{escaped})"

        try:
            with httpx.Client(
                base_url=settings.nocodb_base_url.rstrip("/"),
                headers={"xc-token": settings.nocodb_api_token},
                timeout=12.0,
                follow_redirects=True,
            ) as client:
                response = client.get(
                    f"/api/v2/tables/{table}/records",
                    params={"limit": 1, "where": where},
                )
                response.raise_for_status()
                records = response.json().get("list") or []
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("NocoDB kullanıcı sorgusu başarısız: %s", exc)
            return None, "Kimlik doğrulama servisine ulaşılamadı."

        if not records:
            return None, "Kullanıcı adı veya parola hatalı."

        return records[0], ""

    @staticmethod
    def _is_expired(record: dict[str, Any]) -> bool:
        """`ExpirationDate` alanı geçmişte mi?"""
        raw = record.get("ExpirationDate")
        if not raw:
            return False
        try:
            text = str(raw).replace("Z", "+00:00")
            moment = datetime.fromisoformat(text)
            if moment.tzinfo is None:
                moment = moment.replace(tzinfo=UTC)
            return moment < datetime.now(UTC)
        except (ValueError, TypeError):
            return False

    def _upgrade_hash(self, record: dict[str, Any], password: str) -> None:
        """
        Düz metin/eski hash'i PBKDF2'ye yükseltir (sessizce, hata yutulur).

        NocoDB kaydındaki `PasswordHash` alanı güncellenir.
        """
        table = settings.nocodb_table_users
        record_id = record.get("Id")
        if not table or record_id is None:
            return
        try:
            with httpx.Client(
                base_url=settings.nocodb_base_url.rstrip("/"),
                headers={
                    "xc-token": settings.nocodb_api_token,
                    "Content-Type": "application/json",
                },
                timeout=12.0,
                follow_redirects=True,
            ) as client:
                client.patch(
                    f"/api/v2/tables/{table}/records",
                    json={"Id": record_id, "PasswordHash": hash_password(password)},
                )
            logger.info(
                "Parola hash'i PBKDF2'ye yükseltildi (kullanıcı=%s)", record.get("Username")
            )
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Hash yükseltilemedi: %s", exc)

    def user_chat_id(self, username: str) -> str | None:
        """Kullanıcının NocoDB'de kayıtlı Telegram sohbet kimliği."""
        record, _ = self._nocodb_find_user(username)
        if not record:
            return None
        value = record.get("TelegramChatId")
        return str(value).strip() if value else None

    # ------------------------------------------------------------------
    #  Yapılandırma durumu
    # ------------------------------------------------------------------
    @property
    def demo_mode(self) -> bool:
        """
        Demo kipi aktif mi?

        Gerçek bir kimlik kaynağı yoksa VE üretimde değilsek demo kipi açıktır.

        Kimlik kaynağı sayılanlar:
          • NocoDB `Users` tablosu (yapılandırılmışsa)
          • n8n webhook (OTP kanalı)

        İkisi de yoksa demo kullanıcısı devreye girer.
        """
        if settings.is_production:
            return False

        has_nocodb = settings.nocodb_configured and bool(settings.nocodb_table_users)
        has_n8n = bool(settings.n8n_login_webhook and settings.n8n_base_url)
        return not (has_nocodb or has_n8n)

    @property
    def otp_channel(self) -> str:
        """OTP'nin gönderileceği kanal adı."""
        if settings.telegram_bot_token and settings.n8n_base_url:
            return "telegram"
        if settings.n8n_login_webhook:
            return "n8n"
        return "totp"

    # ------------------------------------------------------------------
    #  Şifre kontrolü
    # ------------------------------------------------------------------
    def authenticate(self, username: str, password: str) -> tuple[bool, str]:
        """
        Kullanıcı adı/şifre kontrolü.

        Returns:
            (başarılı, mesaj). Faz 1'de kimlik kaynağı:
              • demo kipi  → `.env` içindeki `AUTH_DEMO_USER` / `AUTH_DEMO_PASSWORD`
              • üretim     → NocoDB `users` tablosu (Faz 2)
        """
        if self.demo_mode:
            expected_user = settings.auth_demo_user
            expected_pass = settings.auth_demo_password
            if constant_time_equals(username, expected_user) and constant_time_equals(
                password, expected_pass
            ):
                return True, "Demo girişi başarılı."
            return False, "Kullanıcı adı veya parola hatalı."

        # --- Gerçek doğrulama: NocoDB `Users` tablosu ---
        record, message = self._nocodb_find_user(username)
        if record is None:
            return False, message

        # Hesap etkin mi?
        active = record.get("IsActive")
        if active is not None and not active:
            logger.info("Devre dışı hesap reddedildi: %s", username)
            return False, "Hesap devre dışı bırakılmış."

        # Süresi dolmuş mu?
        if self._is_expired(record):
            logger.info("Süresi dolmuş hesap reddedildi: %s", username)
            return False, "Hesabın kullanım süresi dolmuş."

        stored = record.get("PasswordHash")
        if not verify_password(password, stored):
            logger.warning("Hatalı parola denemesi: %s", username)
            return False, "Kullanıcı adı veya parola hatalı."

        # Düz metin/eski hash ise yükselt (arka planda, girişi etkilemez)
        if needs_rehash(stored):
            self._upgrade_hash(record, password)

        logger.info("Giriş başarılı: %s (%s)", username, record.get("Role") or "-")
        return True, "Giriş başarılı."

    # ------------------------------------------------------------------
    #  OTP gönderimi (n8n → Telegram)
    # ------------------------------------------------------------------
    def _request_otp(self, username: str) -> tuple[str | None, str]:
        """
        n8n'den OTP ister (n8n → Telegram).

        **Önemli:** n8n iş akışı OTP'yi **kendisi üretir**, Telegram'a gönderir
        ve yanıtta `{"otp": "123456"}` döndürür. API bu kodu saklayıp
        kullanıcının girdiği kodla karşılaştırır — böylece gönderilen kod ile
        doğrulanan kod **aynı** olur.

        Returns:
            (kod, mesaj). Kod `None` ise gönderim başarısız.
        """
        webhook = settings.n8n_login_webhook
        if not webhook:
            return None, "OTP kanalı yapılandırılmamış."

        chat_id = self.user_chat_id(username) or settings.telegram_chat_id

        payload: dict[str, Any] = {
            "username": username,
            "chat_id": chat_id or "",
            "channel": self.otp_channel,
            "ttl": CHALLENGE_TTL_SECONDS,
            "app": "Pixtool Next",
        }

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.n8n_webhook_secret:
            headers["X-Pixtool-Secret"] = settings.n8n_webhook_secret

        try:
            with httpx.Client(timeout=25.0, follow_redirects=True) as client:
                response = client.post(webhook, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("n8n webhook'a ulaşılamadı: %s", exc)
            return None, "Doğrulama servisine ulaşılamadı."

        if response.status_code >= 400:
            logger.warning(
                "n8n webhook hatası (HTTP %s): %s",
                response.status_code,
                response.text[:200],
            )
            return None, "Doğrulama kodu gönderilemedi."

        # n8n ürettiği kodu döndürür
        code: str | None = None
        try:
            body = response.json()
            if isinstance(body, dict):
                raw = body.get("otp") or body.get("code")
                if raw is not None:
                    code = str(raw).strip()
        except ValueError:
            logger.warning("n8n yanıtı JSON değil: %s", response.text[:120])

        if code and code.isdigit():
            logger.info(
                "OTP n8n üzerinden gönderildi — kullanıcı=%s kanal=%s",
                username,
                self.otp_channel,
            )
            return code, "Doğrulama kodu gönderildi."

        logger.warning("n8n kod döndürmedi — yerel kod kullanılacak")
        return None, "Doğrulama kodu gönderildi."

    # ------------------------------------------------------------------
    #  OTP meydan okuması
    # ------------------------------------------------------------------
    def create_challenge(self, username: str) -> Challenge:
        """
        Yeni OTP meydan okuması üretir, kaydeder ve gönderir.

        Meydan okuma **her durumda** kaydedilir; gönderim başarısız olursa
        çağıran taraf `send_ok=False` görür ve kullanıcıya bildirir.
        """
        self._purge_expired()

        challenge_id = generate_id(18)  # rastgele, tahmin edilemez kimlik
        local_code = generate_otp(settings.auth_otp_length)

        send_ok = True
        send_message = ""
        code = local_code

        if self.demo_mode:
            logger.info("OTP üretildi (demo) — kullanıcı=%s kod=%s", username, local_code)
            send_message = "Demo kipi — kod ekranda gösteriliyor."
        else:
            # n8n kodu üretip Telegram'a gönderir ve kodu döndürür
            remote_code, send_message = self._request_otp(username)
            if remote_code:
                code = remote_code
            else:
                # n8n erişilemezse yerel kodu kullan (yine de doğrulanabilir)
                send_ok = False
                logger.error(
                    "OTP gönderilemedi — kullanıcı=%s: %s (yerel kod kullanılıyor)",
                    username,
                    send_message,
                )

        challenge = Challenge(
            challenge_id=challenge_id,
            username=username,
            code=code,
            attempts_left=settings.auth_otp_max_attempts,
            send_ok=send_ok,
            send_message=send_message,
        )
        self._challenges[challenge_id] = challenge

        return challenge

    def verify_otp(self, challenge_id: str, code: str) -> tuple[bool, str, int, str | None]:
        """
        OTP kodunu doğrular.

        Returns:
            (başarılı, mesaj, kalan_deneme, kullanıcı_adı)
            Doğrulama başarısızsa kullanıcı adı `None` olur.
        """
        self._purge_expired()

        challenge = self._challenges.get(challenge_id)
        if challenge is None:
            return False, "Doğrulama oturumu bulunamadı veya süresi doldu.", 0, None

        if challenge.expired:
            self._challenges.pop(challenge_id, None)
            return False, "Kodun süresi doldu. Yeni kod isteyin.", 0, None

        username = challenge.username

        if constant_time_equals(challenge.code, code.strip()):
            self._challenges.pop(challenge_id, None)
            return True, "Doğrulama başarılı.", challenge.attempts_left, username

        challenge.attempts_left -= 1

        if challenge.attempts_left <= 0:
            self._challenges.pop(challenge_id, None)
            return (
                False,
                "Çok fazla yanlış deneme. Erişim geçici olarak kilitlendi.",
                0,
                None,
            )

        return (
            False,
            f"Kod hatalı. {challenge.attempts_left} deneme hakkın kaldı.",
            challenge.attempts_left,
            None,
        )

    def resend_otp(self, challenge_id: str) -> Challenge | None:
        """Aynı kullanıcı için yeni kod üretir."""
        challenge = self._challenges.get(challenge_id)
        if challenge is None:
            return None

        challenge.code = generate_otp(settings.auth_otp_length)
        challenge.attempts_left = settings.auth_otp_max_attempts
        challenge.created_at = time.time()

        if self.demo_mode:
            logger.info("OTP yeniden üretildi (demo) — kod=%s", challenge.code)

        return challenge

    # ------------------------------------------------------------------
    #  Oturum
    # ------------------------------------------------------------------
    def issue_token(self, username: str) -> str:
        """Oturum tokenı üretir."""
        return create_token(username)

    # ------------------------------------------------------------------
    #  İç yardımcılar
    # ------------------------------------------------------------------
    def _purge_expired(self) -> None:
        """Süresi dolmuş meydan okumaları temizler."""
        expired = [key for key, value in self._challenges.items() if value.expired]
        for key in expired:
            self._challenges.pop(key, None)

    def reset(self) -> None:
        """Tüm meydan okumaları siler (testler için)."""
        self._challenges.clear()


#: Uygulama genelinde tek örnek
auth_service = AuthService()
