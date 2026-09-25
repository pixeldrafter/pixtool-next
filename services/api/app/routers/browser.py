"""
Tarayıcı proxy'si — sayfa sunucu üzerinden çekilir.

Neden proxy?
------------
İstenen davranış: panelin içindeki tarayıcı **sunucunun IP'siyle** çıksın.
Sayfa doğrudan tarayıcıda açılırsa istek kullanıcının IP'sinden gider.
Bu yüzden içerik sunucu tarafında çekilir, bağlantılar proxy'ye çevrilir
ve panelde gösterilir.

    GET /api/v1/browser/fetch?url=https://ornek.com

Güvenlik
--------
SSRF (sunucu taraflı istek sahteciliği) engellenir:
  • Yalnızca `http` / `https`
  • Özel/ayrılmış adresler reddedilir (127.0.0.0/8, 10/8, 172.16/12,
    192.168/16, 169.254/16, ::1, fc00::/7)
  • Yerel alan adları (.local, localhost) reddedilir
  • Yönlendirmeler de aynı denetimden geçer
  • Yanıt boyutu sınırlıdır
"""

from __future__ import annotations

import ipaddress
import logging
import os
import re
import socket
from typing import Any
from urllib.parse import quote, urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

logger = logging.getLogger("pixtool.browser")

router = APIRouter(prefix="/api/v1/browser", tags=["tarayıcı"])

#: Ana sayfa
DEFAULT_HOME = "https://omercataloglu.com"

#: En fazla yanıt boyutu (8 MB)
MAX_BYTES = 8 * 1024 * 1024

#: Zaman aşımı (saniye)
TIMEOUT = 25.0

#: Tarayıcı kimliği
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

#: SSRF denetiminden **muaf** alan adları.
#
#  Sunucu kendi alan adlarını kendine çözümler (iç DNS / hosts kaydı).
#  Bu yüzden omercataloglu.com gibi adresler "özel ağ" görünür ve yanlışlıkla
#  engellenir. Panelin **kendi servislerini** gezinmek meşru bir kullanımdır;
#  bu liste açıkça izin verir. Ortam değişkeniyle genişletilebilir:
#      BROWSER_ALLOWED_HOSTS=omercataloglu.com,ornek.com
_ALLOWED_SUFFIXES = (
    "omercataloglu.com",
    "pixtool.omercataloglu.com",
    "noco.omercataloglu.com",
    "otomasyon.omercataloglu.com",
)


def _allowed_hosts() -> tuple[str, ...]:
    """İzin verilen alan adı sonekleri (ortam değişkeniyle genişletilebilir)."""
    extra = os.environ.get("BROWSER_ALLOWED_HOSTS", "")
    parsed = tuple(item.strip().lower() for item in extra.split(",") if item.strip())
    return _ALLOWED_SUFFIXES + parsed


def _is_allowed_host(hostname: str) -> bool:
    """Kendi alan adlarımızdan biri mi?"""
    lowered = (hostname or "").lower().strip(".")
    return any(lowered == suffix or lowered.endswith(f".{suffix}") for suffix in _allowed_hosts())

#: Proxy'lenmeyecek şemalar
_SAFE_SCHEMES = {"http", "https"}


def _is_private_host(hostname: str) -> bool:
    """Adres özel/ayrılmış bir ağa mı ait?"""
    if not hostname:
        return True

    # Kendi alan adlarımız her zaman izinli
    if _is_allowed_host(hostname):
        return False

    lowered = hostname.lower().strip("[]")

    # Yerel adlar
    if lowered in {"localhost", "localhost.localdomain"} or lowered.endswith(
        (".local", ".localhost", ".internal", ".lan", ".home")
    ):
        return True

    # Doğrudan IP
    try:
        address = ipaddress.ip_address(lowered)
    except ValueError:
        # Alan adı — çözümleyip kontrol et
        try:
            resolved = socket.getaddrinfo(lowered, None, proto=socket.IPPROTO_TCP)
        except (socket.gaierror, OSError):
            # Çözümlenemiyorsa geç (httpx kendi hatasını verir)
            return False

        for entry in resolved:
            try:
                address = ipaddress.ip_address(entry[4][0])
            except ValueError:
                continue
            if (
                address.is_private
                or address.is_loopback
                or address.is_link_local
                or address.is_reserved
                or address.is_multicast
            ):
                return True
        return False

    return (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
    )


def _validate_url(raw: str) -> str:
    """URL'yi doğrular; güvenliyse döndürür."""
    url = (raw or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Adres boş olamaz.",
        )

    # Şema yoksa https varsay
    if "://" not in url:
        url = f"https://{url}"

    parsed = urlparse(url)

    if parsed.scheme.lower() not in _SAFE_SCHEMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen şema: {parsed.scheme}",
        )

    if _is_private_host(parsed.hostname or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Özel ağ adreslerine erişim engellendi (SSRF koruması).",
        )

    return url


# ----------------------------------------------------------------------
#  HTML yeniden yazma
# ----------------------------------------------------------------------

#: Proxy'den geçirilecek öznitelikler
_ATTR_PATTERN = re.compile(
    r"""(?P<attr>\b(?:href|src|action|poster|data-src)\s*=\s*)"""
    r"""(?P<quote>["'])(?P<url>[^"']+)(?P=quote)""",
    re.IGNORECASE,
)

#: srcset (virgülle ayrılmış liste)
_SRCSET_PATTERN = re.compile(
    r"""(?P<attr>\bsrcset\s*=\s*)(?P<quote>["'])(?P<value>[^"']+)(?P=quote)""",
    re.IGNORECASE,
)

#: Engellenecek şemalar
_SKIP_PREFIXES = ("data:", "javascript:", "mailto:", "tel:", "blob:", "about:", "#")


def _proxy_path(target: str) -> str:
    """Hedef adresi proxy yoluna çevirir."""
    return f"/api/v1/browser/fetch?url={quote(target, safe='')}"


def _rewrite_value(value: str, base: str) -> str:
    """Tek bir URL değerini proxy'ye çevirir."""
    text = value.strip()
    if not text or text.startswith(_SKIP_PREFIXES):
        return value

    absolute = urljoin(base, text)
    if not absolute.lower().startswith(("http://", "https://")):
        return value

    return _proxy_path(absolute)


def _rewrite_html(html: str, base: str) -> str:
    """HTML içindeki tüm bağlantıları proxy'ye çevirir."""

    # srcset önce (içinde virgül var, attribute deseni onu bozar)
    def srcset_repl(match: re.Match[str]) -> str:
        parts: list[str] = []
        for chunk in match.group("value").split(","):
            piece = chunk.strip()
            if not piece:
                continue
            bits = piece.split(None, 1)
            rewritten = _rewrite_value(bits[0], base)
            parts.append(rewritten + (f" {bits[1]}" if len(bits) > 1 else ""))
        joined = ", ".join(parts)
        return f"{match.group('attr')}{match.group('quote')}{joined}{match.group('quote')}"

    html = _SRCSET_PATTERN.sub(srcset_repl, html)

    def attr_repl(match: re.Match[str]) -> str:
        return (
            f"{match.group('attr')}{match.group('quote')}"
            f"{_rewrite_value(match.group('url'), base)}"
            f"{match.group('quote')}"
        )

    return _ATTR_PATTERN.sub(attr_repl, html)


#: Proxy'ye hiç dokunulmayacak içerik tipleri
_BINARY_TYPES = (
    "image/",
    "video/",
    "audio/",
    "font/",
    "application/octet-stream",
    "application/zip",
    "application/pdf",
)

#: Bu tiplerin içeriği doğrudan aktarılır (HTML yeniden yazılmaz)
_PASSTHROUGH_TYPES = (
    "text/css",
    "application/javascript",
    "text/javascript",
    "application/json",
)


# ----------------------------------------------------------------------
#  Uç noktalar
# ----------------------------------------------------------------------


@router.get("/home")
async def home_url() -> dict[str, Any]:
    """Tarayıcının ana sayfası ve çıkış IP'si."""
    return {"ok": True, "home": DEFAULT_HOME, "proxy": "/api/v1/browser/fetch"}


@router.get("/myip")
async def my_ip() -> dict[str, Any]:
    """
    Sunucunun dış IP'sini döndürür.

    Panelin içindeki tarayıcı bu IP ile çıkar — kullanıcı doğrulayabilsin.
    """
    sources = (
        "https://api.ipify.org?format=json",
        "https://ifconfig.me/all.json",
        "https://ipinfo.io/json",
    )

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        for endpoint in sources:
            try:
                response = await client.get(endpoint, headers={"User-Agent": USER_AGENT})
                if response.status_code != 200:
                    continue
                data = response.json()
                address = data.get("ip") or data.get("query") or data.get("ip_addr") or ""
                if address:
                    return {
                        "ok": True,
                        "ip": address,
                        "source": endpoint.split("/")[2],
                        "country": data.get("country") or data.get("country_code"),
                        "city": data.get("city"),
                        "org": data.get("org") or data.get("isp"),
                    }
            except Exception:  # noqa: BLE001 — kaynak kaynak deniyoruz
                continue

    return {"ok": False, "ip": None, "message": "Dış IP öğrenilemedi."}


@router.get("/fetch")
async def fetch(
    url: str = Query(..., description="Çekilecek adres"),
    raw: bool = Query(default=False, description="HTML yeniden yazımını atla"),
) -> Response:
    """
    Sayfayı sunucu üzerinden çeker.

    HTML ise bağlantılar proxy'ye çevrilir; diğer içerik tipleri olduğu gibi
    aktarılır (görsel, CSS, JS, font).
    """
    target = _validate_url(url)

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
    }

    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
            max_redirects=6,
        ) as client:
            response = await client.get(target, headers=headers)
    except httpx.TooManyRedirects as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Çok fazla yönlendirme.",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Site zaman aşımına uğradı.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 — ağ hataları çeşitli
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Siteye ulaşılamadı: {type(exc).__name__}",
        ) from exc

    # Yönlendirme sonrası adres de güvenli olmalı
    final_url = str(response.url)
    if _is_private_host(urlparse(final_url).hostname or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yönlendirme özel bir ağa çıktı — engellendi.",
        )

    content_type = response.headers.get("content-type", "application/octet-stream").lower()
    body = response.content

    if len(body) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="İçerik çok büyük (8 MB sınırı).",
        )

    out_headers = {
        "Cache-Control": "no-store",
        "X-Pixtool-Final-Url": final_url,
    }

    # İkili içerik → olduğu gibi
    if any(kind in content_type for kind in _BINARY_TYPES):
        return Response(content=body, media_type=content_type, headers=out_headers)

    # HTML → bağlantıları çevir
    if "html" in content_type and not raw:
        try:
            html = body.decode(response.encoding or "utf-8", errors="replace")
        except (LookupError, UnicodeDecodeError):
            html = body.decode("utf-8", errors="replace")

        rewritten = _rewrite_html(html, final_url)

        # Sayfa içi DOM API'leri için temel enjeksiyon:
        #   • form gönderimleri proxy üzerinden gitsin
        #   • hedef=_blank bağlantılar aynı pencerede açılsın
        injection = """
<base href="__BASE__">
<style id="pixtool-proxy-base">
  /* Proxy sayfası: dış bağlantı göstergesi */
  a[target="_blank"] { }
</style>
<script>
(function () {
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !form.action) return;
    if (form.action.indexOf('/api/v1/browser/fetch') !== -1) return;
    var method = (form.method || 'GET').toUpperCase();
    if (method !== 'GET') return; // POST formları proxy'den geçemez
    event.preventDefault();
    var params = new URLSearchParams(new FormData(form));
    var target = form.action + (form.action.indexOf('?') === -1 ? '?' : '&') + params.toString();
    location.href = '/api/v1/browser/fetch?url=' + encodeURIComponent(target);
  }, true);
})();
</script>
""".replace("__BASE__", final_url)

        if "</head>" in rewritten.lower():
            rewritten = re.sub(
                r"</head>",
                injection + "</head>",
                rewritten,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            rewritten = injection + rewritten

        return Response(
            content=rewritten.encode("utf-8"),
            media_type="text/html; charset=utf-8",
            headers=out_headers,
        )

    # CSS / JS / JSON → doğrudan aktar (kendi içindeki göreli yollar tarayıcı
    # tarafından proxy adresine göre çözümlenir)
    media = content_type.split(";")[0].strip()
    return Response(
        content=body,
        media_type=media or "application/octet-stream",
        headers=out_headers,
    )
