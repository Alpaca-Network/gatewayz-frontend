#!/usr/bin/env pwsh
# Claude Code on Gatewayz - setup for Windows
# Usage: powershell -ExecutionPolicy Bypass -File setup-windows.ps1 [-ApiKey <key>]
#
# Installs Claude Code (if missing) and a `gatewayz` command that starts it on
# your Gatewayz key. Your normal `claude` command is not changed. The key and
# settings live in %USERPROFILE%\.gatewayz\claude-settings.json, readable only
# by your account.
#
# Claude Code talks to Gatewayz directly (https://api.gatewayz.ai, Anthropic
# Messages API). No router or proxy is installed.

param(
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

# Override for testing only (CI points it at an unreachable address).
$GatewayzUrl = if ($env:GATEWAYZ_BASE_URL) { $env:GATEWAYZ_BASE_URL } else { "https://api.gatewayz.ai" }
$KeysPage = "https://beta.gatewayz.ai/settings/keys"
$DefaultModel = "anthropic/claude-sonnet-5-5"
$SmallModel = "anthropic/claude-haiku-4-5-20251001"
$ConfigDir = Join-Path $env:USERPROFILE ".gatewayz"
$SettingsFile = Join-Path $ConfigDir "claude-settings.json"
$StatuslineFile = Join-Path $ConfigDir "statusline.js"
$BinDir = Join-Path $ConfigDir "bin"
$Launcher = Join-Path $BinDir "gatewayz.cmd"

function Write-Step([string]$Message) { Write-Host "→ $Message" -ForegroundColor Yellow }
function Write-Ok([string]$Message) { Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Fail([string]$Message) { Write-Host "✗ $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Claude Code on Gatewayz - Setup           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Node.js
Write-Step "Checking Node.js installation..."
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Ok "Node.js $(node --version) and npm $(npm --version) installed"
} else {
    Write-Fail "Node.js is not installed"
    Write-Host "Install it from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Claude Code
Write-Host ""
Write-Step "Checking Claude Code..."
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Ok "Claude Code already installed"
} else {
    Write-Host "Running: npm install -g @anthropic-ai/claude-code" -ForegroundColor Gray
    npm install -g @anthropic-ai/claude-code | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to install Claude Code"
        Write-Host "Try manually: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
        exit 1
    }
    Write-Ok "Claude Code installed"
}

# Step 3: API key
Write-Host ""
Write-Step "Setting up your Gatewayz API key..."
if (-not $ApiKey) { $ApiKey = $env:GATEWAYZ_API_KEY }
if (-not $ApiKey) {
    Write-Host ""
    Write-Host "You need a Gatewayz API key:" -ForegroundColor White
    Write-Host "  1. Visit: $KeysPage" -ForegroundColor White
    Write-Host "  2. Sign in and click 'Generate API Key' if you don't have one" -ForegroundColor White
    Write-Host "  3. Copy the key" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to open the API keys page in your browser, or Ctrl+C to cancel" | Out-Null
    Start-Process $KeysPage
    $secure = Read-Host "Paste your Gatewayz API key (input hidden)" -AsSecureString
    $ApiKey = [System.Net.NetworkCredential]::new("", $secure).Password
    if (-not $ApiKey) {
        Write-Fail "No API key provided. Run this script again when you have one."
        exit 1
    }
}

# Step 4: Check the key against Gatewayz
Write-Step "Checking the key..."
try {
    $body = @{ model = $DefaultModel; messages = @(@{ role = "user"; content = "hi" }) } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Post -Uri "$GatewayzUrl/v1/messages/count_tokens" `
        -Headers @{ "x-api-key" = $ApiKey } -ContentType "application/json" -Body $body -TimeoutSec 30 | Out-Null
    Write-Ok "Key accepted by Gatewayz"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401 -or $status -eq 403) {
        Write-Fail "Gatewayz rejected this key (HTTP $status). Check it at $KeysPage"
        exit 1
    }
    Write-Host "⚠ Could not verify the key (HTTP $status). Continuing; check your connection." -ForegroundColor Yellow
}

# Step 5: Settings file
Write-Host ""
Write-Step "Writing Claude Code settings for Gatewayz..."
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
$settings = @{
    env = [ordered]@{
        ANTHROPIC_BASE_URL = $GatewayzUrl
        ANTHROPIC_AUTH_TOKEN = $ApiKey
        ANTHROPIC_MODEL = $DefaultModel
        ANTHROPIC_DEFAULT_HAIKU_MODEL = $SmallModel
        CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1"
        ANTHROPIC_CUSTOM_HEADERS = "x-gatewayz-passthrough: true"
    }
    statusLine = [ordered]@{
        type = "command"
        command = "node `"$StatuslineFile`""
    }
}
$settings | ConvertTo-Json -Depth 5 | Set-Content -Path $SettingsFile -Encoding UTF8
# Readable only by the current user: drop inherited permissions, grant the owner.
icacls $SettingsFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Ok "Settings saved to $SettingsFile (readable only by you)"

# Status line shown under the prompt: "Gatewayz · <model> · $<credits left>".
@'
#!/usr/bin/env node
// Claude Code status line for Gatewayz sessions: "Gatewayz · <model> · $<credits left>".
//
// Claude Code runs this command and passes session details as JSON on stdin.
// The balance comes from GET <ANTHROPIC_BASE_URL>/user/balance with the
// session's key, cached for 60 seconds. If anything fails, the model is still
// shown and the balance is left out. The key is never printed or stored.
const fs = require("fs");
const os = require("os");
const path = require("path");

const CACHE_SECONDS = 60;
const CACHE_FILE = path.join(os.tmpdir(), `gatewayz-statusline-${os.userInfo().username}.json`);
const PREFIX = "claude-code/";

function modelName(session) {
  const model = session && session.model;
  let name = "";
  if (model && typeof model === "object") name = model.display_name || model.id || "";
  else if (model) name = String(model);
  if (!name) name = process.env.ANTHROPIC_MODEL || "";
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}

async function balance() {
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (Date.now() / 1000 - cached.at < CACHE_SECONDS) return cached.credits;
  } catch {}
  const key = process.env.ANTHROPIC_AUTH_TOKEN;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.gatewayz.ai").replace(/\/+$/, "");
  if (!key) return null;
  try {
    const response = await fetch(`${base}/user/balance`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const credits = Number((await response.json()).credits);
    if (!Number.isFinite(credits)) return null;
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now() / 1000, credits }), {
        mode: 0o600,
      });
    } catch {}
    return credits;
  } catch {
    return null;
  }
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  let session = {};
  try {
    session = JSON.parse(input);
  } catch {}
  const parts = ["Gatewayz"];
  const name = modelName(session);
  if (name) parts.push(name);
  const credits = await balance();
  if (credits !== null) parts.push(`$${credits.toFixed(2)}`);
  console.log(parts.join(" · "));
});
'@ | Set-Content -Path $StatuslineFile -Encoding UTF8
Write-Ok "Status line installed (model and credits left, under the prompt)"

# Step 6: gatewayz command
Write-Host ""
Write-Step "Installing the gatewayz command..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
@"
@echo off
rem Start Claude Code on Gatewayz. Everything after gatewayz goes to claude,
rem for example:  gatewayz --model openai/gpt-5.5
claude --settings "%USERPROFILE%\.gatewayz\claude-settings.json" %*
"@ | Set-Content -Path $Launcher -Encoding ASCII
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if (-not ($userPath -split ";" | Where-Object { $_ -eq $BinDir })) {
    [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
    Write-Ok "Added $BinDir to your user PATH (open a new terminal to use it)"
}
Write-Ok "Installed $Launcher"

if (Get-Command ccr -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "Note: Claude Code Router (ccr) is no longer needed for Gatewayz." -ForegroundColor Gray
    Write-Host "You can remove it with: npm uninstall -g @alpaca-network/claude-code-router" -ForegroundColor Gray
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Setup complete                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Start a session (in a new terminal):" -ForegroundColor Cyan
Write-Host "  gatewayz                         - Claude Code on Gatewayz (Claude Sonnet 5.5)" -ForegroundColor White
Write-Host "  gatewayz --model openai/gpt-5.5  - start on another model" -ForegroundColor White
Write-Host ""
Write-Host "Inside a session:" -ForegroundColor Cyan
Write-Host "  /model                - pick from the Gatewayz models listed" -ForegroundColor White
Write-Host "  /model <model id>     - switch to any model by id, e.g. /model moonshot/kimi-k2.6" -ForegroundColor White
Write-Host ""
Write-Host "Your normal 'claude' command is unchanged. Model ids: $GatewayzUrl/v1/models" -ForegroundColor Gray
Write-Host ""
