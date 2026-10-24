//! Image management commands.
//!
//! Owns the shared `ImageOpsMap` (an `Arc<RwLock<HashMap<...>>>`) which is the
//! single source of truth for every image operation the app starts. Each
//! `docker pull` / `docker rmi` runs on a background thread; progress is
//! pushed into the map and broadcast to the frontend as `image-operation-update`
//! Tauri events so the UI can render a live status panel.
//!
//! The map is bounded by what the user kicks off — it does not auto-prune
//! because finished operations are useful for a few seconds while the UI shows
//! a "Done"/"Error" pill. The frontend is responsible for garbage-collecting
//! old entries from its own mirror state.

use super::{docker_command, now_ms};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{ExitStatus, Stdio};
use std::sync::{Arc, RwLock};
use std::thread;
use tauri::{command, AppHandle, Emitter};

// =============================================================================
// Public types
// =============================================================================

/// Distinguishes a pull from a remove. Serializes as lowercase strings.
#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageOpKind {
    Pull,
    Remove,
}

/// Lifecycle of an image operation. Drives the frontend status pill.
#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageOpStatus {
    Running,
    Done,
    Error,
    Cancelled,
}

/// Per-layer pull progress. Aggregated on the frontend for the top-level bar.
#[derive(Clone, Serialize)]
pub struct LayerProgress {
    pub id: String,
    pub current: u64,
    pub total: u64,
}

/// A single image operation. Lives in the shared `ImageOpsMap` until
/// garbage-collected by the frontend after a few seconds.
#[derive(Clone, Serialize)]
pub struct ImageOperation {
    pub id: String,
    pub kind: ImageOpKind,
    pub target: String,
    pub status: ImageOpStatus,
    pub started_at_ms: u64,
    pub finished_at_ms: Option<u64>,
    pub message: Option<String>,
    pub layers: HashMap<String, LayerProgress>,
}

/// Shared state of every image operation in this app session.
pub type ImageOpsMap = Arc<RwLock<HashMap<String, ImageOperation>>>;

pub fn new_ops_map() -> ImageOpsMap {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Snapshot every image operation currently tracked. Returns a plain
/// `Vec<ImageOperation>` so the frontend can seed its own UI after a reload
/// (covers in-flight pulls/removes that started before the panel mounted).
#[command]
pub fn get_image_operations(state: tauri::State<'_, ImageOpsMap>) -> Vec<ImageOperation> {
    state
        .read()
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default()
}

// =============================================================================
// Internal helpers
// =============================================================================

fn emit_update(app: &AppHandle, op: &ImageOperation) {
    // We don't care if the emit fails (e.g. window not ready); the next
    // update will catch the listener up.
    let _ = app.emit("image-operation-update", op);
}

fn finish_op(
    app: &AppHandle,
    state: &ImageOpsMap,
    id: &str,
    success: bool,
    message: Option<String>,
) {
    if let Ok(mut map) = state.write() {
        if let Some(op) = map.get_mut(id) {
            op.status = if success {
                ImageOpStatus::Done
            } else {
                ImageOpStatus::Error
            };
            op.finished_at_ms = Some(now_ms());
            op.message = message;
            emit_update(app, op);
        }
    }
}

// =============================================================================
// docker_pull_image
// -----------------------------------------------------------------------------
// Spawns `docker pull <repo>` in a worker thread, parses streaming stderr
// progress lines, and emits `image-operation-update` events for every
// meaningful change. Returns the new operation's id.
// =============================================================================
#[command]
pub fn docker_pull_image(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    repository: String,
) -> Result<String, String> {
    let id = format!("pull-{}-{}", repository, now_ms());
    let op = ImageOperation {
        id: id.clone(),
        kind: ImageOpKind::Pull,
        target: repository.clone(),
        status: ImageOpStatus::Running,
        started_at_ms: now_ms(),
        finished_at_ms: None,
        message: None,
        layers: HashMap::new(),
    };
    state.write().unwrap().insert(id.clone(), op.clone());
    emit_update(&app, &op);

    let app_w = app.clone();
    let state_w = state.inner().clone();
    let id_w = id.clone();
    let repo_w = repository.clone();

    thread::spawn(move || {
        let mut child = match docker_command()
            .args(["pull", &repo_w])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                finish_op(&app_w, &state_w, &id_w, false, Some(e.to_string()));
                return;
            }
        };

        // Drain stderr in its own thread so progress lines update the shared
        // map while the parent waits for the child to exit.
        let stderr = child.stderr.take();
        let app_p = app_w.clone();
        let state_p = state_w.clone();
        let id_p = id_w.clone();
        let _ = thread::spawn(move || {
            if let Some(err_pipe) = stderr {
                let reader = BufReader::new(err_pipe);
                for line in reader.lines().map_while(Result::ok) {
                    parse_pull_line(&app_p, &state_p, &id_p, &line);
                }
            }
        });

        let status: ExitStatus = child.wait().unwrap_or_default();

        // Capture stdout for the final message (often "Status: ..." lines).
        let mut final_msg: Option<String> = None;
        if let Some(mut out) = child.stdout.take() {
            let mut s = String::new();
            if out.read_to_string(&mut s).is_ok() {
                for line in s.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("Status:") || trimmed.starts_with("Digest:") {
                        final_msg = Some(trimmed.to_string());
                        break;
                    }
                }
            }
        }

        let msg = if status.success() {
            final_msg
        } else {
            Some("docker pull failed".to_string())
        };
        finish_op(&app_w, &state_w, &id_w, status.success(), msg);

        // Tell the UI a pull finished so it can refresh on demand
        // (otherwise the user waits up to 60s for the next poll tick).
        let _ = app_w.emit("docker-images-changed", ());
    });

    Ok(id)
}

// =============================================================================
// docker_remove_image
// -----------------------------------------------------------------------------
// Wraps `docker rmi [-f] <id>`. Registers the op in the shared map so the UI
// shows a brief "Removing ..." pill until the command returns.
// =============================================================================
#[command]
pub fn docker_remove_image(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    id: String,
    force: bool,
) -> Result<String, String> {
    let op_id = format!("rm-{}-{}", &id, now_ms());

    // Build owned `String` args so they live as long as the worker thread
    // (the closure is `'static + Send`). Using `&str` here would tie the
    // worker's lifetime to the outer function frame and cause borrow errors.
    let mut args: Vec<String> = Vec::with_capacity(if force { 3 } else { 2 });
    args.push("rmi".to_string());
    if force {
        args.push("-f".to_string());
    }
    args.push(id.clone());

    let op = ImageOperation {
        id: op_id.clone(),
        kind: ImageOpKind::Remove,
        target: id.clone(),
        status: ImageOpStatus::Running,
        started_at_ms: now_ms(),
        finished_at_ms: None,
        message: None,
        layers: HashMap::new(),
    };
    state.write().unwrap().insert(op_id.clone(), op.clone());
    emit_update(&app, &op);

    let app_w = app.clone();
    let state_w = state.inner().clone();
    let op_id_w = op_id.clone();

    thread::spawn(move || {
        // Defer to a String -> &str conversion at the very last moment so
        // `Command::args` sees a temporary slice without holding borrows on
        // the underlying storage for the duration of `output()`.
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let output = docker_command().args(&arg_refs).output();
        match output {
            Ok(o) if o.status.success() => {
                let msg = String::from_utf8_lossy(&o.stdout).trim().to_string();
                let final_msg = if msg.is_empty() { None } else { Some(msg) };
                finish_op(&app_w, &state_w, &op_id_w, true, final_msg);
            }
            Ok(o) => {
                let msg = String::from_utf8_lossy(&o.stderr).trim().to_string();
                finish_op(&app_w, &state_w, &op_id_w, false, Some(msg));
            }
            Err(e) => {
                finish_op(&app_w, &state_w, &op_id_w, false, Some(e.to_string()));
            }
        }
        // `id` moved into `args` above; the original `id` ownership is now
        // owned by the local `args` Vec which drops at end of scope.
        // Emit a generic change signal — the consumer doesn't need the id.
        let _ = app_w.emit("docker-images-changed", ());
    });

    Ok(op_id)
}

// =============================================================================
// Internal: pull-progress line parsing.
//
// `docker pull` writes lines like:
//
//     a1b2c3d4e5f6: Pulling fs layer
//     a1b2c3d4e5f6: Downloading   [==>     ]   1.2MB/5.4MB
//     a1b2c3d4e5f6: Pull complete
//     a1b2c3d4e5f6: Extracting    [===>     ]    3MB/5.4MB
//     Digest: sha256:...
//     Status: Downloaded newer image for nginx:latest
//
// We only act on the `Downloading [..] CUR/TOTAL` pattern. Other lines are
// ignored here and surface as the operation's final message instead.
// =============================================================================

fn parse_pull_line(app: &AppHandle, state: &ImageOpsMap, id: &str, line: &str) {
    // Split "layer: rest" at the FIRST colon. Layer IDs are sha256 prefixes
    // and don't contain colons; "Digest: sha256:..." has a colon in `rest` but
    // we only act on lines starting with a 64-char-ish hex prefix, so this
    // single split is unambiguous.
    let mut chars = line.char_indices();
    let Some(colon_offset) = chars.find_map(|(i, c)| if c == ':' { Some(i) } else { None }) else {
        return;
    };

    let layer_id = &line[..colon_offset];
    let rest = line[colon_offset + 1..].trim_start();

    // We only recognise "Downloading [..] CUR/TOTAL". Other prefixes
    // (Extracting / Pulling / Pull complete / Status / Digest) are ignored.
    if !rest.starts_with("Downloading ") {
        return;
    }
    let payload = &rest["Downloading ".len()..];

    let Some((cur, total)) = parse_bracket_progress(payload) else {
        return;
    };

    if let Ok(mut map) = state.write() {
        if let Some(op) = map.get_mut(id) {
            let layer = LayerProgress {
                id: layer_id.to_string(),
                current: cur,
                total,
            };
            op.layers.insert(layer_id.to_string(), layer);
            emit_update(app, op);
        }
    }
}

/// Look for a `CUR/TOTAL` pair in `s`, returning (bytes_so_far, total_bytes).
/// Looks for a slash-separated token where both sides look like `<number><unit>`.
fn parse_bracket_progress(s: &str) -> Option<(u64, u64)> {
    let tokens = s.split_whitespace();
    for tok in tokens {
        if let Some(slash) = tok.find('/') {
            let left = &tok[..slash];
            let right = &tok[slash + 1..];
            if let (Some(cur), Some(total)) = (parse_size_token(left), parse_size_token(right)) {
                return Some((cur, total));
            }
        }
    }
    None
}

/// Parse a token like "1.2MB" or "5.4GB" into bytes.
fn parse_size_token(tok: &str) -> Option<u64> {
    if tok.is_empty() {
        return None;
    }

    // Walk from the left, accepting digits and at most one decimal point.
    let bytes = tok.as_bytes();
    let mut split_at = 0;
    let mut saw_digit = false;
    let mut saw_dot = false;
    for (i, &b) in bytes.iter().enumerate() {
        if b.is_ascii_digit() {
            saw_digit = true;
            split_at = i + 1;
        } else if b == b'.' && !saw_dot {
            saw_dot = true;
            split_at = i + 1;
        } else {
            break;
        }
    }

    if !saw_digit {
        return None;
    }

    let num_str = &tok[..split_at];
    let unit_str = &tok[split_at..];

    let n: f64 = num_str.parse().ok()?;
    let unit_upper = unit_str.to_uppercase();

    let multiplier: f64 = match unit_upper.as_str() {
        "" | "B" => 1.0,
        "KB" | "KIB" => 1024.0,
        "MB" | "MIB" => 1024.0 * 1024.0,
        "GB" | "GIB" => 1024.0 * 1024.0 * 1024.0,
        "TB" | "TIB" => 1024.0_f64.powi(4),
        _ => return None,
    };

    Some((n * multiplier) as u64)
}
