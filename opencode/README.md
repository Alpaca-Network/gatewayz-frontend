# OpenCode + GatewayZ Setup

Easy one-command setup for OpenCode with GatewayZ across all platforms.

## Quick Install

### macOS
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-macos.sh)
```

### Linux
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-linux.sh)
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-windows.ps1 | iex
```

Or download and run:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-windows.ps1" -OutFile "setup.ps1"
powershell -ExecutionPolicy Bypass -File setup.ps1
```

## What It Does

The setup script will:
1. Install OpenCode CLI (via Homebrew, curl installer, Scoop, Chocolatey, or npm)
2. Configure GatewayZ as your AI provider
3. Set up your API key
4. Create optimal configuration
5. Test the connection

## Get Your API Key

1. Visit https://beta.gatewayz.ai/settings/keys
2. Click "Generate API Key"
3. Copy your key
4. Paste when prompted during setup

## Available Models

Through GatewayZ, you get access to 1000+ models including:

| Model | Provider | Use Case |
|-------|----------|----------|
| `anthropic/claude-sonnet-4.5` | Anthropic | Fast & capable (default) |
| `anthropic/claude-opus-4` | Anthropic | Most capable |
| `openai/gpt-5` | OpenAI | Latest GPT |
| `openai/gpt-5-mini` | OpenAI | Fast & cost-effective |
| `google/gemini-2.5-pro` | Google | Long context |
| `google/gemini-2.5-flash` | Google | Fast |
| `x-ai/grok-3-turbo-preview` | xAI | Fast reasoning |
| `x-ai/grok-code-fast-1` | xAI | Optimized for coding |
| `deepseek/deepseek-v3.1` | DeepSeek | Cost effective |

## Usage

### Start OpenCode
```bash
opencode
```

### Run a Single Prompt
```bash
opencode run "explain this code"
```

### Switch Between Agents
Use `Tab` key in the TUI to switch between:
- **build**: Full-access agent for development
- **plan**: Read-only agent for code exploration

### Mention Subagents
Use `@general` in your messages for complex searches.

## Configuration

### Location
- **Windows**: `%USERPROFILE%\.opencode\config.json`
- **macOS/Linux**: `~/.opencode/config.json`

### Environment Variables
The setup configures these environment variables:

```bash
# GatewayZ API Key
GATEWAYZ_API_KEY="your-key"

# OpenCode uses OpenAI-compatible API
OPENAI_API_KEY="your-key"
OPENAI_BASE_URL="https://api.gatewayz.ai/v1"
```

**Set them manually:**

```bash
# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', 'your-key', 'User')
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'your-key', 'User')
[System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', 'https://api.gatewayz.ai/v1', 'User')

# macOS/Linux
export GATEWAYZ_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export OPENAI_BASE_URL="https://api.gatewayz.ai/v1"
```

### Configuration File

```json
{
  "provider": {
    "type": "openai",
    "api_key": "your-api-key",
    "base_url": "https://api.gatewayz.ai/v1"
  },
  "model": {
    "default": "anthropic/claude-sonnet-4.5",
    "available": [
      "anthropic/claude-sonnet-4.5",
      "openai/gpt-5",
      "google/gemini-2.5-pro"
    ]
  }
}
```

## Troubleshooting

### OpenCode Not Found After Install
Restart your terminal or add to PATH:
```bash
export PATH="$HOME/bin:$HOME/.opencode/bin:$PATH"
```

### API Key Not Set
```bash
# Check if set
echo $GATEWAYZ_API_KEY

# Set it
export GATEWAYZ_API_KEY="your-key"
```

### Permission Denied (Linux)
```bash
sudo npm install -g opencode-ai@latest
```

### Connection Failed
1. Check your API key at https://beta.gatewayz.ai/settings/keys
2. Ensure you have credits/requests remaining
3. Verify key is active (not expired)

### Windows: Execution Policy Error
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Monitor Usage

Track your API usage at:
- **Dashboard**: https://beta.gatewayz.ai
- **Activity**: https://beta.gatewayz.ai/settings/activity
- **API Keys**: https://beta.gatewayz.ai/settings/keys

## Benefits

- **One Command Install** - Works on macOS, Linux, and Windows
- **1000+ Models** - Access models from OpenAI, Anthropic, Google, xAI, and more
- **Cost Optimization** - Choose the right model for your budget
- **Unified API** - One API key for all providers
- **Usage Tracking** - Monitor in GatewayZ dashboard
- **Secure** - Environment-based API key handling

## Resources

- **GatewayZ**: https://beta.gatewayz.ai
- **OpenCode**: https://opencode.ai
- **OpenCode Docs**: https://opencode.ai/docs
- **Support**: https://github.com/Alpaca-Network/gatewayz-frontend/issues

## Get Help

- Check the [troubleshooting section](#troubleshooting)
- View OpenCode docs: https://opencode.ai/docs
- Test connection: `curl -H "Authorization: Bearer $GATEWAYZ_API_KEY" https://api.gatewayz.ai/`
- Open an issue: https://github.com/Alpaca-Network/gatewayz-frontend/issues

---

Setup scripts maintained by GatewayZ
Powered by [OpenCode](https://opencode.ai)
