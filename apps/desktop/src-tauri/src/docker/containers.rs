use std::process::Command;
use tauri::command;

#[command]
pub fn docker_start_container(id: String) -> Result<String, String> {
    let output = Command::new("docker")
        .args(["start", &id])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[command]
pub fn docker_stop_container(id: String) -> Result<String, String> {
    let output = Command::new("docker")
        .args(["stop", &id])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[command]
pub fn docker_restart_container(id: String) -> Result<String, String> {
    let output = Command::new("docker")
        .args(["restart", &id])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[command]
pub fn docker_remove_container(id: String, force: bool) -> Result<String, String> {
    let mut args = vec!["rm", &id];
    if force {
        args.insert(1, "-f");
    }
    let output = Command::new("docker")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}
