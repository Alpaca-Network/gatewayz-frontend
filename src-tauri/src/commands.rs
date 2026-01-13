//! IPC Commands for GatewayZ Desktop
//!
//! This module provides the Tauri command handlers for communication
//! between the frontend and the Rust backend.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use tauri_plugin_updater::UpdaterExt;

/// Application version information
#[derive(Debug, Clone, Serialize)]
pub struct AppVersion {
    pub version: String,
    pub name: String,
    pub tauri_version: String,
}

/// Platform information
#[derive(Debug, Clone, Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub version: String,
    pub hostname: String,
}

/// Window state for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub fullscreen: bool,
}

/// Update information
#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

/// Get the application version information
#[tauri::command]
pub fn get_app_version() -> AppVersion {
    AppVersion {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: env!("CARGO_PKG_NAME").to_string(),
        tauri_version: tauri::VERSION.to_string(),
    }
}

/// Get platform information
#[tauri::command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: sys_info::os_release().unwrap_or_else(|_| "unknown".to_string()),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
    })
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), String> {
    let mut notification = app.notification().builder();
    notification = notification.title(&title).body(&body);

    if let Some(icon_path) = icon {
        notification = notification.icon(&icon_path);
    }

    notification.show().map_err(|e| e.to_string())
}

/// Open an external URL in the default browser
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

/// Get the stored authentication token
#[tauri::command]
pub async fn get_auth_token(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    let token = store
        .get("auth_token")
        .and_then(|v| v.as_str().map(String::from));

    Ok(token)
}

/// Store the authentication token securely
#[tauri::command]
pub async fn set_auth_token(app: AppHandle, token: String) -> Result<(), String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    store.set("auth_token", serde_json::json!(token));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// Clear the stored authentication token
#[tauri::command]
pub async fn clear_auth_token(app: AppHandle) -> Result<(), String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    store.delete("auth_token");
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// Check for application updates
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: None,
            notes: None,
            date: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Install a pending update
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => {
            // Download and install the update
            let mut downloaded = 0;
            let bytes = update
                .download(
                    |chunk, _total| {
                        downloaded += chunk;
                        log::info!("Downloaded {} bytes", downloaded);
                    },
                    || {
                        log::info!("Download finished");
                    },
                )
                .await
                .map_err(|e| e.to_string())?;

            // Install the update
            update.install(bytes).map_err(|e| e.to_string())?;

            // Restart the application (this call never returns)
            app.restart();
        }
        Ok(None) => Err("No update available".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// Get the current window state
#[tauri::command]
pub async fn get_window_state(window: WebviewWindow) -> Result<WindowState, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    let fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;

    Ok(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
        fullscreen,
    })
}

/// Set the window state
#[tauri::command]
pub async fn set_window_state(window: WebviewWindow, state: WindowState) -> Result<(), String> {
    if state.fullscreen {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    } else if state.maximized {
        window.maximize().map_err(|e| e.to_string())?;
    } else {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: state.x,
                y: state.y,
            }))
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: state.width,
                height: state.height,
            }))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Toggle always-on-top mode
#[tauri::command]
pub async fn toggle_always_on_top(window: WebviewWindow) -> Result<bool, String> {
    let current = window.is_always_on_top().map_err(|e| e.to_string())?;
    let new_state = !current;
    window
        .set_always_on_top(new_state)
        .map_err(|e| e.to_string())?;
    Ok(new_state)
}

/// Minimize the window to the system tray
#[tauri::command]
pub async fn minimize_to_tray(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}
