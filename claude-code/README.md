# Claude Code Router + GatewayZ Setup

Easy one-command setup for Claude Code Router with GatewayZ across all platforms.

## 🚀 Quick Install

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex
```

Or download and run:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1" -OutFile "setup.ps1"
powershell -ExecutionPolicy Bypass -File setup.ps1
```

### macOS
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)
```

### Linux
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)
```

## 📋 What It Does

The setup script will:
1. ✅ Check for Node.js installation
2. ✅ Install Claude Code Router globally
3. ✅ Configure your GatewayZ API key
4. ✅ Create optimal routing configuration
5. ✅ Test the connection
6. ✅ Start Claude Code (optional)

## 🔑 Get Your API Key

1. Visit https://gatewayz.ai/settings/keys
2. Click "Generate API Key"
3. Copy your key
4. Paste when prompted during setup

## 🤖 Available Models

The router comes pre-configured with:

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| `claude-3.7-sonnet` | Default tasks | Fast | Medium |
| `deepseek-chat` | Background ops | Very Fast | Very Low |
| `claude-3.5-sonnet` | Complex reasoning | Fast | Medium |
| `gemini-1.5-pro` | Long context (100k+) | Fast | Low |
| `gemini-2.0-flash-exp` | Web search | Very Fast | Very Low |
| `gpt-4` | Alternative | Medium | High |
| `claude-3-opus` | Most capable | Slow | High |
| `claude-3-haiku` | Fastest | Very Fast | Very Low |

## 💡 Usage

### Start Coding
```bash
ccr code
```

### Switch Models On-the-Fly
While in Claude Code, use the `/model` command:
```
/model gatewayz,openai/gpt-4
/model gatewayz,deepseek/deepseek-chat
/model gatewayz,anthropic/claude-3-opus
```

### Web Configuration UI
```bash
ccr ui
```

### Check Current Setup
```bash
# View configuration
cat ~/.claude-code-router/config.json

# Test connection
curl -H "Authorization: Bearer $GATEWAYZ_API_KEY" https://api.gatewayz.ai/
```

## 🎯 Smart Routing

The router automatically selects the best model for each task:

- **General tasks** → Claude 3.7 Sonnet
- **Background operations** → DeepSeek Chat (cost-effective)
- **Complex reasoning** → Claude 3.5 Sonnet
- **Documents >100k tokens** → Gemini 1.5 Pro
- **Web search tasks** → Gemini 2.0 Flash

You can override this anytime with `/model`.

## 🔧 Configuration

### Location
- **Windows**: `%USERPROFILE%\.claude-code-router\config.json`
- **macOS/Linux**: `~/.claude-code-router/config.json`

### Environment Variable
The router uses `$GATEWAYZ_API_KEY` environment variable.

**Set it manually:**

```bash
# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', 'your-key', 'User')

# macOS/Linux
export GATEWAYZ_API_KEY="your-key"
echo 'export GATEWAYZ_API_KEY="your-key"' >> ~/.bashrc
```

### Add Custom Models

Edit `~/.claude-code-router/config.json`:

```json
{
  "Providers": [{
    "name": "gatewayz",
    "models": [
      "anthropic/claude-3.7-sonnet",
      "your-custom-model-here"
    ]
  }]
}
```

### Customize Routing

```json
{
  "Router": {
    "default": "gatewayz,your-preferred-model",
    "background": "gatewayz,cost-effective-model",
    "think": "gatewayz,smart-model"
  }
}
```

## 🐛 Troubleshooting

### Node.js Not Found
**Windows:** Download from https://nodejs.org/
**macOS:** `brew install node`
**Linux:** `sudo apt-get install nodejs npm` (Ubuntu/Debian)

### Permission Denied (Linux)
```bash
sudo npm install -g @alpaca-network/claude-code-router
```

### API Key Not Set
```bash
# Check if set
echo $GATEWAYZ_API_KEY

# Set it
export GATEWAYZ_API_KEY="your-key"
```

### Router Not Found After Install
Restart your terminal or:
```bash
# Add npm global bin to PATH
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Connection Failed
1. Check your API key at https://gatewayz.ai/settings/keys
2. Ensure you have credits/requests remaining
3. Verify key is active (not expired)

## 📊 Monitor Usage

Track your API usage at:
- **Dashboard**: https://gatewayz.ai
- **Activity**: https://gatewayz.ai/settings/activity
- **API Keys**: https://gatewayz.ai/settings/keys

## 🎁 Benefits

✅ **One Command Install** - Works on all platforms
✅ **Smart Routing** - Best model for each task
✅ **Cost Optimization** - Route to cheaper models
✅ **Multiple Providers** - Access 10+ models
✅ **Dynamic Switching** - Change models anytime
✅ **Usage Tracking** - Monitor in GatewayZ dashboard
✅ **Auto Failover** - Seamless fallback
✅ **Environment-Based Config** - Secure API key handling

## 📚 Resources

- **GatewayZ**: https://gatewayz.ai
- **Claude Code Router**: https://github.com/Alpaca-Network/claude-code-router
- **Documentation**: https://gatewayz.ai/docs
- **Support**: https://github.com/Alpaca-Network/gatewayz-frontend/issues

## 🆘 Get Help

- Check the [troubleshooting section](#-troubleshooting)
- View logs: `ccr code --verbose`
- Test connection: `curl -H "Authorization: Bearer $GATEWAYZ_API_KEY" https://api.gatewayz.ai/`
- Open an issue: https://github.com/Alpaca-Network/gatewayz-frontend/issues

---

🤖 Setup scripts maintained by GatewayZ
📝 Powered by [Claude Code](https://claude.com/claude-code)
