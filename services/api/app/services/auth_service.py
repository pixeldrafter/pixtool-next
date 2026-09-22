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

from app.core.config import settings
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

    @property
    def expired(self) -> bool:
        return time.time() - self.created_at > CHALLENGE_TTL_SECONDS


class AuthService:
    """Bellek içi kimlik doğrulama servisi."""

    def __init__(self) -> None:
        self._challenges: dict[str, Challenge] = {}

    # ------------------------------------------------------------------
    #  Yapılandırma durumu
    # ------------------------------------------------------------------
    @property
    def demo_mode(self) -> bool:
        """
        Demo kipi aktif mi?

        Gerçek OTP kanalı (n8n webhook) yapılandırılmamışsa VE üretimde
        değilsek demo kipi açıktır.
        """
        if settings.is_production:
            return False
        return not bool(settings.n8n_login_webhook and settings.n8n_base_url)

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

        # NocoDB tabanlı doğrulama Faz 2'de eklenecek
        logger.warning(
            "Gerçek kimlik doğrulama henüz kurulmadı (NocoDB users tablosu yok). "
            "Şimdilik reddediliyor: %s",
            username,
        )
        return False, "Kimlik doğrulama kaynağı yapılandırılmamış."

    # ------------------------------------------------------------------
    #  OTP meydan okuması
    # ------------------------------------------------------------------
    def create_challenge(self, username: str) -> Challenge:
        """Yeni OTP meydan okuması üretir ve kaydeder."""
        self._purge_expired()

        challenge_id = generate_id(18)  # rastgele, tahmin edilemez kimlik
        code = generate_otp(settings.auth_otp_length)

        challenge = Challenge(
            challenge_id=challenge_id,
            username=username,
            code=code,
            attempts_left=settings.auth_otp_max_attempts,
        )
        self._challenges[challenge_id] = challenge

        if self.demo_mode:
            logger.info(
                "OTP üretildi (demo) — kullanıcı=%s kod=%s", username, code
            )
        else:
            logger.info("OTP üretildi — kullanıcı=%s kanal=%s", username, self.otp_channel)

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
