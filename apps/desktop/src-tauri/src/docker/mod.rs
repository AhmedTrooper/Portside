//! Docker integration.
//!
//! Each submodule owns the read or write commands for one Docker resource:
//!   - `containers` — list/start/stop/restart/pause/remove
//!   - `images`     — pull/remove with streaming progress
//!   - `networks`   — list/create/remove
//!   - `volumes`    — list/create/remove/prune
//!   - `compose`    — list/up/stop/restart/down
//!
//! Shared helpers (e.g. `docker_command`, `run_docker`, `now_ms`) live here so
//! the submodules don't each redefine the same platform-specific binary probe.

pub mod compose;
pub mod containers;
pub mod images;
pub mod networks;
pub mod volumes;

use std::ffi::OsStr;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// Resolve the `docker` binary location. Tries the user's PATH first via the
/// platform-appropriate filename, and if that's not resolvable, probes the
/// well-known absolute install locations for each platform. The first
/// existing path wins; we don't override PATH.
///
/// Returning a `Command` (rather than the resolved path) keeps the call site
/// symmetrical: `docker_command().args([...]).spawn()` works the same whether
/// `docker` was found on PATH or at an absolute fallback.
pub(crate) fn docker_command() -> Command {
    let primary = if cfg!(windows) {
        "docker.exe"
    } else {
        "docker"
    };

    // Try the bare name first — every modern install puts it on PATH and
    // going via PATH preserves any shell wrappers (aliases, sudo rules, etc.).
    // Only fall back to absolute paths if PATH resolution will likely fail.
    let fallback_paths: &[&str] = if cfg!(windows) {
        &[
            r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
            r"C:\Program Files\Docker\Docker\bin\docker.exe",
        ]
    } else if cfg!(target_os = "macos") {
        &[
            "/usr/local/bin/docker",
            "/Applications/Docker.app/Contents/Resources/bin/docker",
            "/opt/homebrew/bin/docker",
        ]
    } else {
        &[
            "/usr/bin/docker",
            "/usr/local/bin/docker",
            "/snap/bin/docker",
            "/var/lib/flatpak/exports/bin/docker",
        ]
    };

    for path_str in fallback_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Command::new(p);
        }
    }

    // Last resort: let the OS resolve via PATH. The caller reports a friendly
    // error if the binary can't be found.
    Command::new(primary)
}

/// Run a Docker CLI command and return trimmed stdout on success. On failure we
/// return stderr when Docker gave us one, otherwise a short status message.
///
/// This is the shared write-path helper for the simple one-shot commands
/// (container lifecycle, volume and compose actions). Long-running operations
/// such as image pulls keep their own streaming implementation.
pub(crate) fn run_docker<I, S>(args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = docker_command()
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!("docker command failed: {}", output.status))
        } else {
            Err(stderr)
        }
    }
}

/// Current time in milliseconds since the UNIX epoch. Falls back to 0 if the
/// clock is somehow before the epoch — never panic, since this is called from
/// worker threads.
pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
