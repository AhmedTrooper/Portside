//! Docker Compose project commands.
//!
//! Projects are discovered through `docker compose ls -a --format json` and
//! the mutations are thin wrappers around the CLI:
//!   - `up`      — create/recreate and start detached
//!   - `stop`    — stop the project's containers
//!   - `restart` — restart the project's containers
//!   - `down`    — stop and remove the project's containers/networks
//!
//! `down` deliberately does not pass `--volumes`: deleting named volumes is a
//! destructive action that should stay explicit on the Volumes page.

use std::path::Path;

use tauri::{command, AppHandle, Emitter};

use super::run_docker;

fn validate_project(project: Option<&str>) -> Result<Option<String>, String> {
    let Some(project) = project else {
        return Ok(None);
    };
    let trimmed = project.trim();
    if trimmed.is_empty() {
        return Err("Compose project name cannot be empty.".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("Compose project name cannot start with a dash.".to_string());
    }
    if trimmed.chars().any(char::is_whitespace) {
        return Err("Compose project name must not contain spaces.".to_string());
    }
    Ok(Some(trimmed.to_string()))
}

fn validate_files(files: &[String]) -> Result<Vec<String>, String> {
    if files.is_empty() {
        return Err("The Compose project has no configuration file.".to_string());
    }
    let mut cleaned = Vec::with_capacity(files.len());
    for file in files {
        let path = file.trim();
        if path.is_empty() {
            continue;
        }
        if !Path::new(path).is_file() {
            return Err(format!("Compose file not found: {path}"));
        }
        cleaned.push(path.to_string());
    }
    if cleaned.is_empty() {
        return Err("The Compose project has no configuration file.".to_string());
    }
    Ok(cleaned)
}

fn run_compose(
    app: &AppHandle,
    project: Option<&str>,
    files: &[String],
    action: &[&str],
) -> Result<String, String> {
    let project = validate_project(project)?;
    // Compose can resolve `stop`, `restart`, and `down` from the project
    // labels alone, so those actions don't need a compose file path. This lets
    // Compose-owned containers be controlled from the Containers page and lets
    // a project be removed even when its original directory has moved. `up`
    // still requires the file.
    let needs_files = action.contains(&"up");
    let files = if needs_files {
        validate_files(files)?
    } else {
        Vec::new()
    };

    let mut args = vec!["compose".to_string()];
    if let Some(project) = project {
        args.push("-p".to_string());
        args.push(project);
    }
    for file in &files {
        args.push("-f".to_string());
        args.push(file.clone());
    }
    for part in action {
        args.push((*part).to_string());
    }

    let result = run_docker(&args);
    // A failed `up` can leave containers partially created, so refresh the
    // list on both success and failure.
    let _ = app.emit("docker-compose-changed", ());
    result
}

async fn run_compose_async(
    app: AppHandle,
    project: Option<String>,
    files: Vec<String>,
    action: Vec<&'static str>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_compose(&app, project.as_deref(), &files, &action)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_compose_up(
    app: AppHandle,
    project: Option<String>,
    files: Vec<String>,
) -> Result<String, String> {
    run_compose_async(app, project, files, vec!["up", "-d"]).await
}

#[command]
pub async fn docker_compose_stop(
    app: AppHandle,
    project: String,
    files: Vec<String>,
) -> Result<String, String> {
    run_compose_async(app, Some(project), files, vec!["stop"]).await
}

#[command]
pub async fn docker_compose_restart(
    app: AppHandle,
    project: String,
    files: Vec<String>,
) -> Result<String, String> {
    run_compose_async(app, Some(project), files, vec!["restart"]).await
}

#[command]
pub async fn docker_compose_down(
    app: AppHandle,
    project: String,
    files: Vec<String>,
) -> Result<String, String> {
    run_compose_async(app, Some(project), files, vec!["down"]).await
}
