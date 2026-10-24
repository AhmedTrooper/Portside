use tauri::command;

use super::run_docker;

/// Run a container action and notify the frontend only when it succeeded.
fn run_container_action(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let result = run_docker(args);
    if result.is_ok() {
        use tauri::Emitter;
        let _ = app.emit("docker-containers-changed", ());
    }
    result
}

#[command]
pub fn docker_start_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_container_action(&app, &["start", &id])
}

#[command]
pub fn docker_stop_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_container_action(&app, &["stop", &id])
}

#[command]
pub fn docker_restart_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_container_action(&app, &["restart", &id])
}

#[command]
pub fn docker_pause_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_container_action(&app, &["pause", &id])
}

#[command]
pub fn docker_unpause_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_container_action(&app, &["unpause", &id])
}

#[command]
pub fn docker_remove_container(
    app: tauri::AppHandle,
    id: String,
    force: bool,
) -> Result<String, String> {
    let mut args = vec!["rm"];
    if force {
        args.push("-f");
    }
    args.push(&id);
    run_container_action(&app, &args)
}
