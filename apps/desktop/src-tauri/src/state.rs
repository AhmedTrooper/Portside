use crate::docker;
use serde::Serialize;
use serde_json::Value;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Default, Clone, Serialize, PartialEq)]
pub struct DockerStateData {
    pub containers: Vec<Value>,
    pub images: Vec<Value>,
    pub networks: Vec<Value>,
}

#[derive(Default, Clone, Serialize, PartialEq)]
pub struct GlobalStateData {
    pub docker: DockerStateData,
    // Add AWS, Git, etc. here in the future
}

#[derive(Default)]
pub struct AppState {
    pub data: Arc<RwLock<GlobalStateData>>,
}

/// Tauri command: snapshot the entire global state for the frontend. Returns
/// the unwrapped `GlobalStateData` shape so the frontend can use the exact
/// same narrow logic for the initial fetch and for `global-state-updated`
/// events — there is no `{state: ...}` envelope.
#[tauri::command]
pub fn get_global_state(state: tauri::State<AppState>) -> GlobalStateData {
    state.data.read().unwrap().clone()
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

pub fn init(app: &mut tauri::App) {
    let state = AppState::default();
    let state_clone = state.data.clone();

    app.manage(state);

    let handle = app.handle().clone();

    thread::spawn(move || loop {
        let mut new_state = GlobalStateData::default();

        // 1. Fetch Docker Containers.
        if let Ok(output) = docker::docker_command()
            .args(["ps", "-a", "--format", "{{json .}}"])
            .output()
        {
            if output.status.success() {
                let mut containers = parse_jsonl(&output.stdout);
                // Sort containers by name so the UI shows a stable order.
                containers.sort_by(|a, b| {
                    let name_a = a.get("Names").and_then(|n| n.as_str()).unwrap_or("");
                    let name_b = b.get("Names").and_then(|n| n.as_str()).unwrap_or("");
                    name_a.cmp(name_b)
                });
                new_state.docker.containers = containers;
            }
        }

        // 2. Fetch Docker Images.
        if let Ok(output) = docker::docker_command()
            .args(["images", "--format", "{{json .}}"])
            .output()
        {
            if output.status.success() {
                new_state.docker.images = parse_jsonl(&output.stdout);
            }
        }

        // 3. Fetch Docker Networks.
        if let Ok(output) = docker::docker_command()
            .args(["network", "ls", "--format", "{{json .}}"])
            .output()
        {
            if output.status.success() {
                new_state.docker.networks = parse_jsonl(&output.stdout);
            }
        }

        // Compare and update.
        let is_different = if let Ok(mut data) = state_clone.write() {
            if *data != new_state {
                *data = new_state.clone();
                true
            } else {
                false
            }
        } else {
            false
        };

        if is_different {
            // Emit the unwrapped shape so the listener shares the same
            // parse path as `invoke("get_global_state")`.
            let _ = handle.emit("global-state-updated", new_state);
        }

        // Flush every 60 seconds.
        thread::sleep(Duration::from_secs(60));
    });
}
