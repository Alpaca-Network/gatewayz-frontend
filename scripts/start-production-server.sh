#!/bin/bash
# Production Server Startup for E2E Tests
#
# This script builds and starts a production Next.js server for Playwright E2E testing.
# Production builds respond immediately (no compilation delay) and are more stable.
#
# Usage:
#   ./scripts/start-production-server.sh
#   PORT=3001 ./scripts/start-production-server.sh
#
# Environment Variables:
#   PORT - Port to run server on (default: 3000)
#   BUILD_SKIP - Set to 1 to skip build step (default: 0)

set -e

# Configuration
PORT=${PORT:-3000}
BUILD_SKIP=${BUILD_SKIP:-0}
PID_FILE=".next-server.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting production server for E2E tests${NC}"

# Check if server is already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Server already running on PID $OLD_PID${NC}"
        echo -e "${YELLOW}   Run './scripts/stop-production-server.sh' to stop it first${NC}"
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

# Build production bundle (unless skipped)
if [ "$BUILD_SKIP" != "1" ]; then
    echo -e "${BLUE}📦 Building production bundle...${NC}"
    pnpm build

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Build complete${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping build (BUILD_SKIP=1)${NC}"
fi

# Start production server in background
echo -e "${BLUE}🌐 Starting server on port $PORT...${NC}"

# Export port for Next.js
export PORT

# Start server and capture PID
pnpm start > /tmp/nextjs-production.log 2>&1 &
SERVER_PID=$!

# Save PID for cleanup
echo "$SERVER_PID" > "$PID_FILE"

echo -e "${GREEN}✅ Server started with PID $SERVER_PID${NC}"

# Wait for server to be ready
echo -e "${BLUE}⏳ Waiting for server to be ready...${NC}"

MAX_WAIT=30
COUNTER=0

while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -q "200\|304\|404"; then
        echo -e "${GREEN}✅ Server is ready at http://localhost:$PORT${NC}"
        echo -e "${GREEN}   PID: $SERVER_PID${NC}"
        echo -e "${GREEN}   Logs: /tmp/nextjs-production.log${NC}"
        echo -e "${GREEN}   Stop: ./scripts/stop-production-server.sh${NC}"
        exit 0
    fi

    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -n "."
done

echo ""
echo -e "${RED}❌ Server did not respond within ${MAX_WAIT}s${NC}"
echo -e "${YELLOW}   Check logs: tail -f /tmp/nextjs-production.log${NC}"

# Cleanup on failure
kill "$SERVER_PID" 2>/dev/null || true
rm "$PID_FILE" 2>/dev/null || true

exit 1
