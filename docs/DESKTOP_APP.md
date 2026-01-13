# GatewayZ Desktop App

GatewayZ Desktop is a native desktop application for macOS and Windows that provides the full GatewayZ chat experience with additional desktop-specific features.

## Features

### Core Features
- **Native Desktop Experience**: Full GatewayZ chat interface in a native app window
- **System Tray Integration**: Quick access to GatewayZ from the system tray
- **Global Keyboard Shortcuts**: `Cmd/Ctrl+Shift+G` to show/focus GatewayZ
- **Desktop Notifications**: Native system notifications for chat updates
- **Automatic Updates**: Built-in auto-updater for seamless updates

### Desktop-Specific Features
- **Minimize to Tray**: Keep GatewayZ running in the background
- **Always on Top Mode**: Pin the chat window above other windows
- **Deep Link Support**: `gatewayz://` protocol for quick navigation
- **Secure Token Storage**: Encrypted credential storage using Tauri's secure store
- **Window State Persistence**: Remembers window size and position

## Development

### Prerequisites

- **Node.js**: v20 or later
- **pnpm**: v9 or later
- **Rust**: Latest stable (install via [rustup](https://rustup.rs/))
- **Platform-specific dependencies**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools with C++ workload

### Setup

1. Install frontend dependencies:
   ```bash
   cd frontend
   pnpm install
   ```

2. Run in development mode:
   ```bash
   pnpm tauri:dev
   ```
   This starts the Next.js dev server and opens the Tauri desktop app.

### Project Structure

```
frontend/
├── src-tauri/           # Tauri/Rust backend
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── lib.rs       # Core functionality
│   │   └── commands.rs  # IPC command handlers
│   ├── icons/           # App icons
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
├── src/lib/desktop/     # TypeScript desktop utilities
│   ├── tauri.ts         # Tauri API wrappers
│   ├── hooks.ts         # React hooks
│   └── auth.ts          # Desktop authentication
└── src/components/providers/
    └── desktop-provider.tsx  # Desktop context provider
```

## Building

### Development Build
```bash
pnpm tauri:dev
```

### Production Builds

**Universal macOS (Intel + Apple Silicon):**
```bash
pnpm tauri:build:mac
```

**macOS Intel only:**
```bash
pnpm tauri:build:mac-intel
```

**macOS Apple Silicon only:**
```bash
pnpm tauri:build:mac-arm
```

**Windows x64:**
```bash
pnpm tauri:build:windows
```

**All platforms:**
```bash
pnpm tauri:build:all
```

### Build Outputs

- **macOS**: `.dmg` and `.app` in `src-tauri/target/release/bundle/`
- **Windows**: `.exe` and `.msi` in `src-tauri/target/release/bundle/`

## Configuration

### Tauri Configuration (`tauri.conf.json`)

Key configuration options:

```json
{
  "build": {
    "devUrl": "http://localhost:3000",  // Dev server URL
    "frontendDist": "https://app.gatewayz.io"  // Production URL
  },
  "app": {
    "windows": [{
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600
    }],
    "trayIcon": {
      "iconPath": "icons/icon.png"
    }
  }
}
```

### Environment Variables

For desktop OAuth (optional):
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth client ID
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`: GitHub OAuth client ID

## IPC Commands

The desktop app exposes these commands to the frontend:

| Command | Description |
|---------|-------------|
| `get_app_version` | Get app version info |
| `get_platform_info` | Get OS/platform info |
| `show_notification` | Show system notification |
| `open_external_url` | Open URL in browser |
| `get_auth_token` | Get stored auth token |
| `set_auth_token` | Store auth token |
| `clear_auth_token` | Clear auth token |
| `check_for_updates` | Check for app updates |
| `install_update` | Install pending update |
| `toggle_always_on_top` | Toggle always-on-top |
| `minimize_to_tray` | Minimize to system tray |

## Auto Updates

The app checks for updates from:
```
https://api.gatewayz.io/desktop/updates/{{target}}/{{arch}}/{{current_version}}
```

To enable updates:
1. Generate a signing key pair
2. Set `TAURI_SIGNING_PRIVATE_KEY` in CI/CD
3. Configure the public key in `tauri.conf.json`

## Deep Links

The app handles the `gatewayz://` protocol:

- `gatewayz://chat` - Open new chat
- `gatewayz://chat?id=xxx` - Open specific chat
- `gatewayz://auth/callback?code=xxx` - OAuth callback
- `gatewayz://settings` - Open settings

## Testing

Run desktop-specific tests:
```bash
pnpm test:desktop
```

## CI/CD

The desktop app is built via GitHub Actions:

- **Trigger**: Push to `main`, tags starting with `v*`, or manual dispatch
- **Platforms**: macOS (ARM64, x64), Windows (x64)
- **Artifacts**: DMG, app bundle, EXE, MSI

### Required Secrets

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Update signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `APPLE_CERTIFICATE` | Apple signing cert (base64) |
| `APPLE_CERTIFICATE_PASSWORD` | Cert password |
| `APPLE_SIGNING_IDENTITY` | Signing identity |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

## Troubleshooting

### Common Issues

**"App is damaged" on macOS:**
- The app needs to be signed and notarized
- For development: `xattr -cr /path/to/GatewayZ.app`

**Windows SmartScreen warning:**
- The app needs to be code-signed with an EV certificate
- For development: Click "More info" → "Run anyway"

**Rust compilation errors:**
- Ensure Rust is up to date: `rustup update stable`
- Clear cargo cache: `cargo clean`

**WebView issues:**
- Check that the production URL is accessible
- Verify CORS settings allow desktop app origin

## License

MIT License - See [LICENSE](../LICENSE) for details.
