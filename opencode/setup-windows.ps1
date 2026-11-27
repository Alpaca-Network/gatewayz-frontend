#!/usr/bin/env pwsh
# OpenCode on Gatewayz - setup for Windows
# Usage: powershell -ExecutionPolicy Bypass -File setup-windows.ps1 [-ApiKey <key>]
#
# Installs OpenCode (npm) if missing and adds Gatewayz as a provider to
# OpenCode's own config (%USERPROFILE%\.config\opencode\opencode.json), keeping
# anything already there. No environment variables are changed.

param([string]$ApiKey = "")
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

# Override for testing only (CI points it at an unreachable address).
$GatewayzUrl = if ($env:GATEWAYZ_BASE_URL) { $env:GATEWAYZ_BASE_URL } else { "https://api.gatewayz.ai" }

# The key is sent to this address and every later prompt goes there: an
# override must be visible and well-formed. https only, except localhost (CI).
if ($GatewayzUrl -ne "https://api.gatewayz.ai") {
    if ($GatewayzUrl -notmatch '^(https://[A-Za-z0-9.-]+|http://(127\.0\.0\.1|localhost))(:[0-9]+)?$') {
        Write-Host "GATEWAYZ_BASE_URL is set to an address this script will not use: $GatewayzUrl" -ForegroundColor Red
        Write-Host "Remove it (Remove-Item Env:GATEWAYZ_BASE_URL) and run the script again."
        exit 1
    }
    Write-Host "GATEWAYZ_BASE_URL is set: your key and prompts will go to $GatewayzUrl, not api.gatewayz.ai." -ForegroundColor Yellow
}
$KeysPage = "https://beta.gatewayz.ai/settings/keys"
$ConfigFile = Join-Path $env:USERPROFILE ".config\opencode\opencode.json"

Write-Host ""
Write-Host "OpenCode on Gatewayz - Setup" -ForegroundColor Cyan
Write-Host ""

if (-not ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue))) {
    Write-Host "✗ Node.js is not installed. Install it from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $(node --version) installed" -ForegroundColor Green

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    Write-Host "Running: npm install -g opencode-ai" -ForegroundColor Gray
    npm install -g opencode-ai | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "✗ Failed to install OpenCode" -ForegroundColor Red; exit 1 }
    Write-Host "✓ OpenCode installed" -ForegroundColor Green
} else {
    Write-Host "✓ OpenCode already installed" -ForegroundColor Green
}

if (-not $ApiKey) { $ApiKey = $env:GATEWAYZ_API_KEY }
if (-not $ApiKey) {
    Write-Host "Get a key at $KeysPage" -ForegroundColor White
    $secure = Read-Host "Paste your Gatewayz API key (input hidden)" -AsSecureString
    $ApiKey = [System.Net.NetworkCredential]::new("", $secure).Password
    if (-not $ApiKey) { Write-Host "✗ No API key provided." -ForegroundColor Red; exit 1 }
}

try {
    Invoke-RestMethod -Uri "$GatewayzUrl/user/balance" -Headers @{ Authorization = "Bearer $ApiKey" } -TimeoutSec 30 | Out-Null
    Write-Host "✓ Key accepted by Gatewayz" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401 -or $status -eq 403) {
        Write-Host "✗ Gatewayz rejected this key (HTTP $status). Check it at $KeysPage" -ForegroundColor Red
        exit 1
    }
    Write-Host "⚠ Could not verify the key (HTTP $status). Continuing." -ForegroundColor Yellow
}

$merge = Join-Path ([System.IO.Path]::GetTempPath()) "gatewayz-opencode-merge.js"
@'
// Adds Gatewayz as a provider to OpenCode's config, keeping everything else.
// Usage: node merge-config.js <config path> <base url>   (key read from GATEWAYZ_API_KEY)
// Embedded in the setup scripts; kept here so it can be read and tested.
const fs = require("fs");
const path = require("path");

const [configPath, baseURL] = process.argv.slice(2);
const apiKey = process.env.GATEWAYZ_API_KEY;
if (!configPath || !baseURL || !apiKey) {
  console.error("usage: GATEWAYZ_API_KEY=... node merge-config.js <config> <base url>");
  process.exit(2);
}

// Models that answered tool calls through Gatewayz on 2026-11-25.
const MODELS = {
  "anthropic/claude-sonnet-5-5": "Claude Sonnet 5.5",
  "anthropic/claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "openai/gpt-5.5": "GPT-5.5",
  "openai/gpt-5.4-mini": "GPT-5.4 mini",
  "grok-4": "Grok 4",
  "moonshot/kimi-k2.6": "Kimi K2.6",
  "deepseek-ai/DeepSeek-V4.1-Flash": "DeepSeek V4.1 Flash",
  "deepseek-ai/DeepSeek-V4-Pro": "DeepSeek V4 Pro",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo": "Qwen3 Coder 480B",
  "zai-org/GLM-5.3": "GLM-5.3",
};

let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    // Never overwrite a config we cannot read: the user may have comments or
    // a syntax error in it. Stop and say so.
    console.error(`Could not read ${configPath} as JSON (${err.message}). Not changing it.`);
    process.exit(3);
  }
  fs.copyFileSync(configPath, configPath + ".bak-gatewayz");
  fs.chmodSync(configPath + ".bak-gatewayz", 0o600);
}

config.$schema = config.$schema || "https://opencode.ai/config.json";
config.provider = config.provider || {};
config.provider.gatewayz = {
  npm: "@ai-sdk/openai-compatible",
  name: "Gatewayz",
  options: { baseURL: `${baseURL.replace(/\/+$/, "")}/v1`, apiKey },
  models: Object.fromEntries(Object.entries(MODELS).map(([id, name]) => [id, { name }])),
};
if (!config.model) config.model = "gatewayz/anthropic/claude-sonnet-5-5";

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
fs.chmodSync(configPath, 0o600);
console.log(`Gatewayz provider added to ${configPath}`);
'@ | Set-Content -Path $merge -Encoding UTF8
$env:GATEWAYZ_API_KEY = $ApiKey
node $merge $ConfigFile $GatewayzUrl
$code = $LASTEXITCODE
Remove-Item $merge -ErrorAction SilentlyContinue
Remove-Item Env:GATEWAYZ_API_KEY -ErrorAction SilentlyContinue
if ($code -ne 0) { exit $code }
icacls $ConfigFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Host "✓ Config saved (readable only by you): $ConfigFile" -ForegroundColor Green
Write-Host ""
Write-Host "Setup complete. Start OpenCode with: opencode" -ForegroundColor Green
Write-Host "Pick a Gatewayz model inside OpenCode with /models (they are listed under Gatewayz)." -ForegroundColor Gray
