//! GatewayZ Desktop - Core library
//!
//! This library provides the core functionality for the GatewayZ desktop application,
//! including system tray management, keyboard shortcuts, and IPC commands.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

mod commands;
pub use commands::*;

/// Simple timestamp for logging (avoids adding chrono dependency)
#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn chrono_lite() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}

/// Initialize and run the Tauri application
///
/// This function sets up all plugins, system tray, global shortcuts,
/// and IPC command handlers for the desktop application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging - on Windows release builds, logs go to a file
    // since there's no console window
    #[cfg(all(target_os = "windows", not(debug_assertions)))]
    {
        use std::io::Write;
        // Try to create a log file for debugging Windows launch issues
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(std::env::temp_dir().join("gatewayz-desktop.log"))
        {
            let _ = writeln!(file, "[{}] GatewayZ Desktop starting...", chrono_lite());
        }
    }

    env_logger::init();

    let builder = tauri::Builder::default();

    // Add plugins
    let builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Add desktop-only plugins (single instance, global shortcuts)
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log::info!("Single instance triggered with args: {:?}", args);
            // Focus the main window when another instance tries to launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        handle_global_shortcut(app, shortcut);
                    }
                })
                .build(),
        );

    builder
        .setup(|app| {
            // Set up the system tray
            setup_tray(app.handle())?;

            // Register global shortcuts
            #[cfg(desktop)]
            register_shortcuts(app.handle())?;

            // Handle deep links
            setup_deep_link_handler(app.handle());

            log::info!("GatewayZ Desktop initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::get_platform_info,
            commands::show_notification,
            commands::open_external_url,
            commands::get_auth_token,
            commands::set_auth_token,
            commands::clear_auth_token,
            commands::check_for_updates,
            commands::install_update,
            commands::get_window_state,
            commands::set_window_state,
            commands::toggle_always_on_top,
            commands::minimize_to_tray,
        ])
        .on_window_event(|window, event| {
            // Handle window close event - minimize to tray instead of closing.
            // This is intentional UX for desktop apps with system tray integration:
            // - Users can fully quit via the tray menu "Quit" option
            // - The tray icon indicates the app is still running
            // - Alt+F4/Cmd+Q will also trigger this (use tray menu to fully quit)
            // Future improvement: Add a user preference to toggle this behavior
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing - app stays in tray
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            // Log error to file on Windows since there's no console
            #[cfg(all(target_os = "windows", not(debug_assertions)))]
            {
                use std::io::Write;
                if let Ok(mut file) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(std::env::temp_dir().join("gatewayz-desktop.log"))
                {
                    let _ = writeln!(file, "[{}] FATAL: {}", chrono_lite(), e);
                }
            }
            panic!("error while running GatewayZ Desktop: {}", e);
        });
}

/// Set up the system tray icon and menu
fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show GatewayZ", true, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, "new_chat", "New Chat", true, Some("CmdOrCtrl+N"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let check_updates = MenuItem::with_id(
        app,
        "check_updates",
        "Check for Updates...",
        true,
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit GatewayZ", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &new_chat,
            &separator,
            &check_updates,
            &settings,
            &separator2,
            &quit,
        ],
    )?;

    // Get the default icon, with fallback handling for Windows
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("Failed to get default window icon")?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_chat" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("new-chat", ());
                }
            }
            "check_updates" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("check-updates", ());
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", "/settings");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Register global keyboard shortcuts
#[cfg(desktop)]
fn register_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

    // Register platform-specific shortcuts to show/focus GatewayZ:
    // - macOS: Cmd+G (Super+G)
    // - Windows: Ctrl+G
    // - Linux: Super+G
    #[cfg(target_os = "windows")]
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyG);

    #[cfg(not(target_os = "windows"))]
    let shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyG);

    app.global_shortcut().register(shortcut)?;

    log::info!("Global shortcuts registered");
    Ok(())
}

/// Handle global shortcut events
#[cfg(desktop)]
fn handle_global_shortcut(app: &AppHandle, shortcut: &tauri_plugin_global_shortcut::Shortcut) {
    use tauri_plugin_global_shortcut::Code;

    if shortcut.key == Code::KeyG {
        // Toggle the main window: show if hidden/minimized, hide if visible and focused
        if let Some(window) = app.get_webview_window("main") {
            // Check window state
            let is_visible = window.is_visible().unwrap_or(false);
            let is_focused = window.is_focused().unwrap_or(false);
            let is_minimized = window.is_minimized().unwrap_or(false);

            if is_minimized {
                // Window is minimized - unminimize, show, and focus it
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            } else if is_visible && is_focused {
                // Window is visible and focused - hide it
                let _ = window.hide();
            } else if is_visible {
                // Window is visible but not focused - bring it to focus
                let _ = window.set_focus();
            } else {
                // Window is hidden - show and focus it
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

/// Set up deep link handler for gatewayz:// protocol
fn setup_deep_link_handler(app: &AppHandle) {
    use tauri::Listener;
    let app_handle = app.clone();

    // Listen for deep link events
    app.listen("deep-link://new-url", move |event| {
        let payload = event.payload();
        log::info!("Received deep link: {}", payload);

        // Parse the URL and handle it - payload is JSON string of URLs
        if let Ok(url) = url::Url::parse(payload) {
            handle_deep_link(&app_handle, &url);
        } else {
            // Try to parse as JSON array of URLs (common format for deep links)
            if let Ok(urls) = serde_json::from_str::<Vec<String>>(payload) {
                if let Some(first_url) = urls.first() {
                    if let Ok(url) = url::Url::parse(first_url) {
                        handle_deep_link(&app_handle, &url);
                        return;
                    }
                }
            }
            log::warn!("Failed to parse deep link payload: {}", payload);
        }
    });
}

/// Handle incoming deep links
fn handle_deep_link(app: &AppHandle, url: &url::Url) {
    log::info!("Handling deep link: {}", url);

    // Log to file on Windows for debugging
    #[cfg(all(target_os = "windows", not(debug_assertions)))]
    {
        use std::io::Write;
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(std::env::temp_dir().join("gatewayz-desktop.log"))
        {
            let _ = writeln!(file, "[{}] Deep link received: {}", chrono_lite(), url);
        }
    }

    // Get the main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();

        // Route based on the URL path
        match url.path() {
            "/chat" => {
                // Open a new chat or specific chat
                if let Some(chat_id) = url.query_pairs().find(|(k, _)| k == "id").map(|(_, v)| v) {
                    let _ = window.emit("navigate", format!("/chat?id={}", chat_id));
                } else {
                    let _ = window.emit("new-chat", ());
                }
            }
            "/auth/callback" => {
                // Handle OAuth callback
                log::info!("Auth callback received, emitting auth-callback event");
                #[cfg(all(target_os = "windows", not(debug_assertions)))]
                {
                    use std::io::Write;
                    if let Ok(mut file) = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(std::env::temp_dir().join("gatewayz-desktop.log"))
                    {
                        let _ =
                            writeln!(file, "[{}] Auth callback - emitting event", chrono_lite());
                    }
                }
                let query = url.query().unwrap_or("");
                let _ = window.emit("auth-callback", query);
            }
            _ => {
                // Navigate to the path directly via event
                let path = url.path();
                let _ = window.emit("navigate", path);
            }
        }
    } else {
        log::error!("Failed to get main window for deep link handling");
    }
}
