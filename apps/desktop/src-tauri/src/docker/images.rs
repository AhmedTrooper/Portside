//! Image management commands.
//!
//! Owns the shared `ImageOpsMap` (an `Arc<RwLock<HashMap<...>>>`) which is the
//! single source of truth for every image operation the app starts. Each
//! CLI pull/remove/push/build/save/load/prune runs on background threads; progress is
//! pushed into the map and broadcast to the frontend as `image-operation-update`
//! Tauri events so the UI can render a live status panel.
//!
//! The map is bounded by what the user kicks off — it does not auto-prune
//! because finished operations are useful for a few seconds while the UI shows
//! a "Done"/"Error" pill. The frontend is responsible for garbage-collecting
//! old entries from its own mirror state.

use super::{docker_command, now_ms, run_docker};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::thread;
use tauri::{command, AppHandle, Emitter};

// =============================================================================
// Public types
// =============================================================================

/// Image CLI workflow. Serializes as lowercase strings.
#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageOpKind {
    Pull,
    Remove,
    Push,
    Build,
    Save,
    Load,
    Prune,
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
    pub log: String,
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
    let repository = validate_reference(&repository)?;
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Pull,
        repository.clone(),
        vec!["pull".into(), repository],
    )
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
    let id = validate_reference(&id)?;
    let mut args = vec!["image".into(), "rm".into()];
    if force {
        args.push("-f".to_string());
    }
    args.push(id.clone());

    start_operation(app, state.inner().clone(), ImageOpKind::Remove, id, args)
}

fn validate_reference(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty()
        || value.starts_with('-')
        || value.chars().any(|c| c.is_whitespace() || c == '\0')
    {
        return Err("Provide a non-empty image reference without spaces or leading flags.".into());
    }
    Ok(value.into())
}

fn validate_path(value: &str, must_exist: bool, directory: bool) -> Result<String, String> {
    let path = Path::new(value.trim());
    if !path.is_absolute() || value.contains('\0') {
        return Err("Choose an absolute file or folder path.".into());
    }
    if must_exist
        && (if directory {
            !path.is_dir()
        } else {
            !path.is_file()
        })
    {
        return Err("The selected file or folder does not exist.".into());
    }
    if !must_exist
        && (!path.parent().is_some_and(Path::is_dir) || path.file_name().is_none() || path.is_dir())
    {
        return Err("Choose a filename in an existing folder.".into());
    }
    Ok(path.to_string_lossy().into_owned())
}

static NEXT_OPERATION: AtomicU64 = AtomicU64::new(1);
const MAX_LOG_BYTES: usize = 64 * 1024;

fn append_log(log: &mut String, line: &str) {
    log.push_str(line);
    log.push('\n');
    if log.len() > MAX_LOG_BYTES {
        let mut offset = log.len() - MAX_LOG_BYTES;
        while !log.is_char_boundary(offset) {
            offset += 1;
        }
        log.drain(..offset);
    }
}

fn consume_output<R: std::io::Read>(
    reader: R,
    app: &AppHandle,
    state: &ImageOpsMap,
    id: &str,
) -> Result<(), String> {
    let mut reader = BufReader::new(reader);
    let mut bytes = Vec::new();
    loop {
        bytes.clear();
        if reader
            .read_until(b'\n', &mut bytes)
            .map_err(|e| e.to_string())?
            == 0
        {
            break;
        }
        // Docker/build output need not be UTF-8; never stop draining a pipe over it.
        let line = String::from_utf8_lossy(&bytes).trim_end().to_string();
        parse_pull_line(app, state, id, &line);
        if let Ok(mut map) = state.write() {
            if let Some(op) = map.get_mut(id) {
                append_log(&mut op.log, &line);
                op.message = Some(line);
                emit_update(app, op);
            }
        }
    }
    Ok(())
}

fn start_operation(
    app: AppHandle,
    state: ImageOpsMap,
    kind: ImageOpKind,
    target: String,
    args: Vec<String>,
) -> Result<String, String> {
    let id = format!(
        "image-{}-{}",
        now_ms(),
        NEXT_OPERATION.fetch_add(1, Ordering::Relaxed)
    );
    let op = ImageOperation {
        id: id.clone(),
        kind,
        target,
        status: ImageOpStatus::Running,
        started_at_ms: now_ms(),
        finished_at_ms: None,
        message: None,
        layers: HashMap::new(),
        log: String::new(),
    };
    {
        let mut map = state
            .write()
            .map_err(|_| "Image operation state is unavailable.")?;
        // Keep running work and a bounded recent history, even across page unmounts.
        if map.len() >= 100 {
            let oldest = map
                .values()
                .filter(|op| op.finished_at_ms.is_some())
                .min_by_key(|op| op.started_at_ms)
                .map(|op| op.id.clone());
            if let Some(oldest) = oldest {
                map.remove(&oldest);
            }
        }
        map.insert(id.clone(), op.clone());
    }
    emit_update(&app, &op);
    let worker_id = id.clone();
    thread::spawn(move || {
        let result = (|| -> Result<bool, String> {
            let mut child = docker_command()
                .args(args)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| e.to_string())?;
            let stderr = child
                .stderr
                .take()
                .ok_or("Docker stderr was unavailable.")?;
            let stdout = child
                .stdout
                .take()
                .ok_or("Docker stdout was unavailable.")?;
            let app_err = app.clone();
            let state_err = state.clone();
            let id_err = worker_id.clone();
            let errors =
                thread::spawn(move || consume_output(stderr, &app_err, &state_err, &id_err));
            let out_result = consume_output(stdout, &app, &state, &worker_id);
            let err_result = errors.join().map_err(|_| "Docker output reader failed.")?;
            let status = child.wait().map_err(|e| e.to_string())?;
            out_result?;
            err_result?;
            Ok(status.success())
        })();
        let message = match &result {
            Err(error) => Some(error.clone()),
            Ok(success) => state
                .read()
                .ok()
                .and_then(|map| map.get(&worker_id).and_then(|op| op.message.clone()))
                .or_else(|| {
                    Some(
                        if *success {
                            "Completed."
                        } else {
                            "Docker command failed."
                        }
                        .into(),
                    )
                }),
        };
        finish_op(
            &app,
            &state,
            &worker_id,
            matches!(result, Ok(true)),
            message,
        );
        // Failure may still have changed layers/tags, so always read fresh state.
        let _ = app.emit("docker-images-changed", ());
    });
    Ok(id)
}

#[command]
pub async fn docker_inspect_image(id: String) -> Result<Value, String> {
    let id = validate_reference(&id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let raw = run_docker(["image", "inspect", &id])?;
        let mut data: Vec<Value> = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        data.pop().ok_or("Docker returned no image details.".into())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_image_history(id: String) -> Result<Vec<Value>, String> {
    let id = validate_reference(&id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let raw = run_docker([
            "image",
            "history",
            "--no-trunc",
            "--format",
            "{{json .}}",
            &id,
        ])?;
        raw.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).map_err(|e| e.to_string()))
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_search_images(query: String) -> Result<Vec<Value>, String> {
    let query = query.trim().to_string();
    if query.is_empty() || query.starts_with('-') || query.contains('\0') {
        return Err("Enter a Docker Hub search term.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let raw = run_docker(["search", "--limit", "25", "--format", "{{json .}}", &query])?;
        raw.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).map_err(|e| e.to_string()))
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn docker_tag_image(app: AppHandle, id: String, reference: String) -> Result<(), String> {
    let id = validate_reference(&id)?;
    let reference = validate_reference(&reference)?;
    let result =
        tauri::async_runtime::spawn_blocking(move || run_docker(["image", "tag", &id, &reference]))
            .await
            .map_err(|e| e.to_string())?;
    let _ = app.emit("docker-images-changed", ());
    result.map(|_| ())
}

#[command]
pub fn docker_push_image(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    reference: String,
) -> Result<String, String> {
    let reference = validate_reference(&reference)?;
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Push,
        reference.clone(),
        vec!["push".into(), reference],
    )
}

#[command]
pub fn docker_save_image(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    id: String,
    path: String,
) -> Result<String, String> {
    let id = validate_reference(&id)?;
    let path = validate_path(&path, false, false)?;
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Save,
        path.clone(),
        vec!["image".into(), "save".into(), "--output".into(), path, id],
    )
}

#[command]
pub fn docker_load_images(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    path: String,
) -> Result<String, String> {
    let path = validate_path(&path, true, false)?;
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Load,
        path.clone(),
        vec!["image".into(), "load".into(), "--input".into(), path],
    )
}

#[command]
pub fn docker_prune_images(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    all: bool,
) -> Result<String, String> {
    let mut args = vec!["image".into(), "prune".into(), "--force".into()];
    if all {
        args.push("--all".into());
    }
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Prune,
        if all {
            "All unused images"
        } else {
            "Dangling images"
        }
        .into(),
        args,
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageBuildOptions {
    pub context: String,
    pub dockerfile: Option<String>,
    pub tags: Vec<String>,
    pub build_args: Vec<String>,
    pub target: Option<String>,
    pub no_cache: bool,
    pub pull: bool,
}

#[command]
pub fn docker_build_image(
    app: AppHandle,
    state: tauri::State<'_, ImageOpsMap>,
    options: ImageBuildOptions,
) -> Result<String, String> {
    let context = validate_path(&options.context, true, true)?;
    if options.tags.is_empty() {
        return Err("Give the built image at least one tag.".into());
    }
    let mut args = vec!["build".into(), "--progress=plain".into()];
    for tag in &options.tags {
        args.extend(["--tag".into(), validate_reference(tag)?]);
    }
    if let Some(file) = &options.dockerfile {
        if !file.trim().is_empty() {
            args.extend(["--file".into(), validate_path(file, true, false)?]);
        }
    }
    for arg in &options.build_args {
        validate_assignment(arg)?;
        args.push(format!("--build-arg={arg}"));
    }
    if let Some(target) = &options.target {
        if !target.trim().is_empty() {
            args.extend(["--target".into(), validate_reference(target)?]);
        }
    }
    if options.no_cache {
        args.push("--no-cache".into());
    }
    if options.pull {
        args.push("--pull".into());
    }
    args.push(context);
    start_operation(
        app,
        state.inner().clone(),
        ImageOpKind::Build,
        options.tags.join(", "),
        args,
    )
}

fn validate_assignment(value: &str) -> Result<(), String> {
    let key = value.split_once('=').map(|(key, _)| key).unwrap_or("");
    if key.is_empty()
        || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        || value.contains('\0')
    {
        return Err("Use KEY=value for environment variables and build arguments.".into());
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRunOptions {
    pub image: String,
    pub name: Option<String>,
    pub ports: Vec<String>,
    pub environment: Vec<String>,
    pub volumes: Vec<String>,
    pub network: Option<String>,
    pub command: Vec<String>,
    pub auto_remove: bool,
}

fn run_args(options: ImageRunOptions) -> Result<Vec<String>, String> {
    let image = validate_reference(&options.image)?;
    let mut args = vec!["run".into(), "--detach".into(), "--pull=never".into()];
    if let Some(name) = options.name {
        if !name.trim().is_empty() {
            args.extend(["--name".into(), validate_reference(&name)?]);
        }
    }
    if let Some(network) = options.network {
        if !network.trim().is_empty() {
            args.extend(["--network".into(), validate_reference(&network)?]);
        }
    }
    for port in options.ports {
        args.push(format!("--publish={}", validate_reference(&port)?));
    }
    for variable in options.environment {
        validate_assignment(&variable)?;
        args.push(format!("--env={variable}"));
    }
    for volume in options.volumes {
        if volume.trim().is_empty() || volume.contains('\0') {
            return Err("Volume mappings cannot be empty.".into());
        }
        args.push(format!("--volume={volume}"));
    }
    if options.command.iter().any(|arg| arg.contains('\0')) {
        return Err("Command arguments cannot contain NUL characters.".into());
    }
    if options.auto_remove {
        args.push("--rm".into());
    }
    args.push(image);
    args.extend(options.command);
    Ok(args)
}

#[command]
pub async fn docker_run_image(app: AppHandle, options: ImageRunOptions) -> Result<String, String> {
    let args = run_args(options)?;
    let result = tauri::async_runtime::spawn_blocking(move || run_docker(args))
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.emit("docker-containers-changed", ());
    result
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_references_cannot_be_flags() {
        for value in ["", "  ", "--all", "nginx latest", "nginx\0"] {
            assert!(validate_reference(value).is_err());
        }
        assert_eq!(
            validate_reference(" ghcr.io/team/app:latest ").unwrap(),
            "ghcr.io/team/app:latest"
        );
    }

    #[test]
    fn assignments_preserve_values_without_shell_interpretation() {
        assert!(validate_assignment("MESSAGE=hello; touch /tmp/nope").is_ok());
        assert!(validate_assignment("=oops").is_err());
        assert!(validate_assignment("--flag=value").is_err());
    }

    #[test]
    fn run_command_arguments_follow_image_not_docker_options() {
        let args = run_args(ImageRunOptions {
            image: "alpine:latest".into(),
            name: None,
            ports: vec!["8080:80".into()],
            environment: vec!["TEXT=hello world".into()],
            volumes: vec![],
            network: None,
            command: vec!["sh".into(), "-c".into(), "echo hello".into()],
            auto_remove: false,
        })
        .unwrap();
        assert_eq!(
            &args[args.len() - 4..],
            ["alpine:latest", "sh", "-c", "echo hello"]
        );
        assert!(args.contains(&"--env=TEXT=hello world".into()));
        assert!(args.contains(&"--publish=8080:80".into()));
    }

    #[test]
    fn logs_are_bounded_on_utf8_boundaries() {
        let mut log = String::new();
        append_log(&mut log, &"é".repeat(MAX_LOG_BYTES));
        assert!(log.len() <= MAX_LOG_BYTES);
        assert!(log.is_char_boundary(0));
    }

    #[test]
    fn download_progress_is_parsed() {
        assert_eq!(
            parse_bracket_progress("[==>] 1MB/2MB"),
            Some((1_048_576, 2_097_152))
        );
        assert_eq!(parse_size_token("nonsense"), None);
    }
}
