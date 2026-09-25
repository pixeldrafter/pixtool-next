"""
Pixtool Next — backend API giriş noktası.

Çalıştırma:
    uvicorn app.main:app --reload --port 8000

Uç noktalar (Faz 0):
    GET /                 → servis kimliği
    GET /health           → canlılık kontrolü
    GET /api/v1/status    → yapılandırma + NocoDB bağlantı durumu
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import PROJECT_ROOT, settings
from app.integrations.nocodb import NocoDBClient
from app.routers.access import router as access_router
from app.routers.auth import router as auth_router
from app.routers.browser import router as browser_router
from app.routers.database import router as database_router
from app.routers.devices import router as devices_router
from app.routers.remote import router as remote_router
from app.routers.scripts import router as scripts_router
from app.routers.version import router as version_router
from app.services.script_service import LIBRARY_ROOT as SCRIPT_LIBRARY

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
logger = logging.getLogger("pixtool")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama açılış / kapanış işleri."""
    logger.info("=" * 66)
    logger.info("  %s  v%s  (%s)", settings.app_name, settings.app_version, settings.app_env)
    logger.info("  Proje kökü : %s", PROJECT_ROOT)
    logger.info("  NocoDB     : %s", settings.nocodb_base_url or "(ayarlanmamış)")
    if settings.nocodb_is_placeholder:
        logger.warning("  ⚠️  NocoDB adresi hâlâ ŞABLON değerde — .env doldurulmalı")
    logger.info("  Komut pol. : %s", settings.command_policy)
    if not settings.api_secret_key:
        logger.warning("  ⚠️  API_SECRET_KEY boş — geliştirme anahtarı kullanılıyor")
    logger.info("  Kimlik     : demo kullanıcı=%s", settings.auth_demo_user)
    logger.info("  Scriptler  : %s", SCRIPT_LIBRARY)
    logger.info("  SSH        : %s", settings.ssh_default_host or "(ayarlanmamış)")
    logger.info("=" * 66)
    yield
    logger.info("%s kapatılıyor.", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Pixtool Next — online uzak sistem yönetim paneli backend'i",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Uç nokta grupları ---
app.include_router(access_router)
app.include_router(browser_router)
app.include_router(auth_router)
app.include_router(database_router)
app.include_router(devices_router)
app.include_router(scripts_router)
app.include_router(remote_router)
app.include_router(version_router)


# ----------------------------------------------------------------------
#  Uç noktalar
# ----------------------------------------------------------------------
@app.get("/", tags=["genel"])
async def root() -> dict[str, Any]:
    """Servis kimliği."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "env": settings.app_env,
        "docs": "/docs",
    }


@app.get("/health", tags=["genel"])
async def health() -> dict[str, Any]:
    """Canlılık kontrolü — bağımlılık çağrısı yapmaz."""
    return {
        "status": "ok",
        "name": settings.app_name,
        "version": settings.app_version,
        "env": settings.app_env,
    }


@app.get("/api/v1/status", tags=["genel"])
async def status() -> dict[str, Any]:
    """
    Detaylı durum: yapılandırma özeti + NocoDB bağlantı testi.

    Arayüz açılışta bu uç noktayı çağırıp bağlantı durumunu gösterir.
    """
    nocodb = await NocoDBClient().ping()

    warnings: list[str] = []
    if nocodb.placeholder:
        warnings.append("NocoDB adresi şablon değer — .env içinde gerçek adres girilmeli.")
    if not nocodb.configured:
        warnings.append("NocoDB yapılandırılmamış (NOCODB_BASE_URL / NOCODB_API_TOKEN boş).")
    if not settings.api_secret_key:
        warnings.append("API_SECRET_KEY boş — üretimde güvenlik açığı olur.")
    if not settings.bridge_token:
        warnings.append("BRIDGE_TOKEN boş — köprü güvenliği için gerekli (Faz 3).")

    return {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
            "env": settings.app_env,
            "debug": settings.debug,
            "lang": settings.app_lang,
        },
        "features": {
            "db_adapter": settings.db_adapter,
            "command_policy": settings.command_policy,
            "platforms": {
                "windows": settings.supported_windows,
                "linux": settings.supported_linux,
            },
        },
        "integrations": {
            "nocodb": {
                "configured": nocodb.configured,
                "placeholder": nocodb.placeholder,
                "reachable": nocodb.reachable,
                "ok": nocodb.ok,
                "base_url": nocodb.base_url,
                "detail": nocodb.detail,
                #: Tablo eşlemeleri — arayüz bunları `.env`'den okumak zorunda kalmasın
                "tables": {
                    "users": settings.nocodb_table_users,
                    "devices": settings.nocodb_table_devices,
                    "scripts": settings.nocodb_table_scripts,
                    "resources": settings.nocodb_table_resources,
                    "logs": settings.nocodb_table_logs,
                    "settings": settings.nocodb_table_settings,
                },
            },
            "n8n": {"configured": bool(settings.n8n_base_url)},
            "telegram": {"configured": bool(settings.telegram_bot_token)},
            "bridge": {"configured": bool(settings.bridge_token)},
        },
        "warnings": warnings,
    }
