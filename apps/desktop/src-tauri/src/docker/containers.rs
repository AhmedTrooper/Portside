use serde_json::Value;
use tauri::command;

use super::{docker_command, run_docker};

/// Run a container action and notify the frontend only when it succeeded.
fn run_container_action(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let result = run_docker(args);
    if result.is_ok() {
        use tauri::Emitter;
        let _ = app.emit("docker-containers-changed", ());
    }
    result
}

/// Read the Compose project label directly from Docker. We deliberately don't
/// trust a project name sent from the frontend: individual lifecycle actions
/// must be blocked even if the UI is bypassed.
fn compose_project_for(container_id: &str) -> Result<Option<String>, String> {
    let output = docker_command()
        .args([
            "inspect",
            "--format",
            "{{json .Config.Labels}}",
            container_id,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Could not inspect the container.".to_string()
        } else {
            stderr
        });
    }

    let labels: Value = serde_json::from_slice(&output.stdout).unwrap_or(Value::Null);
    Ok(labels
        .get("com.docker.compose.project")
        .and_then(Value::as_str)
        .map(str::to_string))
}

/// Compose owns the container lifecycle. Stopping/removing one container by
/// hand leaves Compose with a project it thinks is still running, and the next
/// `up`/`stop` can fail or recreate services unexpectedly.
fn ensure_standalone(container_id: &str) -> Result<(), String> {
    if let Some(project) = compose_project_for(container_id)? {
        return Err(format!(
            "Container is managed by Compose project \"{project}\". Manage it from the Compose project instead."
        ));
    }
    Ok(())
}

fn run_standalone_action(
    app: &tauri::AppHandle,
    container_id: &str,
    args: &[&str],
) -> Result<String, String> {
    ensure_standalone(container_id)?;
    run_container_action(app, args)
}

#[command]
pub fn docker_start_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_standalone_action(&app, &id, &["start", &id])
}

#[command]
pub fn docker_stop_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_standalone_action(&app, &id, &["stop", &id])
}

#[command]
pub fn docker_restart_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_standalone_action(&app, &id, &["restart", &id])
}

#[command]
pub fn docker_pause_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_standalone_action(&app, &id, &["pause", &id])
}

#[command]
pub fn docker_unpause_container(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_standalone_action(&app, &id, &["unpause", &id])
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
    run_standalone_action(&app, &id, &args)
}
