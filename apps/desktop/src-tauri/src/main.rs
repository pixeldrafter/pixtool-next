// Windows'ta konsol penceresi açılmasın (release derlemesinde)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pixtool_desktop_lib::run()
}
