# OpenCode on Gatewayz

Use [OpenCode](https://opencode.ai) in your terminal with any model in the Gatewayz catalog.

## One-command setup

**macOS**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup.sh)
```

**Linux**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup.sh)
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-windows.ps1 | iex
```

The script installs OpenCode with npm if it is missing, checks your Gatewayz key, and adds a **Gatewayz** provider to OpenCode's own config (`~/.config/opencode/opencode.json`). Anything already in that file is kept, and a backup is written next to it. Nothing is added to your shell profile and no other tool's settings are touched.

Then run `opencode` and pick a Gatewayz model with `/models`.

## Manual setup

Add this provider to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "gatewayz": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Gatewayz",
      "options": {
        "baseURL": "https://api.gatewayz.ai/v1",
        "apiKey": "<your Gatewayz API key>"
      },
      "models": {
        "anthropic/claude-sonnet-5-5": { "name": "Claude Sonnet 5.5" },
        "openai/gpt-5.5": { "name": "GPT-5.5" },
        "moonshot/kimi-k2.6": { "name": "Kimi K2.6" },
        "deepseek-ai/DeepSeek-V4.1-Flash": { "name": "DeepSeek V4.1 Flash" }
      }
    }
  }
}
```

Any catalog id works as a model key; the list is at `https://api.gatewayz.ai/v1/models`.

## Earlier versions of this setup

The previous scripts (in a private repository, so the one-line installs returned 404) wrote `~/.opencode/config.json`, a format OpenCode does not read, and set `OPENAI_API_KEY` / `OPENAI_BASE_URL` in your shell profile to Gatewayz values. If you ran them, remove those two `export` lines from `~/.zshrc` / `~/.bashrc` under "# OpenCode with GatewayZ" so your own OpenAI setup works again.
