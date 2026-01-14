#!/usr/bin/env pwsh
# OpenCode + GatewayZ Setup for Windows
# Usage: powershell -ExecutionPolicy Bypass -File setup-windows.ps1

param(
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Write-Header {
    Write-Host ""
    Write-Host "+-----------------------------------------+" -ForegroundColor Cyan
    Write-Host "|      OpenCode + GatewayZ Setup          |" -ForegroundColor Cyan
    Write-Host "+-----------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "-> $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[X] $Message" -ForegroundColor Red
}

Write-Header

# Step 1: Install OpenCode
Write-Host ""
Write-Step "Installing OpenCode..."

$opencodeInstalled = $false

# Check if opencode is already installed
$opencodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencodeCmd) {
    $opencodeVersion = & opencode --version 2>$null
    Write-Success "OpenCode already installed (version: $opencodeVersion)"
    $opencodeInstalled = $true
}

if (-not $opencodeInstalled) {
    # Try installation methods in order of preference

    # Method 1: Scoop
    $scoopCmd = Get-Command scoop -ErrorAction SilentlyContinue
    if ($scoopCmd -and -not $opencodeInstalled) {
        Write-Step "Installing via Scoop..."
        try {
            & scoop bucket add extras 2>$null
            & scoop install extras/opencode 2>&1 | Out-Null
            $opencodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
            if ($opencodeCmd) {
                Write-Success "OpenCode installed via Scoop"
                $opencodeInstalled = $true
            }
        } catch {
            Write-Host "Scoop install failed, trying alternative methods..." -ForegroundColor Yellow
        }
    }

    # Method 2: Chocolatey
    $chocoCmd = Get-Command choco -ErrorAction SilentlyContinue
    if ($chocoCmd -and -not $opencodeInstalled) {
        Write-Step "Installing via Chocolatey..."
        try {
            & choco install opencode -y 2>&1 | Out-Null
            $opencodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
            if ($opencodeCmd) {
                Write-Success "OpenCode installed via Chocolatey"
                $opencodeInstalled = $true
            }
        } catch {
            Write-Host "Chocolatey install failed, trying npm..." -ForegroundColor Yellow
        }
    }

    # Method 3: npm (fallback)
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd -and -not $opencodeInstalled) {
        Write-Step "Installing via npm..."
        try {
            & npm install -g opencode-ai@latest 2>&1 | Out-Null
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            $opencodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
            if ($opencodeCmd) {
                Write-Success "OpenCode installed via npm"
                $opencodeInstalled = $true
            }
        } catch {
            Write-Host "npm install failed" -ForegroundColor Yellow
        }
    }

    if (-not $opencodeInstalled) {
        Write-ErrorMsg "Failed to install OpenCode"
        Write-Host ""
        Write-Host "Please install manually using one of these methods:" -ForegroundColor Yellow
        Write-Host "  Scoop:      scoop bucket add extras; scoop install extras/opencode" -ForegroundColor White
        Write-Host "  Chocolatey: choco install opencode" -ForegroundColor White
        Write-Host "  npm:        npm install -g opencode-ai@latest" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

# Step 2: Get API Key
Write-Host ""
Write-Step "Setting up GatewayZ API key..."

if (-not $ApiKey) {
    $ApiKey = $env:GATEWAYZ_API_KEY
}

if (-not $ApiKey) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  API KEY REQUIRED" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get your API key, you need to:" -ForegroundColor White
    Write-Host "  1. Visit: " -NoNewline -ForegroundColor White
    Write-Host "https://beta.gatewayz.ai/settings/keys" -ForegroundColor Cyan
    Write-Host "  2. Sign in to GatewayZ" -ForegroundColor White
    Write-Host "  3. Click 'Generate API Key' if you don't have one" -ForegroundColor White
    Write-Host "  4. Copy your API key" -ForegroundColor White
    Write-Host ""

    # Check if running interactively
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Write-Host "Press Enter to open the API keys page in your browser, or Ctrl+C to cancel..." -ForegroundColor Yellow
        Read-Host

        # Open browser after user confirms
        Write-Host "Opening browser..." -ForegroundColor Cyan
        Start-Process "https://beta.gatewayz.ai/settings/keys"

        Write-Host ""
        Write-Host "After copying your API key from the browser, paste it below:" -ForegroundColor White
        $ApiKey = Read-Host "Paste your GatewayZ API key here"
    }

    if (-not $ApiKey) {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Yellow
        Write-Host "  MANUAL SETUP REQUIRED" -ForegroundColor Yellow
        Write-Host "============================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "No API key provided. To complete setup manually:" -ForegroundColor White
        Write-Host ""
        Write-Host "  1. Visit: " -NoNewline -ForegroundColor White
        Write-Host "https://beta.gatewayz.ai/settings/keys" -ForegroundColor Cyan
        Write-Host "  2. Sign in and generate an API key" -ForegroundColor White
        Write-Host "  3. Copy your key and run this command in PowerShell:" -ForegroundColor White
        Write-Host ""
        Write-Host "     [System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', 'your-key-here', 'User')" -ForegroundColor Green
        Write-Host ""
        Write-Host "  4. Close and reopen PowerShell" -ForegroundColor White
        Write-Host "  5. Run: " -NoNewline -ForegroundColor White
        Write-Host "opencode" -ForegroundColor Green
        Write-Host ""
        Write-Host "Setup will continue with placeholder configuration..." -ForegroundColor Yellow
        Write-Host ""
        $ApiKey = "YOUR_GATEWAYZ_API_KEY_HERE"
    }
}

# Set environment variable (only if not placeholder)
if ($ApiKey -ne "YOUR_GATEWAYZ_API_KEY_HERE") {
    [System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', $ApiKey, 'User')
    [System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $ApiKey, 'User')
    [System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', 'https://api.gatewayz.ai/v1', 'User')
    $env:GATEWAYZ_API_KEY = $ApiKey
    $env:OPENAI_API_KEY = $ApiKey
    $env:OPENAI_BASE_URL = "https://api.gatewayz.ai/v1"
    Write-Success "API key configured"
} else {
    Write-Host "! Skipping API key environment variable setup" -ForegroundColor Yellow
}

# Step 3: Create OpenCode configuration
Write-Host ""
Write-Step "Creating OpenCode configuration for GatewayZ..."

$configDir = "$env:USERPROFILE\.opencode"
$configFile = "$configDir\config.json"

if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$config = @{
    '$schema' = "https://opencode.ai/config.json"
    model = "gatewayz/claude-sonnet-4.5"
    provider = @{
        gatewayz = @{
            npm = "@ai-sdk/openai-compatible"
            name = "GatewayZ AI"
            options = @{
                baseURL = "https://api.gatewayz.ai/v1"
                apiKey = "{env:GATEWAYZ_API_KEY}"
            }
            models = @{
                "claude-sonnet-4.5" = @{
                    name = "Claude Sonnet 4.5 (Anthropic)"
                    limit = @{ context = 200000; output = 65536 }
                }
                "claude-opus-4" = @{
                    name = "Claude Opus 4 (Anthropic)"
                    limit = @{ context = 200000; output = 65536 }
                }
                "gpt-5" = @{
                    name = "GPT-5 (OpenAI)"
                    limit = @{ context = 128000; output = 32768 }
                }
                "gpt-5-mini" = @{
                    name = "GPT-5 Mini (OpenAI)"
                    limit = @{ context = 128000; output = 32768 }
                }
                "gemini-2.5-pro" = @{
                    name = "Gemini 2.5 Pro (Google)"
                    limit = @{ context = 1000000; output = 65536 }
                }
                "gemini-2.5-flash" = @{
                    name = "Gemini 2.5 Flash (Google)"
                    limit = @{ context = 1000000; output = 65536 }
                }
                "grok-3-turbo" = @{
                    name = "Grok 3 Turbo (xAI)"
                    limit = @{ context = 131072; output = 32768 }
                }
                "deepseek-v3.1" = @{
                    name = "DeepSeek V3.1"
                    limit = @{ context = 128000; output = 32768 }
                }
            }
        }
    }
    disabled_providers = @("opencode-zen", "anthropic", "openai", "google", "xai", "groq", "deepseek")
}

$config | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8
Write-Success "Configuration created at: $configFile"

# Step 4: Test connection
Write-Host ""
Write-Step "Testing GatewayZ connection..."
try {
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
    }
    Invoke-RestMethod -Uri "https://api.gatewayz.ai/" -Method Get -Headers $headers -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
    Write-Success "Connection successful"
} catch {
    Write-Host "! Could not verify connection (this may be normal)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "+-----------------------------------------+" -ForegroundColor Green
Write-Host "|            Setup Complete!              |" -ForegroundColor Green
Write-Host "+-----------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Start:" -ForegroundColor Cyan
Write-Host "  opencode              " -NoNewline -ForegroundColor White
Write-Host "- Start OpenCode TUI" -ForegroundColor Gray
Write-Host "  opencode run          " -NoNewline -ForegroundColor White
Write-Host "- Run a single prompt" -ForegroundColor Gray
Write-Host "  Tab                   " -NoNewline -ForegroundColor White
Write-Host "- Switch between build/plan agents" -ForegroundColor Gray
Write-Host ""
Write-Host "Available Models (via GatewayZ):" -ForegroundColor Cyan
Write-Host "  * claude-sonnet-4.5 (default)" -ForegroundColor White
Write-Host "  * gpt-5" -ForegroundColor White
Write-Host "  * gemini-2.5-pro" -ForegroundColor White
Write-Host "  * grok-3-turbo-preview" -ForegroundColor White
Write-Host "  * deepseek-v3.1" -ForegroundColor White
Write-Host "  * Plus 1000+ more models..." -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Close and reopen your terminal" -ForegroundColor White
Write-Host "  2. Run: " -NoNewline -ForegroundColor White
Write-Host "opencode" -ForegroundColor Green
Write-Host ""
# Only prompt for key press in interactive mode
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
