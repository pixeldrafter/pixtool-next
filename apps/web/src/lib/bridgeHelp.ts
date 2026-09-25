/**
 * Yerel köprü erişim açıklaması.
 *
 * Tarayıcılar genel bir HTTPS sayfadan (`https://ornek.com`) makinedeki
 * `127.0.0.1` adresine yapılan istekleri **Local Network Access** politikasıyla
 * kısıtlar:
 *
 *   "Permission was denied for this request to access the `loopback` address space."
 *
 * Bu, uygulamanın hatası değil tarayıcı güvenliğidir. İki geçerli çözüm var:
 *
 *   1. **Masaüstü uygulaması** (önerilen) — Tauri origin'i `tauri://localhost`
 *      olduğu için istek genel → yerel sayılmaz, kısıt uygulanmaz.
 *   2. **Tarayıcı** — Chrome izin sorar ("Yerel ağdaki cihazlara erişim");
 *      kullanıcı izin verirse çalışır. Ayrıca `chrome://flags` içinden
 *      "Local Network Access checks" ayarı gevşetilebilir.
 */

/** Köprü erişilemediğinde gösterilecek yönlendirme metni. */
export interface BridgeHelp {
  /** Kısa başlık */
  title: string;
  /** Ayrıntılı açıklama */
  body: string;
  /** Adım adım öneriler */
  steps: string[];
  /** Bu ortam masaüstü kabuğu mu? */
  isDesktop: boolean;
}

/** Ortam masaüstü kabuğunda mı (Tauri)? */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

/** Sayfa genel (public) bir HTTPS adresinde mi? */
export function isPublicOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  if (protocol !== "https:") return false;
  return !["localhost", "127.0.0.1", "tauri.localhost"].includes(hostname);
}

/** Köprü yoksa gösterilecek yönlendirme. */
export function bridgeHelp(bridgeUrl: string): BridgeHelp {
  const desktop = isDesktopShell();
  const publicOrigin = isPublicOrigin();

  if (desktop) {
    return {
      title: "Yerel köprü kapalı",
      body: `Masaüstü uygulaması köprüyü otomatik başlatır. Başlatılamadıysa ${bridgeUrl} adresinde dinleyen bir süreç yok.`,
      steps: [
        "Uygulamayı kapatıp yeniden açın (köprü alt süreç olarak başlar).",
        "Bağlantı noktası kullanımda mı: `netstat -ano | findstr 8765`",
        "Elle başlatmak için: `services/bridge/start-bridge.bat`",
      ],
      isDesktop: true,
    };
  }

  if (publicOrigin) {
    return {
      title: "Tarayıcı yerel ağ erişimini engelliyor",
      body:
        "Bu sayfa genel bir HTTPS adresinden açık ve makinenizdeki 127.0.0.1 adresine erişmek istiyor. " +
        "Tarayıcılar bunu Local Network Access politikasıyla kısıtlar — uygulamanın hatası değildir.",
      steps: [
        "Adres çubuğundaki kalkan/izin simgesine tıklayın ve yerel ağ erişimine izin verin.",
        "Kalıcı çözüm: masaüstü uygulamasını kullanın — köprü orada kısıt olmadan çalışır.",
        `Köprünün açık olduğundan emin olun: ${bridgeUrl}/health`,
      ],
      isDesktop: false,
    };
  }

  return {
    title: "Yerel köprüye ulaşılamadı",
    body: `Bu sayfa yerel bir adresten açık ama ${bridgeUrl} adresinde dinleyen bir köprü bulunamadı.`,
    steps: [
      "Köprüyü başlatın: `services/bridge/start-bridge.bat` (Windows) veya `start-bridge.sh`",
      "Python ile: `python pixtool_bridge.py`",
      `Sağlık kontrolü: \`curl ${bridgeUrl}/health\``,
    ],
    isDesktop: false,
  };
}
