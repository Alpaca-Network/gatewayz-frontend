# Claude Code Router + GatewayZ Integration

This setup configures Claude Code to use [claude-code-router](https://github.com/Alpaca-Network/claude-code-router) with GatewayZ as the API provider.

## 🚀 Quick Start

### Option 1: PowerShell Script (Recommended)
```powershell
powershell -ExecutionPolicy Bypass -File ~/.claude-code-router/quickstart.ps1
```

### Option 2: Manual Installation
```bash
# Install the router
npm install -g @alpaca-network/claude-code-router

# Set your GatewayZ API key
setx GATEWAYZ_API_KEY "your-api-key-here"

# Start the router
ccr code
```

## 📁 Configuration Files Created

All configuration files are in `~/.claude-code-router/`:
- **config.json** - Main router configuration
- **setup.bat** - Windows batch setup script
- **quickstart.ps1** - PowerShell setup script (recommended)
- **README.md** - Detailed documentation

## 🔑 Getting Your API Key

1. Go to https://gatewayz.ai/settings/keys
2. Click "Generate API Key"
3. Copy your primary API key
4. Set it in your environment:
   ```powershell
   $env:GATEWAYZ_API_KEY = "your-key"
   [System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', 'your-key', 'User')
   ```

## 🤖 Available Models

The router is configured with the following GatewayZ models:

| Model | Purpose | Cost |
|-------|---------|------|
| `anthropic/claude-sonnet-5-5` | Default - general tasks and complex reasoning | Medium |
| `openai/gpt-5.4-mini` | Background tasks and web search | Very Low |
| `grok-4` | Long context (100k+ tokens) | Medium |
| `openai/gpt-5.5` | Alternative reasoning | Medium |
| `anthropic/claude-haiku-4-5-20251001` | Fastest Claude | Low |
| `moonshot/kimi-k2.6` | Lower-cost coding | Low |
| `deepseek-ai/DeepSeek-V4.1-Flash` | Lower-cost coding | Very Low |
| `deepseek-ai/DeepSeek-V4-Pro` | Lower-cost reasoning | Low |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo` | Coding | Low |
| `zai-org/GLM-5.3` | Coding | Low |

## 🎯 Routing Strategy

The router automatically selects the best model for each task:

```json
{
  "default": "anthropic/claude-sonnet-5-5",
  "background": "openai/gpt-5.4-mini",
  "think": "anthropic/claude-sonnet-5-5",
  "longContext": "grok-4",
  "webSearch": "openai/gpt-5.4-mini"
}
```

- **Default tasks** → Claude 3.7 Sonnet (best balance)
- **Background operations** → DeepSeek Chat (cost-effective)
- **Complex reasoning** → Claude 3.5 Sonnet (advanced)
- **Long documents (>100k tokens)** → Gemini 1.5 Pro
- **Web search tasks** → Gemini 2.0 Flash

## 💡 Usage

### Start Claude Code Router
```bash
ccr code
```

### Switch Models Dynamically
While in Claude Code, use the `/model` command:
```
/model gatewayz,openai/gpt-4
/model gatewayz,deepseek-ai/DeepSeek-V4.1-Flash
```

### Open Web UI
```bash
ccr ui
```

## 🔧 Advanced Configuration

### Edit Configuration
```bash
notepad ~/.claude-code-router/config.json
```

### Add Custom Models
Edit the `models` array in `config.json`:
```json
{
  "Providers": [{
    "name": "gatewayz",
    "models": [
      "anthropic/claude-sonnet-5-5",
      "your-new-model"
    ]
  }]
}
```

### Customize Routing Rules
Modify the `Router` section:
```json
{
  "Router": {
    "default": "gatewayz,your-preferred-model",
    "background": "gatewayz,cost-effective-model",
    "think": "gatewayz,powerful-model"
  }
}
```

## ✅ Benefits

- **Unified API**: Access multiple AI providers through GatewayZ
- **Cost Optimization**: Automatically route to cost-effective models
- **Failover Protection**: Seamless fallback if a model is unavailable
- **Usage Tracking**: Monitor API usage in the GatewayZ dashboard
- **Flexible Routing**: Choose the best model for each task
- **Dynamic Switching**: Change models on-the-fly with `/model` command

## 🐛 Troubleshooting

### API Key Not Found
```powershell
# Check if set
$env:GATEWAYZ_API_KEY

# Set it
[System.Environment]::SetEnvironmentVariable('GATEWAYZ_API_KEY', 'your-key', 'User')
```

### Connection Issues
1. Verify your API key at https://gatewayz.ai/settings/keys
2. Check if the key is active
3. Ensure you have credits/requests remaining

### Model Not Available
Update the `config.json` with available models from your GatewayZ dashboard

### Router Not Starting
```bash
# Reinstall
npm install -g @alpaca-network/claude-code-router

# Check logs
ccr code --verbose
```

## 📚 Resources

- **GatewayZ Dashboard**: https://gatewayz.ai
- **API Keys**: https://gatewayz.ai/settings/keys
- **Usage Stats**: https://gatewayz.ai/settings/activity
- **Claude Code Router**: https://github.com/Alpaca-Network/claude-code-router

## 🎉 What's Next?

1. Run the quickstart script: `powershell ~/.claude-code-router/quickstart.ps1`
2. Start coding: `ccr code`
3. Try different models with `/model`
4. Monitor usage in GatewayZ dashboard

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
