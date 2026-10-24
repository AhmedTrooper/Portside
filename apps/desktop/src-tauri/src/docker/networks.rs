//! Network management commands.
//!
//! Owns the shared `NetworkOpsMap` (an `Arc<RwLock<HashMap<...>>>`) which is
//! the single source of truth for every network operation the app starts.
//! Each `docker network create` / `docker network rm` runs on a background
//! thread; progress is pushed into the map and broadcast to the frontend as
//! `network-operation-update` Tauri events so the UI can render a live
//! status panel.
//!
//! Mirrors `images.rs` exactly so the frontend can reuse the same ActiveOps
//! pattern. The map is bounded by what the user kicks off; finished ops are
//! kept for a few seconds in the UI before being garbage-collected on the
//! frontend.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::thread;
use tauri::{command, AppHandle, Emitter};

use super::{docker_command, now_ms};

// =============================================================================
// Public types
// =============================================================================

/// Distinguishes a create from a remove. Serializes as lowercase strings.
#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkOpKind {
    Create,
    Remove,
}

/// Lifecycle of a network operation. Drives the frontend status pill.
#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkOpStatus {
    Running,
    Done,
    Error,
    Cancelled,
}

/// A single network operation. Lives in the shared `NetworkOpsMap` until
/// garbage-collected by the frontend after a few seconds.
#[derive(Clone, Serialize)]
pub struct NetworkOperation {
    pub id: String,
    pub kind: NetworkOpKind,
    pub target: String,
    pub status: NetworkOpStatus,
    pub started_at_ms: u64,
    pub finished_at_ms: Option<u64>,
    pub message: Option<String>,
}

/// Shared state of every network operation in this app session.
pub type NetworkOpsMap = Arc<RwLock<HashMap<String, NetworkOperation>>>;

pub fn new_ops_map() -> NetworkOpsMap {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Snapshot every network operation currently tracked. Returns a plain
/// `Vec<NetworkOperation>` so the frontend can seed its own UI after a
/// reload (covers in-flight creates/removes that started before the panel
/// mounted).
#[command]
pub fn get_network_operations(state: tauri::State<'_, NetworkOpsMap>) -> Vec<NetworkOperation> {
    state
        .read()
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default()
}

// =============================================================================
// Internal helpers
// =============================================================================

fn emit_update(app: &AppHandle, op: &NetworkOperation) {
    let _ = app.emit("network-operation-update", op);
}

fn finish_op(
    app: &AppHandle,
    state: &NetworkOpsMap,
    id: &str,
    success: bool,
    message: Option<String>,
) {
    if let Ok(mut map) = state.write() {
        if let Some(op) = map.get_mut(id) {
            op.status = if success {
                NetworkOpStatus::Done
            } else {
                NetworkOpStatus::Error
            };
            op.finished_at_ms = Some(now_ms());
            op.message = message;
            emit_update(app, op);
        }
    }
}

// =============================================================================
// docker_create_network
// -----------------------------------------------------------------------------
// Wraps `docker network create <name>`. Registers the op in the shared map so
// the UI shows a brief "Creating ..." pill until the command returns.
// =============================================================================
#[command]
pub fn docker_create_network(
    app: AppHandle,
    state: tauri::State<'_, NetworkOpsMap>,
    name: String,
) -> Result<String, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Network name cannot be empty.".to_string());
    }
    if trimmed.contains(' ') {
        return Err("Network name must not contain spaces.".to_string());
    }

    let id = format!("create-{}-{}", trimmed, now_ms());
    let op = NetworkOperation {
        id: id.clone(),
        kind: NetworkOpKind::Create,
        target: trimmed.clone(),
        status: NetworkOpStatus::Running,
        started_at_ms: now_ms(),
        finished_at_ms: None,
        message: None,
    };
    state.write().unwrap().insert(id.clone(), op.clone());
    emit_update(&app, &op);

    let app_w = app.clone();
    let state_w = state.inner().clone();
    let id_w = id.clone();
    let name_w = trimmed;

    thread::spawn(move || {
        // `docker network create` writes the new network's ID to stdout on
        // success. Stash it so the UI can show a useful finish message.
        let output = docker_command()
            .args(["network", "create", &name_w])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
                let msg = if stdout.is_empty() {
                    None
                } else {
                    Some(format!(
                        "Created network {} ({})",
                        name_w,
                        short_id(&stdout)
                    ))
                };
                finish_op(&app_w, &state_w, &id_w, true, msg);
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                finish_op(&app_w, &state_w, &id_w, false, Some(stderr));
            }
            Err(e) => {
                finish_op(&app_w, &state_w, &id_w, false, Some(e.to_string()));
            }
        }
        let _ = app_w.emit("docker-networks-changed", ());
    });

    Ok(id)
}

// =============================================================================
// docker_remove_network
// -----------------------------------------------------------------------------
// Wraps `docker network rm <name>`. Registers the op in the shared map so
// the UI shows a brief "Removing ..." pill until the command returns.
// =============================================================================
#[command]
pub fn docker_remove_network(
    app: AppHandle,
    state: tauri::State<'_, NetworkOpsMap>,
    name: String,
) -> Result<String, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Network name cannot be empty.".to_string());
    }

    let id = format!("rm-{}-{}", trimmed, now_ms());
    let op = NetworkOperation {
        id: id.clone(),
        kind: NetworkOpKind::Remove,
        target: trimmed.clone(),
        status: NetworkOpStatus::Running,
        started_at_ms: now_ms(),
        finished_at_ms: None,
        message: None,
    };
    state.write().unwrap().insert(id.clone(), op.clone());
    emit_update(&app, &op);

    let app_w = app.clone();
    let state_w = state.inner().clone();
    let id_for_thread = id.clone();
    let id_for_return = id;

    // Build owned `String` args so they live as long as the worker thread
    // (the closure is `'static + Send`). Using `&str` here would tie the
    // worker's lifetime to the outer function frame and cause borrow errors.
    let args: Vec<String> = vec!["network".to_string(), "rm".to_string(), trimmed];

    thread::spawn(move || {
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let output = docker_command().args(&arg_refs).output();

        match output {
            Ok(o) if o.status.success() => {
                let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
                let final_msg = if stdout.is_empty() {
                    None
                } else {
                    Some(stdout)
                };
                finish_op(&app_w, &state_w, &id_for_thread, true, final_msg);
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                finish_op(&app_w, &state_w, &id_for_thread, false, Some(stderr));
            }
            Err(e) => {
                finish_op(&app_w, &state_w, &id_for_thread, false, Some(e.to_string()));
            }
        }
        let _ = app_w.emit("docker-networks-changed", ());
    });

    Ok(id_for_return)
}

/// Trim a docker network ID down to its 12-char prefix for display.
fn short_id(id: &str) -> &str {
    if id.len() > 12 {
        &id[..12]
    } else {
        id
    }
}
