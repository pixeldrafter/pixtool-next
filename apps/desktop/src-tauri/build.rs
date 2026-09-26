fn main() {
    // Uygulama komutları için ACL izinleri üret (`allow-<komut>` / `deny-<komut>`).
    //
    // ⚠️ Neden gerekli? Tauri v2, arayüz **uzak origin**'den (`https://…`)
    // yüklendiğinde uygulamanın kendi komutlarını ACL ile reddeder
    // ("Command … not allowed by ACL") — eklenti komutları geçer ama bunlar geçmez.
    // Bu izinler `capabilities/default.json` ve `capabilities/remote.json`
    // içinde atanır; uzak arayüz de köprü/pencere komutlarını çağırabilir.
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "bridge_start",
            "bridge_stop",
            "bridge_status",
            "shell_version",
            "ui_source",
            "navigate_ui",
            "reload_ui",
            "window_minimize",
            "window_toggle_maximize",
            "window_is_maximized",
            "window_close",
            "window_set_fullscreen",
            "window_is_fullscreen",
        ]),
    );

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
