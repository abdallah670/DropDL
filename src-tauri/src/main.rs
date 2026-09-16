#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri::api::process::Command;
use tauri::api::process::CommandEvent;
use tauri::api::process::CommandChild;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Debug)]
pub struct DependencyStatus {
    pub name: String,
    pub installed: bool,
    pub version: String,
    pub path: String,
    pub required: bool,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub status: String,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: f64,
    pub eta_seconds: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersistedConfig {
    pub version: u32,
    #[serde(default)]
    pub settings: Option<serde_json::Value>,
    #[serde(default)]
    pub history: serde_json::Value,
    #[serde(default)]
    pub paths: serde_json::Value,
    // Persisted download queue (queued/paused/failed tasks only). Option + default
    // keeps config.json v1 files loadable before the frontend migrates them.
    #[serde(default)]
    pub queue: Option<serde_json::Value>,
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path_resolver()
        .app_data_dir()
        .map(|d| d.join("config.json"))
        .ok_or_else(|| "could not resolve app data dir".to_string())
}

/// Load persisted app state from config.json. Returns Ok(None) if the file doesn't exist yet.
#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<Option<PersistedConfig>, String> {
    let path = config_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            // Tolerate a UTF-8 BOM (e.g. the file was hand-edited in Notepad):
            // serde_json rejects it with "expected value at line 1 column 1".
            let clean = raw.trim_start_matches('\u{feff}');
            serde_json::from_str(clean)
                .map(Some)
                .map_err(|e| format!("config.json parse error: {}", e))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("failed to read config.json: {}", e)),
    }
}

/// Atomically persist app state: write config.json.tmp then rename over config.json.
#[tauri::command]
fn save_config(app: tauri::AppHandle, state: PersistedConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("failed to create data dir: {}", e))?;
    }
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, raw).map_err(|e| format!("failed to write temp config: {}", e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("failed to finalize config: {}", e))?;
    Ok(())
}

/// Sections of app state that live in their own file (split persistence).
/// The frontend passes `name`, so an allowlist keeps a frontend bug from
/// reading/writing an arbitrary path.
const DATA_FILES: [&str; 3] = ["settings", "history", "queue"];

fn data_file_path(app: &tauri::AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
    if !DATA_FILES.contains(&name) {
        return Err(format!("unknown data file: {}", name));
    }
    app.path_resolver()
        .app_data_dir()
        .map(|d| d.join(format!("{}.json", name)))
        .ok_or_else(|| "could not resolve app data dir".to_string())
}

/// Load one persisted section (settings.json / history.json / queue.json).
/// Ok(None) means "not written yet" (first run) rather than an error.
#[tauri::command]
fn load_data_file(
    app: tauri::AppHandle,
    name: String,
) -> Result<Option<serde_json::Value>, String> {
    let path = data_file_path(&app, &name)?;
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            // Tolerate a UTF-8 BOM (file hand-edited in Notepad).
            let clean = raw.trim_start_matches('\u{feff}');
            serde_json::from_str(clean)
                .map(Some)
                .map_err(|e| format!("{}.json parse error: {}", name, e))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("failed to read {}.json: {}", name, e)),
    }
}

/// Atomically persist one section: write <name>.json.tmp then rename over it.
#[tauri::command]
fn save_data_file(
    app: tauri::AppHandle,
    name: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let path = data_file_path(&app, &name)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("failed to create data dir: {}", e))?;
    }
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, raw).map_err(|e| format!("failed to write temp {}: {}", name, e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("failed to finalize {}: {}", name, e))?;
    Ok(())
}

/// Retire the pre-split `config.json` once its sections exist as their own
/// files. Renamed (not deleted) to `config.json.bak` so nothing is lost.
#[tauri::command]
fn archive_legacy_config(app: tauri::AppHandle) -> Result<bool, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(false);
    }
    let backup = path.with_extension("json.bak");
    std::fs::rename(&path, &backup)
        .map(|_| true)
        .map_err(|e| format!("failed to archive config.json: {}", e))
}

/// Tracks live yt-dlp child processes so they can be paused/cancelled.
pub struct DownloadProcs {
    pub children: Mutex<HashMap<String, CommandChild>>,
    /// task_id -> "paused" | "cancelled" — intentional stops (so exit != error)
    pub stops: Mutex<HashMap<String, String>>,
}

/// Kill a spawned sidecar process AND its whole child tree (ffmpeg workers,
/// parallel connection helpers). A bare `CommandChild::kill()` only signals the
/// direct child, so on Windows ffmpeg/merger children survived "cancel" and
/// the download visibly kept running.
fn kill_process_tree(child: CommandChild) {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        use std::os::windows::process::CommandExt;
        // Grab the PID before `kill` consumes the child.
        let pid = child.pid();
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        // Belt and braces if taskkill is unavailable / failed.
        let _ = child.kill();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = child.kill();
    }
}

/// Pause a running download: kill the yt-dlp process (partial .part file is kept
/// and yt-dlp will resume from it on the next run of the same format/url).
#[tauri::command]
fn pause_download(
    app_handle: tauri::AppHandle,
    state: tauri::State<DownloadProcs>,
    task_id: String,
) -> Result<(), String> {
    // Register the intentional-stop flag BEFORE killing, so the Terminated
    // event is correctly mapped to "paused" instead of "failed".
    state
        .stops
        .lock()
        .unwrap()
        .insert(task_id.clone(), "paused".to_string());
    if let Some(mut child) = state.children.lock().unwrap().remove(&task_id) {
        kill_process_tree(child);
    }
    let _ = app_handle.emit_all(
        &format!("download-progress-{}", task_id),
        serde_json::json!({ "status": "paused", "speed": 0, "etaSeconds": 0, "postProcessingStep": null }),
    );
    let _ = app_handle.emit_all(
        &format!("download-log-{}", task_id),
        "[yt-dlp] Paused — partial file kept for resume.".to_string(),
    );
    Ok(())
}

/// Cancel a running download: kill the yt-dlp process.
#[tauri::command]
fn cancel_download(
    app_handle: tauri::AppHandle,
    state: tauri::State<DownloadProcs>,
    task_id: String,
) -> Result<(), String> {
    // Register the intentional-stop flag BEFORE killing.
    state
        .stops
        .lock()
        .unwrap()
        .insert(task_id.clone(), "cancelled".to_string());
    if let Some(mut child) = state.children.lock().unwrap().remove(&task_id) {
        kill_process_tree(child);
    }
    let _ = app_handle.emit_all(
        &format!("download-progress-{}", task_id),
        serde_json::json!({ "status": "cancelled", "speed": 0, "etaSeconds": 0, "postProcessingStep": null }),
    );
    let _ = app_handle.emit_all(
        &format!("download-log-{}", task_id),
        "[yt-dlp] Cancelled by user.".to_string(),
    );
    Ok(())
}

/// Open a folder in the OS file explorer (safer than exposing shell.open "*" scope).
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let p = path.trim().to_string();
    if p.is_empty() || p.starts_with('-') {
        return Err("Invalid folder path".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn check_dependencies() -> Vec<DependencyStatus> {
    let mut results = Vec::new();

    // Check yt-dlp sidecar
    let ytdlp_check = Command::new_sidecar("yt-dlp");
    match ytdlp_check {
        Ok(mut cmd) => {
            let output = cmd.args(&["--version"]).output();
            match output {
                Ok(out) if out.status.success() => {
                    let ver = out.stdout.trim().to_string();
                    results.push(DependencyStatus {
                        name: "yt-dlp".into(),
                        installed: true,
                        version: ver,
                        path: "Bundled Sidecar".into(),
                        required: true,
                        description: "Core media extraction and downloading engine.".into(),
                    });
                }
                _ => {
                    results.push(DependencyStatus {
                        name: "yt-dlp".into(),
                        installed: false,
                        version: "Not found".into(),
                        path: "".into(),
                        required: true,
                        description: "Core media extraction and downloading engine.".into(),
                    });
                }
            }
        }
        Err(_) => {
            results.push(DependencyStatus {
                name: "yt-dlp".into(),
                installed: false,
                version: "Not found (Sidecar Missing)".into(),
                path: "".into(),
                required: true,
                description: "Core media extraction and downloading engine.".into(),
            });
        }
    }

    // Check FFmpeg sidecar
    let ffmpeg_check = Command::new_sidecar("ffmpeg");
    match ffmpeg_check {
        Ok(mut cmd) => {
            let output = cmd.args(&["-version"]).output();
            match output {
                Ok(out) if out.status.success() => {
                    let first_line = out.stdout.lines().next().unwrap_or("FFmpeg installed").to_string();
                    results.push(DependencyStatus {
                        name: "FFmpeg".into(),
                        installed: true,
                        version: first_line,
                        path: "Bundled Sidecar".into(),
                        required: true,
                        description: "Essential for merging video + audio streams and container remuxing.".into(),
                    });
                }
                _ => {
                    results.push(DependencyStatus {
                        name: "FFmpeg".into(),
                        installed: false,
                        version: "Not found".into(),
                        path: "".into(),
                        required: true,
                        description: "Essential for merging video + audio streams and container remuxing.".into(),
                    });
                }
            }
        }
        Err(_) => {
            results.push(DependencyStatus {
                name: "FFmpeg".into(),
                installed: false,
                version: "Not found (Sidecar Missing)".into(),
                path: "".into(),
                required: true,
                description: "Essential for merging video + audio streams and container remuxing.".into(),
            });
        }
    }

    results
}

/// Validate a user-supplied media URL before passing it to yt-dlp.
/// Prevents argument injection (e.g. URLs starting with "-" being treated as flags).
fn validate_url(url: &str) -> Result<(), String> {
    let u = url.trim();
    if u.is_empty() || u.starts_with('-') {
        return Err("Invalid URL: links must start with http:// or https://".to_string());
    }
    if !(u.starts_with("http://") || u.starts_with("https://")) {
        return Err("Invalid URL: only http:// and https:// links are supported".to_string());
    }
    Ok(())
}

/// Resolve the destination folder: expand "~" and default empty/"." to the
/// user's real Downloads directory (yt-dlp does not expand "~" itself).
fn resolve_dest(dest: &str) -> String {
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().trim_end_matches(['/', '\\']).to_string())
        .unwrap_or_else(|| ".".to_string());
    if dest.trim().is_empty() || dest.trim() == "." {
        return dirs::download_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| home);
    }
    if let Some(rest) = dest.strip_prefix("~/").or(dest.strip_prefix("~\\")) {
        return format!("{}{}", home, if rest.is_empty() { String::new() } else { format!("/{}", rest) });
    }
    if dest.trim() == "~" {
        return home;
    }
    dest.to_string()
}

/// Probe the real size of the finished output file with ffprobe.
async fn probe_file_size(path: &str) -> Option<u64> {
    let mut cmd = Command::new_sidecar("ffprobe").ok()?;
    let out = cmd
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=size",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    out.stdout.trim().parse::<f64>().ok().map(|f| f as u64)
}

#[tauri::command]
async fn analyze_url(url: String) -> Result<serde_json::Value, String> {
    validate_url(&url)?;
    let mut cmd = Command::new_sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?;

    // FAST PATH: try a flat playlist extraction first. --flat-playlist only
    // fetches the playlist manifest (titles + URLs) without requesting full
    // metadata for every video, which turns minutes of analysis into seconds.
    let flat_output = cmd
        .args(&[
            "--flat-playlist",
            "--dump-single-json",
            "--no-warnings",
            "--",
            url.trim(),
        ])
        .output()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    if flat_output.status.success() {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&flat_output.stdout) {
            if parsed.get("_type").and_then(|t| t.as_str()) == Some("playlist") {
                let mut entries: Vec<serde_json::Value> = Vec::new();
                let mut has_url = false;
                if let Some(list) = parsed.get("entries").and_then(|e| e.as_array()) {
                    for (i, e) in list.iter().enumerate() {
                        let entry_url = e
                            .get("url")
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_default();
                        if !entry_url.is_empty() {
                            has_url = true;
                        }
                        let full_url = if entry_url.starts_with("http") {
                            entry_url
                        } else {
                            // Flat extraction can return bare IDs for YouTube
                            format!("https://www.youtube.com/watch?v={}", entry_url)
                        };
                        entries.push(serde_json::json!({
                            "id": e.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                            "index": i + 1,
                            "title": e.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled"),
                            "duration": e.get("duration").and_then(|v| v.as_f64()),
                            "url": full_url,
                            "thumbnail": e.get("thumbnails")
                                .and_then(|t| t.as_array())
                                .and_then(|a| a.last())
                                .and_then(|t| t.get("url"))
                                .and_then(|u| u.as_str()),
                            "uploader": e.get("uploader").and_then(|v| v.as_str()),
                            "isAvailable": true,
                            "selected": true,
                        }));
                    }
                }
                let video_count = entries.len();
                // Return the playlist when we got usable entries. If the flat
                // manifest came back empty/no-URL (e.g. lazy extractor response),
                // fall through to the full extraction below so a real playlist is
                // not reported as empty by mistake.
                if has_url {
                    return Ok(serde_json::json!({
                        "playlist": {
                            "id": parsed.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                            "title": parsed.get("title").and_then(|v| v.as_str()).unwrap_or("Playlist"),
                            "uploader": parsed.get("uploader").or_else(|| parsed.get("channel"))
                                .and_then(|v| v.as_str()),
                            "video_count": video_count,
                            "entries": entries,
                        }
                    }));
                }
            }
        }
    }

    // SLOW PATH: single media item — full metadata including all formats.
    let mut cmd = Command::new_sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?;

    let output = cmd
        .args(&["--dump-single-json", "--no-warnings", "--no-playlist", "--", url.trim()])
        .output()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    if !output.status.success() {
        let err = output.stderr;
        return Err(err.to_string());
    }

    let parsed: serde_json::Value = serde_json::from_str(&output.stdout)
        .map_err(|e| format!("Failed to parse yt-dlp JSON: {}", e))?;

    Ok(serde_json::json!({
        "media": parsed
    }))
}

/// Parse a yt-dlp --newline progress line like:
/// [download]  45.3% of  104.8MiB at  5.12MiB/s ETA 00:10
fn parse_progress_line(line: &str) -> Option<DownloadProgress> {
    // Must contain [download] and a percentage
    if !line.contains("[download]") || !line.contains('%') {
        return None;
    }

    let trimmed = line.trim();

    // Extract percentage
    let pct: f64 = {
        let pct_str = trimmed.split('%').next()?;
        let pct_part = pct_str.split_whitespace().last()?;
        pct_part.parse().ok()?
    };

    // Extract total bytes (e.g. "104.8MiB")
    let total_bytes: u64 = if let Some(of_pos) = trimmed.find(" of ") {
        // yt-dlp prints approximate sizes as "of ~ 50.00MiB" (lone "~"
        // token) or "of Unknown": take the first token that parses to a
        // real size so totals are not stuck at 0 B.
        first_size_token(&trimmed[of_pos + 4..])
    } else {
        0
    };

    let downloaded_bytes = (pct / 100.0 * total_bytes as f64) as u64;

    // Extract speed (e.g. "5.12MiB/s")
    let speed: f64 = if let Some(at_pos) = trimmed.find(" at ") {
        let after_at = &trimmed[at_pos + 4..];
        // Speed can be "Unknown": take the first token that parses.
        let speed_str = after_at
            .split_whitespace()
            .find(|tok| parse_size_str(tok.trim_end_matches("/s")) > 0)
            .unwrap_or("0");
        parse_size_str(speed_str.trim_end_matches("/s")) as f64
    } else {
        0.0
    };

    // Extract ETA (e.g. "ETA 00:10")
    let eta_seconds: i64 = if let Some(eta_pos) = trimmed.find("ETA ") {
        let after_eta = &trimmed[eta_pos + 4..];
        let time_str = after_eta.split_whitespace().next().unwrap_or("00:00");
        parse_eta(time_str)
    } else {
        0
    };

    let status = if (pct - 100.0).abs() < 0.01 {
        "completed".to_string()
    } else {
        "downloading".to_string()
    };

    Some(DownloadProgress {
        status,
        progress: pct,
        downloaded_bytes,
        total_bytes,
        speed,
        eta_seconds,
    })
}

fn parse_size_str(s: &str) -> u64 {
    // Tolerate yt-dlp's approximation marker and a trailing rate suffix
    // ("~55.70MiB", "2.00MiB/s") so callers never silently get 0.
    let s = s.trim().trim_start_matches('~').trim();
    let (num_str, mult) = if s.ends_with("GiB") {
        (&s[..s.len()-3], 1_073_741_824u64)
    } else if s.ends_with("MiB") {
        (&s[..s.len()-3], 1_048_576u64)
    } else if s.ends_with("KiB") {
        (&s[..s.len()-3], 1_024u64)
    } else if s.ends_with("GB") {
        (&s[..s.len()-2], 1_000_000_000u64)
    } else if s.ends_with("MB") {
        (&s[..s.len()-2], 1_000_000u64)
    } else if s.ends_with("KB") {
        (&s[..s.len()-2], 1_000u64)
    } else {
        (s, 1u64)
    };
    let n: f64 = num_str.parse().unwrap_or(0.0);
    (n * mult as f64) as u64
}

/// Pick the first whitespace-separated token that parses to a real size.
/// yt-dlp reports approximate sizes as "of ~  44.31MiB" (the "~" is its own
/// token) and "Unknown" when unavailable, so taking the first word verbatim
/// silently yields 0 and the UI shows "0 B".
fn first_size_token(s: &str) -> u64 {
    s.split_whitespace()
        .map(parse_size_str)
        .find(|bytes| *bytes > 0)
        .unwrap_or(0)
}

fn parse_eta(s: &str) -> i64 {
    let parts: Vec<&str> = s.split(':').collect();
    match parts.len() {
        2 => {
            let m: i64 = parts[0].parse().unwrap_or(0);
            let sec: i64 = parts[1].parse().unwrap_or(0);
            m * 60 + sec
        }
        3 => {
            let h: i64 = parts[0].parse().unwrap_or(0);
            let m: i64 = parts[1].parse().unwrap_or(0);
            let sec: i64 = parts[2].parse().unwrap_or(0);
            h * 3600 + m * 60 + sec
        }
        _ => 0,
    }
}

/// Only forward container / audio-codec values that yt-dlp actually accepts.
/// "original" (and any stale or unknown value) yields an empty string so we
/// fall back to yt-dlp defaults instead of passing an invalid format.
fn sanitize_container(raw: &str, media_type: &str) -> String {
    let c = raw.trim().to_lowercase();
    let valid = if media_type == "audio" {
        matches!(c.as_str(), "mp3" | "m4a" | "opus" | "flac" | "wav")
    } else {
        matches!(c.as_str(), "mp4" | "mkv" | "webm")
    };
    if valid {
        c
    } else {
        String::new()
    }
}

#[tauri::command]
async fn start_download(
    app_handle: tauri::AppHandle,
    task: serde_json::Value,
) -> Result<(), String> {
    let task_id = task["id"].as_str().unwrap_or("").to_string();
    let url = task["url"].as_str().unwrap_or("").to_string();
    validate_url(&url)?;
    let format_selector = task["formatSelector"].as_str().unwrap_or("bestvideo*+bestaudio/best").to_string();
    let dest_path = resolve_dest(task["destinationPath"].as_str().unwrap_or("."));
    let media_type = task["mediaType"].as_str().unwrap_or("video").to_string();
    // Whitelist the container / codec so a stale or unsupported value can never
    // be forwarded into the yt-dlp argument vector.
    let container = sanitize_container(task["container"].as_str().unwrap_or(""), &media_type);

    // Container / audio-format handling:
    // - audio-only tasks: extract audio (-x) into the chosen codec (mp3, m4a, opus, flac, wav)
    // - video tasks: force the chosen merge container (mp4, mkv, webm); for MP4 also
    //   prefer mp4-compatible codecs (h264/m4a) as a tiebreaker when quality is equal.
    let mut container_args: Vec<String> = Vec::new();
    if !container.is_empty() {
        if media_type == "audio" {
            container_args.push("-x".to_string());
            container_args.push("--audio-format".to_string());
            container_args.push(container.clone());
        } else {
            container_args.push("--merge-output-format".to_string());
            container_args.push(container.clone());
            if container == "mp4" {
                container_args.push("-S".to_string());
                container_args.push("+ext:mp4:m4a".to_string());
            }
        }
    }

    // Signal "downloading" status immediately
    let _ = app_handle.emit_all(
        &format!("download-progress-{}", task_id),
        serde_json::json!({
            "status": "downloading",
            "progress": 0,
            "downloadedBytes": 0,
            "totalBytes": 0,
            "speed": 0,
            "etaSeconds": 0
        }),
    );

    tokio::spawn(async move {
        let _ = app_handle.emit_all(
            &format!("download-log-{}", task_id),
            format!("[yt-dlp] Starting bundled process: -f \"{}\" \"{}\"", format_selector, url),
        );

        let mut output_file: Option<String> = None;
        let mut last_total: u64 = 0;
        let mut last_downloaded: u64 = 0;
        // Multi-stream accounting: high-quality downloads fetch video and
        // audio as separate streams, one Destination line each.
        // completed_bytes banks finished streams so progress and sizes
        // never jump back to ~0% mid-download.
        let mut completed_bytes: u64 = 0;
        let mut last_stream_downloaded: u64 = 0;
        let mut last_stream_total: u64 = 0;
        let mut dest_count: u32 = 0;
        let mut announced_part: u32 = 0;
        let mut had_stream_progress = false;
        let cmd = Command::new_sidecar("yt-dlp");
        if let Ok(mut c) = cmd {
            let mut all_args: Vec<String> = vec![
                "-f".to_string(),
                format_selector.clone(),
                "-P".to_string(),
                dest_path.clone(),
            ];
            // Optional per-task output filename template (e.g. numbered
            // playlist batches: "01 - %(title)s.%(ext)s"). Relative template
            // so the -P destination folder above still applies.
            if let Some(tpl) = task["outputTemplate"].as_str() {
                if !tpl.is_empty() && !tpl.contains("..") && !tpl.contains('/') && !tpl.contains('\\') {
                    all_args.push("-o".to_string());
                    all_args.push(tpl.to_string());
                }
            }
            all_args.extend(container_args);
            all_args.extend([
                "--newline".to_string(),
                "--progress".to_string(),
                "--".to_string(),
                url.trim().to_string(),
            ]);
            let spawn_result = c.args(&all_args).spawn();

            match spawn_result {
                Ok((mut rx, child)) => {
                    // Register the live process so pause/cancel can kill it
                    let manager = app_handle.state::<DownloadProcs>();
                    manager.children.lock().unwrap().insert(task_id.clone(), child);
                    // A pause/cancel request may have arrived BEFORE the child
                    // was registered here (spawn takes a moment). If so, kill
                    // it immediately instead of letting the download continue.
                    let stop_now = manager.stops.lock().unwrap().get(&task_id).cloned();
                    if let Some(kind) = stop_now {
                        if let Some(c) = manager.children.lock().unwrap().remove(&task_id) {
                            kill_process_tree(c);
                        }
                        let _ = app_handle.emit_all(
                            &format!("download-progress-{}", task_id),
                            serde_json::json!({ "status": kind, "speed": 0, "etaSeconds": 0 }),
                        );
                    }
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                // Try to parse progress from each stdout line
                                if let Some(progress) = parse_progress_line(&line) {
                                    had_stream_progress = true;
                                    if progress.total_bytes > 0 {
                                        last_stream_total = progress.total_bytes;
                                        last_total =
                                            completed_bytes.saturating_add(progress.total_bytes);
                                    }
                                    if progress.downloaded_bytes > 0 {
                                        last_stream_downloaded = progress.downloaded_bytes;
                                        last_downloaded = completed_bytes
                                            .saturating_add(progress.downloaded_bytes);
                                    }
                                    // Cumulative across all streams: the bar and the
                                    // sizes keep climbing instead of jumping back to
                                    // ~0% when the next stream starts.
                                    let cum_downloaded = completed_bytes
                                        .saturating_add(progress.downloaded_bytes);
                                    let cum_total = if progress.total_bytes > 0 {
                                        completed_bytes.saturating_add(progress.total_bytes)
                                    } else {
                                        last_total
                                    };
                                    let overall = if cum_total > 0 {
                                        (cum_downloaded as f64 / cum_total as f64 * 100.0)
                                            .min(100.0)
                                    } else {
                                        progress.progress
                                    };
                                    // Status stays downloading while the process is
                                    // alive, even at 100% of one stream. Real
                                    // completion is reported when yt-dlp exits
                                    // (download-complete event).
                                    let _ = app_handle.emit_all(
                                        &format!("download-progress-{}", task_id),
                                        serde_json::json!({
                                            "status": "downloading",
                                            "progress": overall,
                                            "downloadedBytes": cum_downloaded,
                                            "totalBytes": cum_total,
                                            "speed": progress.speed,
                                            "etaSeconds": progress.eta_seconds
                                        }),
                                    );
                                } else {
                                    // Log non-progress lines (merging, post-processing etc.)
                                    let _ = app_handle.emit_all(
                                        &format!("download-log-{}", task_id),
                                        line.clone(),
                                    );
                                    // One "[download] Destination:" line per stream. When
                                    // the second stream destination arrives, the first
                                    // stream is banked and the user is told what is
                                    // happening. Announced ONLY here: never at start,
                                    // never for already-downloaded (skipped) files.
                                    if line.contains("[download]")
                                        && line.contains("Destination:")
                                    {
                                        if had_stream_progress {
                                            completed_bytes = completed_bytes.saturating_add(
                                                if last_stream_total > 0 {
                                                    last_stream_total
                                                } else {
                                                    last_stream_downloaded
                                                },
                                            );
                                            last_total = completed_bytes;
                                            last_downloaded = completed_bytes;
                                        }
                                        dest_count += 1;
                                        last_stream_downloaded = 0;
                                        last_stream_total = 0;
                                        had_stream_progress = false;
                                        if dest_count >= 2 && announced_part < dest_count {
                                            announced_part = dest_count;
                                            let _ = app_handle.emit_all(
                                                &format!("download-log-{}", task_id),
                                                "[DropDL] Video stream done: downloading the audio stream (merged at the end).".to_string(),
                                            );
                                            let _ = app_handle.emit_all(
                                                &format!("download-progress-{}", task_id),
                                                serde_json::json!({
                                                    "status": "downloading",
                                                    "postProcessingStep": "Video done: downloading audio stream (part 2 of 2)"
                                                }),
                                            );
                                        }
                                    }
                                    // Detect post-processing / merging step
                                    let lower = line.to_lowercase();
                                    if lower.contains("has already been downloaded") {
                                        // "[download] <path> has already been downloaded" —
                                        // yt-dlp exits immediately with code 0; probe the
                                        // existing file so size/status are still correct.
                                        let p = line
                                            .trim()
                                            .trim_start_matches("[download]")
                                            .trim()
                                            .trim_end_matches("has already been downloaded")
                                            .trim()
                                            .to_string();
                                        if !p.is_empty() {
                                            output_file = Some(p);
                                        }
                                        let _ = app_handle.emit_all(
                                            &format!("download-progress-{}", task_id),
                                            serde_json::json!({
                                                "status": "downloading",
                                                "postProcessingStep": "File already downloaded — verifying..."
                                            }),
                                        );
                                    } else if lower.contains("[merger]") || lower.contains("[ffmpeg]") || lower.contains("merging") {
                                        // Capture the final output filename from
                                        // lines like: [Merger] Merging formats into "Title.mp4"
                                        if let Some(start) = line.find('"') {
                                            if let Some(end_rel) = line[start + 1..].find('"') {
                                                output_file = Some(line[start + 1..start + 1 + end_rel].to_string());
                                            }
                                        }
                                        let _ = app_handle.emit_all(
                                            &format!("download-progress-{}", task_id),
                                            serde_json::json!({
                                                "status": "merging",
                                                "postProcessingStep": "Merging streams with FFmpeg..."
                                            }),
                                        );
                                    }
                                }
                            }
                            CommandEvent::Stderr(line) => {
                                let _ = app_handle.emit_all(
                                    &format!("download-log-{}", task_id),
                                    format!("[stderr] {}", line),
                                );
                            }
                            CommandEvent::Terminated(payload) => {
                                // Clean up process registration
                                let stop_kind = {
                                    let state = app_handle.state::<DownloadProcs>();
                                    let _ = state.children.lock().unwrap().remove(&task_id);
                                    let kind = state.stops.lock().unwrap().remove(&task_id);
                                    kind
                                };
                                match stop_kind.as_deref() {
                                    Some("paused") => {
                                        let _ = app_handle.emit_all(
                                            &format!("download-progress-{}", task_id),
                                            serde_json::json!({ "status": "paused", "speed": 0, "etaSeconds": 0 }),
                                        );
                                    }
                                    Some("cancelled") => {
                                        let _ = app_handle.emit_all(
                                            &format!("download-progress-{}", task_id),
                                            serde_json::json!({ "status": "cancelled", "speed": 0, "etaSeconds": 0 }),
                                        );
                                    }
                                    _ => {
                                        let exit_ok = payload.code.map(|c| c == 0).unwrap_or(false);
                                        if exit_ok {
                                            // Probe the real size of the final merged file.
                                            // The merger line contains a bare filename, so
                                            // resolve it against the destination folder.
                                            let mut final_size: Option<u64> = None;
                                            let mut final_path: Option<String> = None;
                                            if let Some(file) = &output_file {
                                                let probe_path = if file.contains('/') || file.contains('\\') {
                                                    file.clone()
                                                } else {
                                                    format!(
                                                        "{}{}{}",
                                                        dest_path.trim_end_matches(['/', '\\']),
                                                        std::path::MAIN_SEPARATOR,
                                                        file
                                                    )
                                                };
                                                final_path = Some(probe_path.clone());
                                                final_size = probe_file_size(&probe_path).await;
                                            }
                                            // Fallback chain: probed size > last reported stream size
                                            let total = final_size
                                                .filter(|s| *s > 0)
                                                .or(if last_downloaded > 0 { Some(last_downloaded) } else { None })
                                                .or(if last_total > 0 { Some(last_total) } else { None });
                                            let mut completed = serde_json::json!({
                                                "status": "completed",
                                                "progress": 100,
                                                "speed": 0,
                                                "etaSeconds": 0,
                                                "postProcessingStep": null
                                            });
                                            if let Some(t) = total {
                                                completed["totalBytes"] = serde_json::json!(t);
                                                completed["fileSizeBytes"] = serde_json::json!(t);
                                            }
                                            if let Some(d) = final_size {
                                                completed["downloadedBytes"] = serde_json::json!(d);
                                            }
                                            // Absolute path of the finished file so the UI can
                                            // offer "Show in folder" / (later, mobile share).
                                            if let Some(fp) = final_path {
                                                completed["filePath"] = serde_json::json!(fp);
                                            }
                                            let _ = app_handle.emit_all(
                                                &format!("download-progress-{}", task_id),
                                                completed.clone(),
                                            );
                                            // The complete payload carries the final data too, so the
                                            // frontend can fix up bytes/path even if it missed the
                                            // progress events above.
                                            let mut complete = completed.clone();
                                            complete["ok"] = serde_json::json!(true);
                                            let _ = app_handle.emit_all(
                                                &format!("download-complete-{}", task_id),
                                                complete,
                                            );
                                        } else {
                                            let _ = app_handle.emit_all(
                                                &format!("download-progress-{}", task_id),
                                                serde_json::json!({ "status": "failed", "progress": 0 }),
                                            );
                                            let _ = app_handle.emit_all(
                                                &format!("download-complete-{}", task_id),
                                                serde_json::json!({ "ok": false }),
                                            );
                                        }
                                        let _ = app_handle.emit_all(
                                            &format!("download-log-{}", task_id),
                                            format!("[yt-dlp] Process exited with code: {:?}", payload.code),
                                        );
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    let _ = app_handle.emit_all(
                        &format!("download-log-{}", task_id),
                        format!("[yt-dlp error] Failed to spawn sidecar: {}", e),
                    );
                    let _ = app_handle.emit_all(
                        &format!("download-progress-{}", task_id),
                        serde_json::json!({ "status": "error", "progress": 0 }),
                    );
                    let _ = app_handle.emit_all(
                        &format!("download-complete-{}", task_id),
                        serde_json::json!({ "ok": false }),
                    );
                }
            }
        }
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(DownloadProcs {
            children: Mutex::new(HashMap::new()),
            stops: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            analyze_url,
            start_download,
            pause_download,
            cancel_download,
            open_folder,
            load_config,
            save_config,
            load_data_file,
            save_data_file,
            archive_legacy_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running DropDL desktop application");
}
