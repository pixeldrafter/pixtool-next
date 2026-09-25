//! Pixtool Next — masaüstü kabuğu (Tauri 2).
//!
//! ## Görevleri
//!
//! 1. **Çerçevesiz pencere** — tarayıcı çubuğu/sekme yok, tam "işletim sistemi"
//!    hissi. Pencere kontrolleri arayüzden çağrılır (`window_*` komutları).
//! 2. **Yerel köprüyü otomatik başlat** — `pixtool-bridge` sidecar'ı (Faz 3)
//!    uygulamayla birlikte gelir ve arka planda çalışır. Arayüz onu
//!    `http://127.0.0.1:<port>` üzerinden bulur; token elle girilmez.
//! 3. **Tek örnek** — ikinci kez açılırsa mevcut pencere öne gelir.
//!
//! ## Köprü neden sidecar?
//!
//! Köprü Python'dur (psutil/PowerShell). Tauri'ye gömmek Rust'ta yeniden yazmayı
//! gerektirirdi. Sidecar olarak paketlenince:
//!   • kullanıcı Python kurmak zorunda kalmaz,
//!   • token uygulama tarafından üretilir ve yalnızca bellekte kalır,
//!   • uygulama kapanınca köprü de kapanır.

use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// ----------------------------------------------------------------------
//  Arayüz kaynağı (uzak / yerel)
// ----------------------------------------------------------------------
///
/// ## Neden?
///
/// Arayüz `frontendDist` ile exe'nin içine gömülürse **her arayüz değişikliği
/// yeniden derleme** gerektirir. Oysa kabuk (Rust) nadiren değişir.
///
/// Bu yüzden uygulama açılışta sunucuyu yoklar:
///
/// | Durum | Ne yüklenir | Güncelleme |
/// |---|---|---|
/// | Sunucu erişilebilir | **Uzak** arayüz | Sunucuya kopyala → anında |
/// | Sunucu yok (çevrimdışı) | **Gömülü** kopya | exe yeniden derlenir |
///
/// `PIXTOOL_UI_URL` ortam değişkeniyle geçersiz kılınabilir (geliştirme).
const DEFAULT_UI_URL: &str = "https://pixtool.omercataloglu.com";

/// Arayüz kaynak bilgisi.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UiSource {
    /// Kullanılan mod: "remote" | "local"
    upstream: String,
    /// Uzak adres
    remote_url: String,
    /// Uzak erişilebilir mi
    remote_reachable: bool,
    /// Kabuk sürümü
    shell_version: String,
}

/// Uzak arayüz adresini döndürür (ortam değişkeni > varsayılan).
fn ui_remote_url() -> String {
    std::env::var("PIXTOOL_UI_URL").unwrap_or_else(|_| DEFAULT_UI_URL.to_string())
}

/// Sunucu erişilebilir mi? (kısa zaman aşımı — açılışı bekletmesin)
fn remote_reachable(url: &str) -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(6))
        .connect_timeout(Duration::from_secs(4))
        .user_agent("PixtoolShell/1.0")
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };

    // Sağlık ucu en hafif kontrol
    let health = format!("{}/health", url.trim_end_matches('/'));
    client
        .get(&health)
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

/// Arayüzün nereden yükleneceğini söyler.
#[tauri::command]
fn ui_source(app: tauri::AppHandle) -> UiSource {
    let remote_url = ui_remote_url();
    let reachable = remote_reachable(&remote_url);

    UiSource {
        upstream: if reachable { "remote" } else { "local" }.to_string(),
        remote_url,
        remote_reachable: reachable,
        shell_version: app.package_info().version.to_string(),
    }
}

/// Webview'ı verilen adrese yönlendirir.
#[tauri::command]
fn navigate_ui(window: tauri::WebviewWindow, url: String) -> Result<(), String> {
    let parsed = url.parse().map_err(|err| format!("Geçersiz adres: {err}"))?;
    window.navigate(parsed).map_err(|err| err.to_string())
}

/// Arayüzü yeniler (uzak adres kullanılıyorsa sunucudan tekrar çeker).
#[tauri::command]
fn reload_ui(window: tauri::WebviewWindow) -> Result<(), String> {
    window.reload().map_err(|err| err.to_string())
}

/// Kabuk sürümü.
#[tauri::command]
fn shell_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

// ----------------------------------------------------------------------
//  Köprü durumu
// ----------------------------------------------------------------------
/// Çalışan köprü süreci ve bağlantı bilgileri.
#[derive(Default)]
struct BridgeState {
    inner: Mutex<BridgeInner>,
}

#[derive(Default)]
struct BridgeInner {
    child: Option<CommandChild>,
    port: u16,
    token: Option<String>,
}

/// Arayüze dönen köprü durumu.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BridgeStatus {
    /// Köprü çalışıyor mu
    running: bool,
    /// Dinlenen port
    port: u16,
    /// Arayüzün kullanacağı tam adres
    url: String,
    /// Erişim tokenı (yalnızca çalışırken dolu)
    token: Option<String>,
    /// Hata mesajı (varsa)
    error: Option<String>,
}

/// Köprü başlatma isteği.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgeStartArgs {
    /// Dinlenecek port (yoksa 8765)
    port: Option<u16>,
    /// Sabit token (yoksa üretilir)
    token: Option<String>,
}

// ----------------------------------------------------------------------
//  Pencere komutları
// ----------------------------------------------------------------------
#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn window_is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_set_fullscreen(window: tauri::Window, fullscreen: bool) {
    let _ = window.set_fullscreen(fullscreen);
}

#[tauri::command]
fn window_is_fullscreen(window: tauri::Window) -> bool {
    window.is_fullscreen().unwrap_or(false)
}

// ----------------------------------------------------------------------
//  Köprü komutları
// ----------------------------------------------------------------------
/// Basit rastgele token üretir (kriptografik olarak yeterli).
fn generate_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();

    // Basit bir karıştırma — köprü yalnızca localhost dinlediği için yeterli
    let mixed = nanos
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add((pid as u128).wrapping_mul(1_442_695_040_888_963_407));

    let mut out = String::with_capacity(32);
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut value = mixed;
    for _ in 0..32 {
        let index = (value % alphabet.len() as u128) as usize;
        out.push(alphabet[index] as char);
        value /= alphabet.len() as u128;
    }
    out
}

/// Köprüyü başlatır (sidecar → yoksa Python).
#[tauri::command]
fn bridge_start(
    app: tauri::AppHandle,
    state: State<'_, BridgeState>,
    args: Option<BridgeStartArgs>,
) -> BridgeStatus {
    let args = args.unwrap_or(BridgeStartArgs {
        port: None,
        token: None,
    });
    let port = args.port.unwrap_or(8765);
    let token = args.token.unwrap_or_else(generate_token);

    let mut inner = match state.inner.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    // Zaten çalışıyorsa mevcut bilgiyi döndür
    if inner.child.is_some() {
        return BridgeStatus {
            running: true,
            port: inner.port,
            url: format!("http://127.0.0.1:{}", inner.port),
            token: inner.token.clone(),
            error: None,
        };
    }

    // Ebeveyn bekçisi için kendi PID'imizi gönderiyoruz: uygulama kapanınca
    // köprü (ve PyInstaller alt süreçleri) kendiliğinden sonlanır.
    let parent_pid = std::process::id().to_string();

    // 1) Sidecar (paketlenmiş köprü)
    let sidecar = app.shell().sidecar("pixtool-bridge").map(|command| {
        command.args([
            "--port",
            &port.to_string(),
            "--token",
            &token,
            "--parent-pid",
            &parent_pid,
        ])
    });

    let spawned = match sidecar {
        Ok(command) => command.spawn(),
        Err(_) => {
            // 2) Python yedeği (geliştirme / sidecar derlenmemişse)
            let script = app
                .path()
                .resource_dir()
                .map(|dir| dir.join("bridge").join("pixtool_bridge.py"))
                .ok()
                .filter(|path| path.exists());

            match script {
                Some(path) => app
                    .shell()
                    .command("python")
                    .args([
                        path.to_string_lossy().to_string(),
                        "--port".into(),
                        port.to_string(),
                        "--token".into(),
                        token.clone(),
                        "--parent-pid".into(),
                        parent_pid.clone(),
                    ])
                    .spawn(),
                None => {
                    return BridgeStatus {
                        running: false,
                        port,
                        url: format!("http://127.0.0.1:{port}"),
                        token: None,
                        error: Some(
                            "Köprü bulunamadı. `services/bridge` derlenmemiş olabilir.".into(),
                        ),
                    };
                }
            }
        }
    };

    match spawned {
        Ok((mut events, child)) => {
            // Süreç çıktısını dinle (günlük için)
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[bridge] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[bridge] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("[bridge] kapandı: {payload:?}");
                            break;
                        }
                        _ => {}
                    }
                }
            });

            inner.child = Some(child);
            inner.port = port;
            inner.token = Some(token.clone());

            BridgeStatus {
                running: true,
                port,
                url: format!("http://127.0.0.1:{port}"),
                token: Some(token),
                error: None,
            }
        }
        Err(err) => BridgeStatus {
            running: false,
            port,
            url: format!("http://127.0.0.1:{port}"),
            token: None,
            error: Some(format!("Köprü başlatılamadı: {err}")),
        },
    }
}

/// Köprüyü durdurur.
#[tauri::command]
fn bridge_stop(state: State<'_, BridgeState>) -> BridgeStatus {
    let mut inner = match state.inner.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    if let Some(child) = inner.child.take() {
        let _ = child.kill();
    }
    inner.token = None;

    BridgeStatus {
        running: false,
        port: inner.port,
        url: format!("http://127.0.0.1:{}", inner.port),
        token: None,
        error: None,
    }
}

/// Köprünün çalışma durumu.
#[tauri::command]
fn bridge_status(state: State<'_, BridgeState>) -> BridgeStatus {
    let inner = match state.inner.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    BridgeStatus {
        running: inner.child.is_some(),
        port: inner.port,
        url: format!("http://127.0.0.1:{}", inner.port),
        token: inner.token.clone(),
        error: None,
    }
}

// ----------------------------------------------------------------------
//  Uygulama
// ----------------------------------------------------------------------
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Tek örnek: ikinci açılışta mevcut pencere öne gelir
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        // Otomatik güncelleme: imzalı paketi indirir ve kurar.
        // Kontrol arayüzden yapılır (ilerleme çubuğu uygulamanın kendi stiliyle).
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(BridgeState::default())
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_is_maximized,
            window_close,
            window_set_fullscreen,
            window_is_fullscreen,
            bridge_start,
            bridge_stop,
            bridge_status,
            ui_source,
            navigate_ui,
            reload_ui,
            shell_version,
        ])
        .setup(|app| {
            // Yerel köprüyü otomatik başlat
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(600));
                let state = handle.state::<BridgeState>();
                let status = bridge_start(handle.clone(), state, None);
                if status.running {
                    println!("[pixtool] köprü hazır: {}", status.url);
                } else if let Some(error) = status.error {
                    eprintln!("[pixtool] köprü başlatılamadı: {error}");
                }
            });

            // Arayüzü uzak sunucudan yükle (varsa).
            //
            // Gömülü kopya **çevrimdişi yedek**tir: arayüz değişiklikleri
            // sunucuya kopyalanır ve uygulama yeniden derlenmeden güncellenir.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let remote = ui_remote_url();

                if !remote_reachable(&remote) {
                    println!("[pixtool] uzak arayüz erişilemez — gömülü kopya kullanılıyor");
                    return;
                }

                // Pencere hazır olana kadar bekle
                for _ in 0..40 {
                    if let Some(window) = handle.get_webview_window("main") {
                        match remote.parse() {
                            Ok(url) => {
                                if window.navigate(url).is_ok() {
                                    println!("[pixtool] arayüz uzaktan yüklendi: {remote}");
                                }
                            }
                            Err(err) => eprintln!("[pixtool] geçersiz arayüz adresi: {err}"),
                        }
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(150));
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Pixtool Next başlatılamadı")
        .run(|app_handle, event| {
            // Kapanışta köprü sürecini de sonlandır
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<BridgeState>();
                // Guard'ı kapsam içinde bırak (yaşam süresi)
                let child = {
                    let mut inner = match state.inner.lock() {
                        Ok(guard) => guard,
                        Err(poisoned) => poisoned.into_inner(),
                    };
                    inner.child.take()
                };
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_long_and_unique() {
        let first = generate_token();
        let second = generate_token();
        assert_eq!(first.len(), 32);
        assert_ne!(first, second, "token tekrar etmemeli");
        assert!(first.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn bridge_status_defaults_to_stopped() {
        let state = BridgeState::default();
        let inner = state.inner.lock().unwrap();
        assert!(inner.child.is_none());
        assert!(inner.token.is_none());
    }
}
