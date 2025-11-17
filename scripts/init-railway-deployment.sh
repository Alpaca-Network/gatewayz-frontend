#!/bin/bash

# Railway Initial Deployment Setup
# This script automates the creation of a new container deployment in Railway
# Run this ONCE before using auto-deployment

set -e

echo "🚀 Railway Initial Deployment Setup"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${BLUE}Installing Railway CLI...${NC}"
    npm install -g @railway/cli
    echo -e "${GREEN}✓ Railway CLI installed${NC}"
fi

# Check if we have required environment variables
if [ -z "$RAILWAY_TOKEN" ] && [ -z "$RAILWAY_PROJECT_ID" ]; then
    echo -e "${RED}Error: Environment variables not set${NC}"
    echo ""
    echo "First, run: bash scripts/setup-auto-deploy.sh"
    echo ""
    echo "Then set these in your shell:"
    echo "  export RAILWAY_TOKEN=rwy_..."
    echo "  export RAILWAY_PROJECT_ID=..."
    exit 1
fi

echo -e "${BLUE}Step 1: Authenticate with Railway${NC}"
if [ -z "$RAILWAY_TOKEN" ]; then
    read -p "Enter your Railway API token: " RAILWAY_TOKEN
fi

export RAILWAY_TOKEN
railway login --token "$RAILWAY_TOKEN" 2>/dev/null || true

echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

echo -e "${BLUE}Step 2: Select or Create Project${NC}"

if [ -z "$RAILWAY_PROJECT_ID" ]; then
    echo "Your projects:"
    railway project list || true
    echo ""
    read -p "Enter Project ID (or create new one in Railway dashboard): " PROJECT_ID
    export RAILWAY_PROJECT_ID="$PROJECT_ID"
else
    PROJECT_ID="$RAILWAY_PROJECT_ID"
fi

echo "Using project: $PROJECT_ID"
railway project switch --id "$PROJECT_ID" 2>/dev/null || {
    echo -e "${RED}Error: Could not switch to project${NC}"
    exit 1
}

echo -e "${GREEN}✓ Project selected${NC}"
echo ""

echo -e "${BLUE}Step 3: Create Service${NC}"
echo "Creating 'backend' service..."

# Check if service already exists
SERVICE_EXISTS=$(railway service list 2>/dev/null | grep -i backend || echo "")

if [ -z "$SERVICE_EXISTS" ]; then
    echo "Service does not exist, will be created on first deployment"
else
    echo -e "${GREEN}✓ Service 'backend' already exists${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: Deploy Current Code${NC}"

# Check if railway.json exists
if [ ! -f "railway.json" ]; then
    echo -e "${RED}Error: railway.json not found${NC}"
    echo "This file is required for Railway deployment configuration"
    exit 1
fi

echo "Starting initial deployment..."
echo ""

# Deploy
railway up --service backend --detach

echo ""
echo -e "${GREEN}✓ Deployment started${NC}"
echo ""

echo -e "${BLUE}Step 5: Wait for Deployment${NC}"
echo "Waiting for container to build and start (this may take 2-3 minutes)..."
echo ""

# Wait and check status
sleep 30
ATTEMPTS=0
MAX_ATTEMPTS=36  # 18 minutes

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    ATTEMPTS=$((ATTEMPTS + 1))

    echo "Check $ATTEMPTS/$MAX_ATTEMPTS: Waiting for deployment..."

    # Try to get logs
    if railway logs --tail 5 2>/dev/null | grep -q "Uvicorn running"; then
        echo -e "${GREEN}✓ Application started successfully!${NC}"
        break
    fi

    sleep 30
done

echo ""
echo -e "${BLUE}Step 6: Set Environment Variables${NC}"

echo "Setting production environment..."
railway environment switch --name production

echo ""
echo "You need to configure environment variables in Railway:"
echo "  1. Go to: https://railway.app"
echo "  2. Open your project"
echo "  3. Click on 'backend' service"
echo "  4. Go to Variables tab"
echo "  5. Add these variables:"
echo ""
echo "Required variables:"
cat << 'EOF'
ENVIRONMENT=production
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
OPENROUTER_API_KEY=your-key
PORTKEY_API_KEY=your-key
# ... (copy all from your .env file)
EOF

echo ""
read -p "Press Enter once you've added the variables in Railway dashboard..."

echo ""
echo -e "${BLUE}Step 7: Verify Deployment${NC}"

# Get service domain
DOMAIN=$(railway domain 2>/dev/null || echo "")

if [ -z "$DOMAIN" ]; then
    echo "Generating domain..."
    railway domain --generate || true
    sleep 5
    DOMAIN=$(railway domain 2>/dev/null || echo "")
fi

if [ -n "$DOMAIN" ]; then
    echo "Service domain: $DOMAIN"
    echo ""
    echo "Testing health endpoint..."

    # Wait a bit for domain to be ready
    sleep 10

    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" || echo "000")

    if [ "$HEALTH_CHECK" == "200" ]; then
        echo -e "${GREEN}✓ Health check passed!${NC}"
        echo -e "${GREEN}✓ Your app is live at: https://$DOMAIN${NC}"
    else
        echo -e "${YELLOW}⚠ Health check returned HTTP $HEALTH_CHECK${NC}"
        echo "This might be normal if:"
        echo "  - App is still starting"
        echo "  - Environment variables not yet set"
        echo ""
        echo "Check Railway logs: railway logs --follow"
    fi
else
    echo -e "${YELLOW}⚠ Could not generate domain${NC}"
    echo "Add custom domain in Railway dashboard"
fi

echo ""
echo "==================================="
echo -e "${GREEN}✓ Initial Deployment Complete!${NC}"
echo "==================================="
echo ""

echo "Next steps:"
echo "1. Configure environment variables in Railway (if not done)"
echo "2. Verify your domain is working: https://\$DOMAIN/health"
echo "3. Run: bash scripts/setup-auto-deploy.sh"
echo "4. Verify: gh secret list"
echo "5. Merge a PR to main/staging to test auto-deployment"
echo ""

echo "Useful commands:"
echo "  railway logs --follow          # Watch live logs"
echo "  railway domain                 # Show current domain"
echo "  railway env                    # List variables"
echo "  railway up --detach            # Redeploy manually"
echo ""
