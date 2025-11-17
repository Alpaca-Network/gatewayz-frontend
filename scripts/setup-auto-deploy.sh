#!/bin/bash

# Auto-Deployment Setup Script for Railway
# This script helps you configure automatic deployment to Railway when PRs are merged

set -e

echo "🚀 Railway Auto-Deployment Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) not found${NC}"
    echo "Install it from: https://cli.github.com"
    exit 1
fi

# Get current repo info
echo -e "${BLUE}Detecting repository...${NC}"
REPO=$(gh repo view --json nameWithOwner -q)
echo -e "Repository: ${GREEN}$REPO${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f ".github/workflows/deploy.yml" ]; then
    echo -e "${RED}Error: deploy.yml not found${NC}"
    echo "Please run this script from the repository root"
    exit 1
fi

echo -e "${BLUE}Step 1: Railway Token${NC}"
echo "You need a Railway API token. Get it from:"
echo "  1. Go to https://railway.app"
echo "  2. Account Settings → Tokens"
echo "  3. Create new token"
echo ""

read -p "Enter your Railway token (or press Enter to skip): " RAILWAY_TOKEN

if [ -z "$RAILWAY_TOKEN" ]; then
    echo -e "${YELLOW}Skipped Railway token${NC}"
else
    if gh secret set RAILWAY_TOKEN -b"$RAILWAY_TOKEN" 2>/dev/null; then
        echo -e "${GREEN}✓ RAILWAY_TOKEN set${NC}"
    else
        echo -e "${RED}Failed to set RAILWAY_TOKEN${NC}"
        echo "Try manually: gh secret set RAILWAY_TOKEN"
    fi
fi

echo ""
echo -e "${BLUE}Step 2: Railway Project ID${NC}"
echo "Get your project ID from Railway dashboard"
echo "  1. Open your project"
echo "  2. Project ID is in the top-left corner"
echo "  3. Or check the URL: https://railway.app/project/{PROJECT_ID}"
echo ""

read -p "Enter your Railway Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Project ID is required${NC}"
    exit 1
fi

if gh secret set RAILWAY_PROJECT_ID -b"$PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✓ RAILWAY_PROJECT_ID set${NC}"
else
    echo -e "${RED}Failed to set RAILWAY_PROJECT_ID${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Railway Domain${NC}"
echo "Enter your Railway domain (where the app is deployed)"
echo "  Example: api.railway.app or api.example.com"
echo ""

read -p "Enter your Railway domain: " RAILWAY_DOMAIN

if [ -z "$RAILWAY_DOMAIN" ]; then
    echo -e "${RED}Domain is required${NC}"
    exit 1
fi

if gh secret set RAILWAY_DOMAIN -b"$RAILWAY_DOMAIN" 2>/dev/null; then
    echo -e "${GREEN}✓ RAILWAY_DOMAIN set${NC}"
else
    echo -e "${RED}Failed to set RAILWAY_DOMAIN${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 4: Optional - Staging Domain${NC}"
echo "If you have a separate staging domain, enter it here"
echo "(or press Enter to skip)"
echo ""

read -p "Enter staging domain (optional): " STAGING_DOMAIN

if [ ! -z "$STAGING_DOMAIN" ]; then
    if gh secret set STAGING_RAILWAY_DOMAIN -b"$STAGING_DOMAIN" 2>/dev/null; then
        echo -e "${GREEN}✓ STAGING_RAILWAY_DOMAIN set${NC}"
    fi
fi

echo ""
echo "==================================="
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "==================================="
echo ""

# Verify secrets are set
echo "Verifying secrets..."
SECRETS=$(gh secret list)

CHECKS=(
    "RAILWAY_TOKEN"
    "RAILWAY_PROJECT_ID"
    "RAILWAY_DOMAIN"
)

for secret in "${CHECKS[@]}"; do
    if echo "$SECRETS" | grep -q "$secret"; then
        echo -e "${GREEN}✓${NC} $secret"
    else
        echo -e "${YELLOW}○${NC} $secret (optional or skipped)"
    fi
done

echo ""
echo "Next steps:"
echo ""
echo "1. ✅ Verify your Railway environment variables are configured:"
echo "   - Go to Railway Dashboard → Project → Environment"
echo "   - Add: ENVIRONMENT, SUPABASE_URL, SUPABASE_KEY, etc."
echo ""
echo "2. ✅ Set up branch protection rules (recommended):"
echo "   - Repository Settings → Branches → Add rule"
echo "   - Pattern: main"
echo "   - Require status checks to pass"
echo ""
echo "3. ✅ Test with a PR merge to staging"
echo ""
echo "4. ✅ Monitor deployment:"
echo "   - Actions → Auto Deploy to Railway"
echo "   - View workflow runs"
echo ""
echo "📖 Full docs: docs/AUTO_DEPLOYMENT_SETUP.md"
echo ""
