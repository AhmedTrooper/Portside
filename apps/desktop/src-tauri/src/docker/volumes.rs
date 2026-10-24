//! Volume management commands.
//!
//! Volumes are cheap to list and the create/remove/prune commands finish
//! quickly, so these stay as one-shot commands rather than the streaming
//! operation maps used by image pulls or network creates. Every successful
//! write emits `docker-volumes-changed` so mounted pages can refresh without
//! waiting for the 60 second global poll.

use tauri::{command, AppHandle, Emitter};

use super::run_docker;

fn validate_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Volume name cannot be empty.".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("Volume name cannot start with a dash.".to_string());
    }
    if trimmed.chars().any(char::is_whitespace) {
        return Err("Volume name must not contain spaces.".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Volume name must not contain path separators.".to_string());
    }
    Ok(trimmed.to_string())
}

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("docker-volumes-changed", ());
}

#[command]
pub fn docker_create_volume(app: AppHandle, name: String) -> Result<String, String> {
    let name = validate_name(&name)?;
    let result = run_docker(["volume", "create", &name]);
    if result.is_ok() {
        emit_changed(&app);
    }
    result
}

#[command]
pub fn docker_remove_volume(app: AppHandle, name: String) -> Result<String, String> {
    let name = validate_name(&name)?;
    let result = run_docker(["volume", "rm", &name]);
    if result.is_ok() {
        emit_changed(&app);
    }
    result
}

#[command]
pub fn docker_prune_volumes(app: AppHandle) -> Result<String, String> {
    let result = run_docker(["volume", "prune", "-f"]);
    if result.is_ok() {
        emit_changed(&app);
    }
    result
}
