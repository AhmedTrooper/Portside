use crate::docker;
use serde::Serialize;
use serde_json::Value;
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Default, Clone, Serialize, PartialEq)]
pub struct DockerStateData {
    pub containers: Vec<Value>,
    pub images: Vec<Value>,
    pub networks: Vec<Value>,
    pub volumes: Vec<Value>,
    pub compose_projects: Vec<Value>,
}

#[derive(Default, Clone, Serialize, PartialEq)]
pub struct GlobalStateData {
    pub docker: DockerStateData,
    // Add AWS, Git, etc. here in the future
}

#[derive(Default)]
pub struct AppState {
    pub data: Arc<RwLock<GlobalStateData>>,
    /// Serializes Docker reads so a slow background poll cannot overwrite a
    /// newer snapshot fetched after a container/Compose action.
    pub refresh_lock: Arc<Mutex<()>>,
}

/// Tauri command: snapshot the entire global state for the frontend. Returns
/// the unwrapped `GlobalStateData` shape so the frontend can use the exact
/// same narrow logic for the initial fetch and for `global-state-updated`
/// events — there is no `{state: ...}` envelope.
#[tauri::command]
pub fn get_global_state(state: tauri::State<AppState>) -> GlobalStateData {
    state.data.read().unwrap().clone()
}

/// Fetch the current Docker state immediately instead of waiting for the
/// 60-second background poll. The frontend calls this after a mutation so a
/// successful stop/start/remove is reflected as soon as the Docker command
/// returns.
#[tauri::command]
pub async fn refresh_global_state(app: tauri::AppHandle) -> Result<GlobalStateData, String> {
    let (data, refresh_lock) = {
        let state = app.state::<AppState>();
        (state.data.clone(), state.refresh_lock.clone())
    };

    let (new_state, changed) =
        tauri::async_runtime::spawn_blocking(move || refresh_locked(&data, &refresh_lock))
            .await
            .map_err(|e| format!("Failed to refresh Docker state: {e}"))??;

    if changed {
        let _ = app.emit("global-state-updated", new_state.clone());
    }

    Ok(new_state)
}

/// Parse `docker <subcmd> --format '{{json .}}'` output into a Vec of JSON
/// objects. One line per record; bad lines are silently skipped so a single
/// corrupt entry doesn't poison the whole list.
fn parse_jsonl(stdout: &[u8]) -> Vec<Value> {
    let text = String::from_utf8_lossy(stdout);
    let mut out = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
            out.push(v);
        }
    }
    out
}

fn fetch_jsonl(resource: &str, args: &[&str]) -> Result<Vec<Value>, String> {
    let output = docker::docker_command()
        .args(args)
        .output()
        .map_err(|e| format!("Could not run docker {resource}: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Could not list Docker {resource}.")
        } else {
            format!("Could not list Docker {resource}: {stderr}")
        });
    }

    Ok(parse_jsonl(&output.stdout))
}

fn sort_by_field(items: &mut [Value], field: &str) {
    items.sort_by(|a, b| {
        let left = a.get(field).and_then(Value::as_str).unwrap_or("");
        let right = b.get(field).and_then(Value::as_str).unwrap_or("");
        left.cmp(right)
    });
}

fn fetch_compose_projects() -> Vec<Value> {
    let output = match docker::docker_command()
        .args(["compose", "ls", "-a", "--format", "json"])
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };

    let mut projects = serde_json::from_slice::<Vec<Value>>(&output.stdout)
        .unwrap_or_else(|_| parse_jsonl(&output.stdout));
    sort_by_field(&mut projects, "Name");
    projects
}

fn fetch_global_state() -> Result<GlobalStateData, String> {
    let mut containers = fetch_jsonl("containers", &["ps", "-a", "--format", "{{json .}}"])?;
    sort_by_field(&mut containers, "Names");

    let mut images = fetch_jsonl("images", &["images", "--format", "{{json .}}"])?;
    images.sort_by(|a, b| {
        let repo_a = a.get("Repository").and_then(Value::as_str).unwrap_or("");
        let repo_b = b.get("Repository").and_then(Value::as_str).unwrap_or("");
        let tag_a = a.get("Tag").and_then(Value::as_str).unwrap_or("");
        let tag_b = b.get("Tag").and_then(Value::as_str).unwrap_or("");
        repo_a.cmp(repo_b).then(tag_a.cmp(tag_b))
    });

    let mut networks = fetch_jsonl("networks", &["network", "ls", "--format", "{{json .}}"])?;
    sort_by_field(&mut networks, "Name");

    let mut volumes = fetch_jsonl("volumes", &["volume", "ls", "--format", "{{json .}}"])?;
    sort_by_field(&mut volumes, "Name");

    let compose_projects = fetch_compose_projects();

    Ok(GlobalStateData {
        docker: DockerStateData {
            containers,
            images,
            networks,
            volumes,
            compose_projects,
        },
    })
}

fn refresh_locked(
    data: &RwLock<GlobalStateData>,
    refresh_lock: &Mutex<()>,
) -> Result<(GlobalStateData, bool), String> {
    let _guard = refresh_lock
        .lock()
        .map_err(|_| "Docker refresh lock is poisoned.".to_string())?;
    let new_state = fetch_global_state()?;
    let mut current = data
        .write()
        .map_err(|_| "Docker state lock is poisoned.".to_string())?;
    let changed = *current != new_state;
    if changed {
        *current = new_state.clone();
    }
    Ok((new_state, changed))
}

pub fn init(app: &mut tauri::App) {
    let state = AppState::default();
    let state_data = state.data.clone();
    let refresh_lock = state.refresh_lock.clone();

    app.manage(state);

    let handle = app.handle().clone();

    thread::spawn(move || loop {
        match refresh_locked(&state_data, &refresh_lock) {
            Ok((new_state, changed)) => {
                if changed {
                    // Emit the unwrapped shape so the listener shares the same
                    // parse path as `invoke("refresh_global_state")`.
                    let _ = handle.emit("global-state-updated", new_state);
                }
            }
            Err(error) => {
                eprintln!("Docker state refresh failed: {error}");
            }
        }

        thread::sleep(Duration::from_secs(60));
    });
}
