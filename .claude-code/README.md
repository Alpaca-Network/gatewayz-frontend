# GatewayZ Claude Code Router

This directory contains configuration files for integrating [claude-code-router](https://github.com/musistudio/claude-code-router) with GatewayZ API instead of OpenRouter.

## 📁 Files

- `config.json` - Main configuration file with GatewayZ provider setup
- `custom-router.js` - Dynamic routing logic for optimal model selection
- `README.md` - This file

## 🚀 Setup

### 1. Install claude-code-router

```bash
npm install -g claude-code-router
# or
pnpm add -g claude-code-router
```

### 2. Set Environment Variables

Add your GatewayZ API key to your environment:

```bash
# Windows (PowerShell)
$env:GATEWAYZ_API_KEY="gw_live_your_api_key_here"

# Windows (Command Prompt)
set GATEWAYZ_API_KEY=gw_live_your_api_key_here

# Linux/macOS
export GATEWAYZ_API_KEY="gw_live_your_api_key_here"
```

Or add to your `.env.local` file:
```
GATEWAYZ_API_KEY=gw_live_your_api_key_here
```

### 3. Start the Router

From the project root directory:

```bash
claude-code-router --config .claude-code/config.json
```

The router will start on `http://localhost:3042` by default.

### 4. Configure Claude Code CLI

Point your Claude Code CLI to use the router:

```bash
# Set the API endpoint
export CLAUDE_API_ENDPOINT=http://localhost:3042/v1/messages

# Or configure in your Claude Code settings
```

## 🎯 Router Configuration

### Available Models

The configuration includes models that answered a tool call through Gatewayz on 2026-11-25:

- **anthropic/claude-sonnet-5-5** - Reasoning and default coding work
- **anthropic/claude-haiku-4-5-20251001** - Fast Claude variant
- **openai/gpt-5.4-mini** - Fast, cost-effective for background tasks and web search
- **grok-4** - Long context (256k tokens)
- **moonshot/kimi-k2.6** - Lower-cost coding, large context window
- **Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo** - Coding

### Routing Strategy

The custom router (`custom-router.js`) automatically selects models based on:

| Task Type | Selected Model | Reason |
|-----------|----------------|--------|
| Web Search | GPT-5.4 mini | Fast and cheap |
| Long Context (>50k chars) | Grok 4 | Large context window (256k tokens) |
| Reasoning/Analysis | Claude Sonnet 5.5 | Strongest reasoning |
| Background Tasks | GPT-5.4 mini | Reliable for async operations |
| Default | GPT-5.4 mini | Fast, cost-effective |

### Predefined Routes

You can also use predefined routes from `config.json`:

```json
{
  "default": "gatewayz,openai/gpt-5.4-mini",
  "background": "gatewayz,openai/gpt-5.4-mini",
  "think": "gatewayz,anthropic/claude-sonnet-5-5",
  "longContext": "gatewayz,grok-4",
  "webSearch": "gatewayz,openai/gpt-5.4-mini"
}
```

## 🔧 Customization

### Modify Available Models

Edit `config.json` and update the `models` array:

```json
{
  "providers": [
    {
      "name": "gatewayz",
      "models": [
        "your/model-name",
        "another/model-name"
      ]
    }
  ]
}
```

### Customize Routing Logic

Edit `custom-router.js` to change how models are selected:

```javascript
module.exports = async function router(req, config) {
  // Add your custom routing logic here
  const { body, context } = req;

  // Example: always use a specific model
  return "gatewayz,openai/gpt-5.4-mini";

  // Or use conditional logic based on request
};
```

## 🔍 Debugging

Enable detailed logging in `config.json`:

```json
{
  "LOG": true,
  "LOG_LEVEL": "debug"
}
```

This will show:
- Incoming requests
- Model selection decisions
- API responses
- Error details

## 📊 Model Format

Use the model id exactly as the Gatewayz catalog lists it (`https://api.gatewayz.ai/v1/models`). Most ids are `provider/model-name`, a few are bare.

Examples:
- ✅ `openai/gpt-5.4-mini`
- ✅ `anthropic/claude-sonnet-5-5`
- ✅ `grok-4`
- ❌ `gpt-5.4-mini` (the catalog lists it as `openai/gpt-5.4-mini`)

## 🌐 API Endpoints

The router will expose these endpoints:

- `POST /v1/chat/completions` - Chat completions API
- `GET /v1/models` - List available models
- `GET /health` - Health check

## 📝 Notes

- The router acts as a proxy between Claude Code and GatewayZ API
- All requests are logged for debugging (when `LOG: true`)
- Model selection happens automatically based on the custom router logic
- You can override model selection by specifying a model in the request

## 🔗 Related Links

- [GatewayZ API Documentation](https://docs.gatewayz.ai)
- [Claude Code Router GitHub](https://github.com/musistudio/claude-code-router)
- [Available Models](../src/lib/models-data.ts)

## ⚠️ Troubleshooting

### Router won't start
- Check that `GATEWAYZ_API_KEY` is set
- Verify port 3042 is not in use
- Check config.json syntax is valid

### Models not found
- Ensure model names match GatewayZ format
- Verify models are available in your GatewayZ plan
- Check API key permissions

### Authentication errors
- Confirm API key is valid and active
- Check API key has required permissions
- Verify environment variable is loaded correctly
