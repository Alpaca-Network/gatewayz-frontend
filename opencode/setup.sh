#!/bin/bash
# OpenCode on Gatewayz - setup for macOS and Linux
# Usage: bash setup.sh   (asks for the key; or set GATEWAYZ_API_KEY first)
#
# Installs OpenCode (npm) if missing and adds Gatewayz as a provider to
# OpenCode's own config (~/.config/opencode/opencode.json), keeping anything
# already there (a backup is written next to it). Nothing is added to your
# shell profile and no other tool's settings are touched.

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
WHITE='\033[1;37m'; GRAY='\033[0;37m'; NC='\033[0m'

# Override for testing only (CI points it at an unreachable address).
GATEWAYZ_URL="${GATEWAYZ_BASE_URL:-https://api.gatewayz.ai}"
KEYS_PAGE="https://beta.gatewayz.ai/settings/keys"
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"

step() { echo -e "${YELLOW}→ $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }

# The key is sent to this address and every later prompt goes there, so an
# override must be visible and well-formed. https only, except localhost (CI).
check_base_url() {
    if [ "$GATEWAYZ_URL" != "https://api.gatewayz.ai" ]; then
        if ! [[ "$GATEWAYZ_URL" =~ ^(https://[A-Za-z0-9.-]+|http://(127\.0\.0\.1|localhost))(:[0-9]+)?$ ]]; then
            fail "GATEWAYZ_BASE_URL is set to an address this script will not use: $GATEWAYZ_URL"
            echo "Unset it (unset GATEWAYZ_BASE_URL) and run the script again."
            exit 1
        fi
        echo -e "${YELLOW}⚠ GATEWAYZ_BASE_URL is set: your key and prompts will go to $GATEWAYZ_URL, not api.gatewayz.ai.${NC}"
    fi
}

# Keys are letters, digits, '_' and '-'. Anything else is refused rather than
# pasted into a JSON file or a header.
check_key_format() {
    if ! [[ "$API_KEY" =~ ^[A-Za-z0-9_-]{8,200}$ ]]; then
        fail "That does not look like a Gatewayz API key (letters, digits, '_' and '-' only)."
        exit 1
    fi
}

check_base_url

echo ""
echo -e "${CYAN}OpenCode on Gatewayz - Setup${NC}"
echo ""

step "Checking Node.js installation..."
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    ok "Node.js $(node --version) and npm $(npm --version) installed"
else
    fail "Node.js is not installed"
    if [ "$(uname -s)" = "Darwin" ]; then
        echo -e "${YELLOW}Install with: brew install node${NC}"
    else
        echo -e "${YELLOW}Install Node.js with your package manager (for example: sudo apt install nodejs npm)${NC}"
    fi
    exit 1
fi

echo ""
step "Checking OpenCode..."
if command -v opencode &> /dev/null; then
    ok "OpenCode already installed"
else
    echo -e "${GRAY}Running: npm install -g opencode-ai${NC}"
    if npm install -g opencode-ai > /dev/null 2>&1; then
        ok "OpenCode installed"
    else
        fail "Failed to install OpenCode. Try: npm install -g opencode-ai"
        exit 1
    fi
fi

echo ""
step "Setting up your Gatewayz API key..."
# Not taken as an argument: arguments are visible to other users in the process list.
API_KEY="${GATEWAYZ_API_KEY:-}"
if [ -z "$API_KEY" ]; then
    echo -e "${WHITE}Get a key at ${CYAN}$KEYS_PAGE${NC}"
    read -r -s -p "Paste your Gatewayz API key (input hidden): " API_KEY
    echo ""
    [ -n "$API_KEY" ] || { fail "No API key provided."; exit 1; }
fi

check_key_format
step "Checking the key..."
# Header from stdin (-H @-): not visible in the process list.
HTTP_CODE=$(printf 'Authorization: Bearer %s\n' "$API_KEY" | curl -s -o /dev/null -w "%{http_code}" -m 30 \
    "$GATEWAYZ_URL/user/balance" -H @- || true)
HTTP_CODE="${HTTP_CODE:-000}"
if [ "$HTTP_CODE" = "200" ]; then
    ok "Key accepted by Gatewayz"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    fail "Gatewayz rejected this key (HTTP $HTTP_CODE). Check it at $KEYS_PAGE"
    exit 1
else
    echo -e "${YELLOW}⚠ Could not verify the key (HTTP $HTTP_CODE). Continuing.${NC}"
fi

echo ""
step "Adding Gatewayz to OpenCode's config..."
MERGE_SCRIPT="$(mktemp)"
cat > "$MERGE_SCRIPT" <<'GZ_MERGE_EOF'
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
GZ_MERGE_EOF
GATEWAYZ_API_KEY="$API_KEY" node "$MERGE_SCRIPT" "$CONFIG_FILE" "$GATEWAYZ_URL"
rm -f "$MERGE_SCRIPT"
ok "Config saved (readable only by you): $CONFIG_FILE"

echo ""
echo -e "${GREEN}Setup complete.${NC} Start OpenCode with: ${WHITE}opencode${NC}"
echo -e "${GRAY}Pick a Gatewayz model inside OpenCode with /models (they are listed under Gatewayz).${NC}"
echo ""
