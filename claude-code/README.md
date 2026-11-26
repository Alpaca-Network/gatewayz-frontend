# Claude Code on Gatewayz

Run [Claude Code](https://docs.anthropic.com/en/docs/claude-code) in your terminal on a Gatewayz API key, with any model in the Gatewayz catalog: Claude, GPT, Kimi, DeepSeek, Qwen, Grok, GLM and more.

Claude Code talks to Gatewayz directly through the Anthropic Messages API (`https://api.gatewayz.ai/v1/messages`). No router or proxy is needed.

## One-command setup

**macOS**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)
```

**Linux**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex
```

The script:

1. checks for Node.js and installs Claude Code if it is missing;
2. asks for your Gatewayz API key (from [beta.gatewayz.ai/settings/keys](https://beta.gatewayz.ai/settings/keys)) and checks it;
3. saves the settings to `~/.gatewayz/claude-settings.json`, readable only by you;
4. installs a `gatewayz` command;
5. adds a status line under the prompt: `Gatewayz · <model> · $<credits left>`.

Your normal `claude` command is not changed, and nothing is added to your shell profile (Windows: the command's folder is added to your user PATH).

## Use it

```bash
gatewayz                          # Claude Code on Gatewayz (Claude Sonnet 5.5)
gatewayz --model openai/gpt-5.5   # start on another model
```

Inside a session:

| Command | What it does |
|---|---|
| `/model` | Pick from the Gatewayz models listed |
| `/model <model id>` | Switch to any catalog model by id, e.g. `/model moonshot/kimi-k2.6` |

Model ids are listed at `https://api.gatewayz.ai/v1/models`.

## Models that work well

These answered tool calls through Gatewayz on 2026-11-25:

| Model id | Good for |
|---|---|
| `anthropic/claude-sonnet-5-5` | Default; strongest on long multi-step work |
| `anthropic/claude-haiku-4-5-20251001` | Fast, low cost |
| `openai/gpt-5.5` | Alternative strong model |
| `openai/gpt-5.4-mini` | Fast, low cost |
| `grok-4` | Long context (256k tokens) |
| `moonshot/kimi-k2.6` | Lower-cost coding, 262k context |
| `deepseek-ai/DeepSeek-V4.1-Flash` | Very low cost |
| `deepseek-ai/DeepSeek-V4-Pro` | Lower-cost reasoning |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo` | Coding |
| `zai-org/GLM-5.3` | Coding |

The model needs tool calling and a large context window: an agent request carries about 20,000 tokens of instructions before any work.

## Manual setup

If you prefer not to run the script, create `~/.gatewayz/claude-settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.gatewayz.ai",
    "ANTHROPIC_AUTH_TOKEN": "<your Gatewayz API key>",
    "ANTHROPIC_MODEL": "anthropic/claude-sonnet-5-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "anthropic/claude-haiku-4-5-20251001",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "ANTHROPIC_CUSTOM_HEADERS": "x-gatewayz-passthrough: true"
  }
}
```

and start Claude Code with it:

```bash
claude --settings ~/.gatewayz/claude-settings.json
```

## Good to know

- **Billing.** Sessions are billed to your Gatewayz credits per token. Agent sessions use far more tokens than chat; cheaper models stretch credits much further.
- **claude.ai features.** While a Gatewayz key is active, Claude Code turns off claude.ai connectors (Gmail, Drive and others), Remote Control and cloud sessions. Local tools, MCP servers, skills and memory work.
- **Context window.** When you switch with `/model` to a model with a smaller window than the one you started on, Claude Code may overfill it. Starting with `gatewayz --model <id>` avoids that.
- **Claude Code Router.** Earlier versions of this setup installed Claude Code Router (`ccr`). It is no longer needed and its current release drops tool results on the way to the model. Remove it with `npm uninstall -g @alpaca-network/claude-code-router`.

## Troubleshooting

| Message | Meaning |
|---|---|
| `402 Gatewayz plan limit reached` | Your plan's daily or monthly token allowance is used up. Retrying will not help until it resets or the plan is raised. |
| `402` about credits | Top up at [beta.gatewayz.ai](https://beta.gatewayz.ai). |
| `401` | The key is wrong or revoked. Run the setup again with a new key. |
| `gatewayz: command not found` | Open a new terminal, or add `~/.local/bin` to your PATH. |
