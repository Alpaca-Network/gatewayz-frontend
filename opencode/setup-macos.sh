#!/bin/bash
# OpenCode + GatewayZ Setup for macOS
# Usage: bash setup-macos.sh [API_KEY]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║      OpenCode + GatewayZ Setup             ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Escape special characters for JSON strings
escape_json() {
    local str="$1"
    # Escape backslash first, then double quotes
    str="${str//\\/\\\\}"
    str="${str//\"/\\\"}"
    echo "$str"
}

print_header

# Step 1: Install OpenCode
echo ""
print_step "Installing OpenCode..."

# Check if opencode is already installed
if command -v opencode &> /dev/null; then
    OPENCODE_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
    print_success "OpenCode already installed (version: $OPENCODE_VERSION)"
else
    # Try installation methods in order of preference
    INSTALLED=false

    # Method 1: Homebrew
    if command -v brew &> /dev/null && [ "$INSTALLED" = false ]; then
        print_step "Installing via Homebrew..."
        if brew install opencode > /dev/null 2>&1; then
            INSTALLED=true
            print_success "OpenCode installed via Homebrew"
        else
            echo -e "${YELLOW}Homebrew install failed, trying alternative methods...${NC}"
        fi
    fi

    # Method 2: curl installer
    if [ "$INSTALLED" = false ]; then
        print_step "Installing via curl installer..."
        if curl -fsSL https://opencode.ai/install | bash > /dev/null 2>&1; then
            INSTALLED=true
            print_success "OpenCode installed via curl installer"
        else
            echo -e "${YELLOW}Curl installer failed, trying npm...${NC}"
        fi
    fi

    # Method 3: npm (fallback)
    if [ "$INSTALLED" = false ] && command -v npm &> /dev/null; then
        print_step "Installing via npm..."
        if npm install -g opencode-ai@latest > /dev/null 2>&1; then
            INSTALLED=true
            print_success "OpenCode installed via npm"
        fi
    fi

    if [ "$INSTALLED" = false ]; then
        print_error "Failed to install OpenCode"
        echo ""
        echo -e "${YELLOW}Please install manually using one of these methods:${NC}"
        echo -e "${WHITE}  Homebrew:${NC} brew install opencode"
        echo -e "${WHITE}  Curl:${NC}     curl -fsSL https://opencode.ai/install | bash"
        echo -e "${WHITE}  npm:${NC}      npm install -g opencode-ai@latest"
        exit 1
    fi
fi

# Refresh PATH
export PATH="$HOME/bin:$HOME/.opencode/bin:$PATH"

# Verify installation
if ! command -v opencode &> /dev/null; then
    echo -e "${YELLOW}⚠ OpenCode installed but not in PATH${NC}"
    echo -e "${YELLOW}You may need to restart your terminal${NC}"
fi

# Step 2: Get API Key
echo ""
print_step "Setting up GatewayZ API key..."

API_KEY="${1:-$GATEWAYZ_API_KEY}"

if [ -z "$API_KEY" ]; then
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  API KEY REQUIRED${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "${WHITE}To get your API key, you need to:${NC}"
    echo -e "${WHITE}  1. Visit: ${CYAN}https://beta.gatewayz.ai/settings/keys${NC}"
    echo -e "${WHITE}  2. Sign in to GatewayZ${NC}"
    echo -e "${WHITE}  3. Click 'Generate API Key' if you don't have one${NC}"
    echo -e "${WHITE}  4. Copy your API key${NC}"
    echo ""
    echo -e "${YELLOW}Press Enter to open the API keys page in your browser, or Ctrl+C to cancel...${NC}"
    read

    # Open browser after user confirms
    echo -e "${CYAN}Opening browser...${NC}"
    open "https://beta.gatewayz.ai/settings/keys" 2>/dev/null || true

    echo ""
    echo -e "${WHITE}After copying your API key from the browser, paste it below:${NC}"
    read -p "Paste your GatewayZ API key here: " API_KEY

    if [ -z "$API_KEY" ]; then
        echo ""
        echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  MANUAL SETUP REQUIRED${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${WHITE}No API key provided. To complete setup manually:${NC}"
        echo ""
        echo -e "${WHITE}  1. Visit: ${CYAN}https://beta.gatewayz.ai/settings/keys${NC}"
        echo -e "${WHITE}  2. Sign in and generate an API key${NC}"
        echo -e "${WHITE}  3. Copy your key and add it to your shell config:${NC}"
        echo ""
        echo -e "${GREEN}     export GATEWAYZ_API_KEY='your-key-here'${NC}"
        echo ""
        echo -e "${WHITE}  4. Restart your terminal${NC}"
        echo -e "${WHITE}  5. Run: ${GREEN}opencode${NC}"
        echo ""
        print_error "Setup incomplete - API key required"
        exit 1
    fi
fi

# Add to shell config
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
fi

if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q "GATEWAYZ_API_KEY" "$SHELL_CONFIG"; then
        echo "" >> "$SHELL_CONFIG"
        echo "# GatewayZ API Key for OpenCode" >> "$SHELL_CONFIG"
        echo "export GATEWAYZ_API_KEY=\"$API_KEY\"" >> "$SHELL_CONFIG"
    fi
fi

export GATEWAYZ_API_KEY="$API_KEY"
print_success "API key configured"

# Step 3: Create OpenCode configuration
echo ""
print_step "Creating OpenCode configuration for GatewayZ..."

CONFIG_DIR="$HOME/.opencode"
CONFIG_FILE="$CONFIG_DIR/config.json"

mkdir -p "$CONFIG_DIR"

# Escape API key for safe JSON embedding
ESCAPED_API_KEY=$(escape_json "$API_KEY")

cat > "$CONFIG_FILE" <<EOF
{
  "provider": {
    "type": "openai",
    "api_key": "$ESCAPED_API_KEY",
    "base_url": "https://api.gatewayz.ai/v1"
  },
  "model": {
    "default": "anthropic/claude-sonnet-4.5",
    "available": [
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-opus-4-20250514",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "x-ai/grok-3-turbo-preview",
      "x-ai/grok-code-fast-1",
      "deepseek/deepseek-v3.1",
      "deepseek/deepseek-chat-v3.1"
    ]
  }
}
EOF

# Secure the config file (contains API key)
chmod 600 "$CONFIG_FILE"

print_success "Configuration created at: $CONFIG_FILE"

# Step 4: Set environment variables for OpenCode
echo ""
print_step "Setting OpenCode environment variables..."

# Add OpenCode-specific environment variables to shell config
if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q "OPENAI_API_KEY.*gatewayz" "$SHELL_CONFIG" && ! grep -q "# OpenCode with GatewayZ" "$SHELL_CONFIG"; then
        echo "" >> "$SHELL_CONFIG"
        echo "# OpenCode with GatewayZ" >> "$SHELL_CONFIG"
        echo "export OPENAI_API_KEY=\"$API_KEY\"" >> "$SHELL_CONFIG"
        echo "export OPENAI_BASE_URL=\"https://api.gatewayz.ai/v1\"" >> "$SHELL_CONFIG"
    fi
fi

export OPENAI_API_KEY="$API_KEY"
export OPENAI_BASE_URL="https://api.gatewayz.ai/v1"

print_success "Environment variables configured"

# Step 5: Test connection
echo ""
print_step "Testing GatewayZ connection..."
if curl -s -f -H "Authorization: Bearer $API_KEY" https://api.gatewayz.ai/ > /dev/null 2>&1; then
    print_success "Connection successful"
else
    echo -e "${YELLOW}⚠ Could not verify connection (this may be normal)${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Setup Complete!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Quick Start:${NC}"
echo -e "  ${WHITE}opencode${NC}              ${GRAY}- Start OpenCode TUI${NC}"
echo -e "  ${WHITE}opencode run${NC}          ${GRAY}- Run a single prompt${NC}"
echo -e "  ${WHITE}Tab${NC}                   ${GRAY}- Switch between build/plan agents${NC}"
echo ""
echo -e "${CYAN}Available Models (via GatewayZ):${NC}"
echo -e "  ${WHITE}• claude-sonnet-4.5 (default)${NC}"
echo -e "  ${WHITE}• gpt-5${NC}"
echo -e "  ${WHITE}• gemini-2.5-pro${NC}"
echo -e "  ${WHITE}• grok-3-turbo-preview${NC}"
echo -e "  ${WHITE}• deepseek-v3.1${NC}"
echo -e "  ${WHITE}• Plus 1000+ more models...${NC}"
echo ""
if [ -n "$SHELL_CONFIG" ]; then
    echo -e "${YELLOW}Note: Restart your terminal or run:${NC}"
    echo -e "${WHITE}source $SHELL_CONFIG${NC}"
else
    echo -e "${YELLOW}Note: Restart your terminal to apply changes${NC}"
fi
echo ""
echo -e "${CYAN}Next Steps:${NC}"
if [ -n "$SHELL_CONFIG" ]; then
    echo -e "${WHITE}  1. Close and reopen your terminal (or run: source $SHELL_CONFIG)${NC}"
else
    echo -e "${WHITE}  1. Close and reopen your terminal${NC}"
fi
echo -e "${WHITE}  2. Run: ${NC}${GREEN}opencode${NC}"
echo ""
echo -e "${GRAY}Setup complete! Review the output above for any warnings.${NC}"
echo ""
