"""
Uygulama ayarları.

Tüm ayarlar proje kökündeki `.env` dosyasından okunur. `.env` **git'e girmez**;
şablon için `.env.example` dosyasına bakın.

Kullanım:
    from app.core.config import settings
    print(settings.nocodb_base_url)
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_project_root() -> Path:
    """
    Proje kökünü bulur.

    İki farklı yerleşim desteklenir:
      • Yerel geliştirme : `<kök>/services/api/app/core/config.py`
      • Sunucu kurulumu  : `/opt/pixtool/api/app/core/config.py`

    Bu yüzden önce **`.env` dosyası** yukarı doğru aranır (her iki düzende de
    api klasörünün içinde ya da kökte bulunur), sonra `pnpm-workspace.yaml`.
    """
    here = Path(__file__).resolve()

    for parent in here.parents:
        if (parent / ".env").exists():
            return parent

    for parent in here.parents:
        if (parent / "pnpm-workspace.yaml").exists():
            return parent

    return here.parents[4]


PROJECT_ROOT: Path = _find_project_root()
ENV_FILE: Path = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Uygulama yapılandırması — `.env` dosyasından yüklenir."""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- 1) Uygulama ---
    app_name: str = "Pixtool Next"
    app_env: str = "development"
    app_lang: str = "tr"
    app_version: str = "0.1.0"
    debug: bool = True

    # --- 2) Backend API ---
    api_base_url: str = "http://127.0.0.1:8000"
    api_port: int = 8000
    api_secret_key: str = ""
    #: CORS — izinli kökenler (virgülle ayrılır).
    #:
    #: ⚠️ Masaüstü kabuğu (Tauri) `tauri.localhost` kökeninden istek atar;
    #: bu köken listede yoksa **tüm API çağrıları CORS ile reddedilir** ve
    #: arayüz "Sunucuya ulaşılamadı" der. `allow_credentials=True` olduğu
    #: için joker (`*`) kullanılamaz — kökenler açıkça yazılmalıdır.
    api_allowed_origins: str = (
        # Geliştirme (Vite)
        "http://localhost:5173,http://127.0.0.1:5173,"
        # Tauri masaüstü kabuğu
        "http://tauri.localhost,https://tauri.localhost,tauri://localhost,"
        # Tauri dev sunucusu (varsayılan port)
        "http://localhost:1420,http://127.0.0.1:1420"
    )

    # --- 3) Web arayüz ---
    web_base_url: str = "http://127.0.0.1:5173"

    # --- 4) NocoDB ---
    nocodb_base_url: str = ""
    nocodb_api_token: str = ""
    nocodb_base_id: str = ""
    nocodb_table_users: str = ""
    nocodb_table_devices: str = ""
    nocodb_table_scripts: str = ""
    nocodb_table_resources: str = ""
    nocodb_table_logs: str = ""
    nocodb_table_settings: str = ""

    # --- 5) n8n ---
    n8n_base_url: str = ""
    n8n_login_webhook: str = ""
    n8n_register_webhook: str = ""
    n8n_webhook_secret: str = ""

    # --- 6) Telegram ---
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # --- 7) Yerel köprü ---
    bridge_host: str = "127.0.0.1"
    bridge_port: int = 8765
    bridge_token: str = ""

    # --- 8) Veritabanı seçimi ---
    db_adapter: str = "nocodb"
    sqlite_path: str = "./data/pixtool.db"

    # --- 9) SSH ---
    ssh_default_host: str = ""
    ssh_default_user: str = ""
    ssh_default_port: int = 22
    #: SSH parolası (yalnızca `.env` içinde; git'e GİRMEZ).
    #: Tercih edilen yöntem **anahtar kimlik doğrulamasıdır** —
    #: parola boşsa servis `~/.ssh` anahtarlarını ve agent'ı dener.
    ssh_default_password: str = ""

    # --- 10) Komut politikası ---
    command_policy: str = "confirm"

    # --- 11) Hedef platformlar ---
    supported_windows: str = "10,11"
    supported_linux: str = "ubuntu,debian"

    # --- 12) Kimlik doğrulama ---
    #: Demo kullanıcı (yalnızca APP_ENV != production iken ve n8n
    #: yapılandırılmamışken kullanılır)
    auth_demo_user: str = "admin"
    auth_demo_password: str = "pixtool"
    #: OTP kod uzunluğu
    auth_otp_length: int = 6
    #: Ceza ekranından önceki yanlış deneme hakkı
    auth_otp_max_attempts: int = 3

    # ------------------------------------------------------------------
    #  Türetilmiş / yardımcı alanlar
    # ------------------------------------------------------------------
    @property
    def allowed_origins(self) -> list[str]:
        """CORS için izinli kaynak listesi."""
        return [o.strip() for o in self.api_allowed_origins.split(",") if o.strip()]

    @property
    def nocodb_configured(self) -> bool:
        """NocoDB ayarları eksiksiz mi?"""
        return bool(self.nocodb_base_url and self.nocodb_api_token)

    @property
    def nocodb_is_placeholder(self) -> bool:
        """
        NocoDB adresi hâlâ şablon değer mi?

        Devir dokümanındaki `senin-domainin.com` gibi değerleri yakalar ki
        yanlışlıkla gerçek sanılmasın.
        """
        if not self.nocodb_base_url:
            return True
        lowered = self.nocodb_base_url.lower()
        markers = ("senin-domainin", "your-domain", "example.com", "changeme", "<", "xxxx")
        return any(m in lowered for m in markers)

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    """Ayarları (önbelleğe alarak) döndürür."""
    return Settings()


settings: Settings = get_settings()
