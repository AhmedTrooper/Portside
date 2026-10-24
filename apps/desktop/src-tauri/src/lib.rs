pub mod aws;
pub mod docker;
pub mod git;
pub mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            state::get_global_state,
            docker::containers::docker_start_container,
            docker::containers::docker_stop_container,
            docker::containers::docker_restart_container,
            docker::containers::docker_remove_container,
            docker::images::docker_pull_image,
            docker::images::docker_remove_image,
            docker::images::get_image_operations,
            docker::networks::docker_create_network,
            docker::networks::docker_remove_network,
            docker::networks::get_network_operations,
        ])
        .setup(|app| {
            app.manage(docker::images::new_ops_map());
            app.manage(docker::networks::new_ops_map());
            state::init(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
