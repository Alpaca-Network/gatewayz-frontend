//! GatewayZ Desktop - Main entry point
//!
//! This is the main entry point for the GatewayZ desktop application.
//! It initializes the Tauri runtime and starts the application.

// Prevents an additional console window from appearing on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gatewayz_desktop_lib::run()
}
