#!/bin/bash
# Claude Code on Gatewayz - setup for Linux
# Usage: bash setup-linux.sh [API_KEY]
#
# Installs Claude Code (if missing) and a `gatewayz` command that starts it on
# your Gatewayz key. Your normal `claude` command is not changed, and nothing
# is added to your shell profile: the key and settings live in
# ~/.gatewayz/claude-settings.json (readable only by you).
#
# Claude Code talks to Gatewayz directly (https://api.gatewayz.ai, Anthropic
# Messages API). No router or proxy is installed.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m'

GATEWAYZ_URL="https://api.gatewayz.ai"
KEYS_PAGE="https://beta.gatewayz.ai/settings/keys"
DEFAULT_MODEL="anthropic/claude-sonnet-5-5"
SMALL_MODEL="anthropic/claude-haiku-4-5-20251001"
CONFIG_DIR="$HOME/.gatewayz"
SETTINGS_FILE="$CONFIG_DIR/claude-settings.json"
BIN_DIR="$HOME/.local/bin"
LAUNCHER="$BIN_DIR/gatewayz"

step() { echo -e "${YELLOW}→ $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Claude Code on Gatewayz - Setup           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Node.js
step "Checking Node.js installation..."
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    ok "Node.js $(node --version) and npm $(npm --version) installed"
else
    fail "Node.js is not installed"
    echo -e "${YELLOW}Install with your package manager (for example: sudo apt install nodejs npm)${NC}"
    echo -e "${YELLOW}Or download from: https://nodejs.org/${NC}"
    exit 1
fi

# Step 2: Claude Code
echo ""
step "Checking Claude Code..."
if command -v claude &> /dev/null; then
    ok "Claude Code already installed"
else
    echo -e "${GRAY}Running: npm install -g @anthropic-ai/claude-code${NC}"
    if npm install -g @anthropic-ai/claude-code > /dev/null 2>&1; then
        ok "Claude Code installed"
    else
        fail "Failed to install Claude Code"
        echo -e "${YELLOW}Try manually: npm install -g @anthropic-ai/claude-code${NC}"
        exit 1
    fi
fi

# Step 3: API key
echo ""
step "Setting up your Gatewayz API key..."
API_KEY="${1:-$GATEWAYZ_API_KEY}"
if [ -z "$API_KEY" ]; then
    echo ""
    echo -e "${WHITE}You need a Gatewayz API key:${NC}"
    echo -e "${WHITE}  1. Visit: ${CYAN}$KEYS_PAGE${NC}"
    echo -e "${WHITE}  2. Sign in and click 'Generate API Key' if you don't have one${NC}"
    echo -e "${WHITE}  3. Copy the key${NC}"
    echo ""
    echo -e "${YELLOW}Press Enter to open the API keys page in your browser, or Ctrl+C to cancel...${NC}"
    read -r
    if command -v xdg-open &> /dev/null; then xdg-open "$KEYS_PAGE" 2>/dev/null || true; else echo -e "${WHITE}Open: ${CYAN}$KEYS_PAGE${NC}"; fi
    echo ""
    read -r -s -p "Paste your Gatewayz API key (input hidden): " API_KEY
    echo ""
    if [ -z "$API_KEY" ]; then
        fail "No API key provided. Run this script again when you have one."
        exit 1
    fi
fi

# Step 4: Check the key against Gatewayz
step "Checking the key..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 30 "$GATEWAYZ_URL/v1/messages/count_tokens" \
    -H "x-api-key: $API_KEY" -H "content-type: application/json" \
    -d '{"model":"'"$DEFAULT_MODEL"'","messages":[{"role":"user","content":"hi"}]}' || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    ok "Key accepted by Gatewayz"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    fail "Gatewayz rejected this key (HTTP $HTTP_CODE). Check it at $KEYS_PAGE"
    exit 1
else
    echo -e "${YELLOW}⚠ Could not verify the key (HTTP $HTTP_CODE). Continuing; check your connection.${NC}"
fi

# Step 5: Settings file
echo ""
step "Writing Claude Code settings for Gatewayz..."
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
# Private from the moment it is created; the umask applies to this subshell only.
(umask 077; cat > "$SETTINGS_FILE") <<EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "$GATEWAYZ_URL",
    "ANTHROPIC_AUTH_TOKEN": "$API_KEY",
    "ANTHROPIC_MODEL": "$DEFAULT_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$SMALL_MODEL",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "ANTHROPIC_CUSTOM_HEADERS": "x-gatewayz-passthrough: true"
  }
}
EOF
chmod 600 "$SETTINGS_FILE"
ok "Settings saved to $SETTINGS_FILE (readable only by you)"

# Step 6: gatewayz command
echo ""
step "Installing the gatewayz command..."
mkdir -p "$BIN_DIR"
cat > "$LAUNCHER" <<'EOF'
#!/bin/bash
# Start Claude Code on Gatewayz. Everything after `gatewayz` goes to claude,
# for example:  gatewayz --model openai/gpt-5.5
exec claude --settings "$HOME/.gatewayz/claude-settings.json" "$@"
EOF
chmod 755 "$LAUNCHER"
ok "Installed $LAUNCHER"
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        echo -e "${YELLOW}⚠ $BIN_DIR is not on your PATH. Add this line to your shell profile:${NC}"
        echo -e "${GREEN}    export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        ;;
esac

if command -v ccr &> /dev/null; then
    echo ""
    echo -e "${GRAY}Note: Claude Code Router (ccr) is no longer needed for Gatewayz.${NC}"
    echo -e "${GRAY}You can remove it with: npm uninstall -g @alpaca-network/claude-code-router${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup complete                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Start a session:${NC}"
echo -e "  ${WHITE}gatewayz${NC}                         ${GRAY}- Claude Code on Gatewayz (Claude Sonnet 5.5)${NC}"
echo -e "  ${WHITE}gatewayz --model openai/gpt-5.5${NC}  ${GRAY}- start on another model${NC}"
echo ""
echo -e "${CYAN}Inside a session:${NC}"
echo -e "  ${WHITE}/model${NC}                ${GRAY}- pick from the Gatewayz models listed${NC}"
echo -e "  ${WHITE}/model <model id>${NC}     ${GRAY}- switch to any model by id, e.g. /model moonshot/kimi-k2.6${NC}"
echo ""
echo -e "${GRAY}Your normal 'claude' command is unchanged. Model ids: $GATEWAYZ_URL/v1/models${NC}"
echo ""
